import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { Store } from "../server/store.ts";
import { DatabaseSync } from "node:sqlite";
import { createGameServer } from "../server/http.ts";
import { tiltLevel } from "../server/rules.ts";
import type {
  Action,
  ActionRequest,
  ActionResponse,
  PlayerState,
} from "../src/types.ts";

const p = [0.4, 0.2, 0.15, 0.1, 0.1, 0.05];
const request = (revision: string, action: Action): ActionRequest => ({
  requestId: randomUUID(),
  revision,
  action,
});
function fixture(store: Store, id: string, gold = "100", best = "0") {
  store.db
    .prepare(
      "UPDATE players SET gold = ?, best_gold = ?, probabilities = ?, has_completed_run = ? WHERE id = ?",
    )
    .run(gold, best, JSON.stringify(p), best === "0" ? 0 : 1, id);
}
test("all actions are retry-safe, revision guarded, atomic, and survive reopening SQLite", () => {
  const dir = mkdtempSync(join(tmpdir(), "one-six-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  try {
    const { state, token } = store.create();
    fixture(store, state.id);
    const roll = request("0", { kind: "roll", wagers: { n1: "10" } });
    const response = store.act(state.id, roll);
    assert.equal(response.state.gold, "150");
    assert.equal(response.state.revision, "1");
    assert.equal(response.state.bestGold, "0");
    assert.equal(response.state.canShake, true);
    assert.equal(response.state.tiltLevel, tiltLevel(response.state.probabilities));
    assert.deepEqual(store.act(state.id, roll), response);
    assert.throws(
      () => store.act(state.id, { ...roll, action: { kind: "shake" } }),
      /different action/,
    );
    assert.throws(
      () => store.act(state.id, request("0", { kind: "shake" })),
      /Another tab/,
    );
    assert.deepEqual(store.get(state.id), response.state);
    assert.throws(
      () =>
        store.act(
          state.id,
          request("1", { kind: "roll", wagers: { n1: "999" } }),
        ),
      /exceed/,
    );
    assert.equal(store.get(state.id).revision, "1");
    const name = request("1", { kind: "nickname", nickname: "Ada" });
    const named = store.act(state.id, name);
    assert.deepEqual(store.act(state.id, name), named);
    assert.equal(named.state.nickname, "Ada");
    store.close();
    store = new Store(path, () => 0.9);
    assert.deepEqual(store.session(token), named.state);
    assert.deepEqual(store.act(state.id, roll), response);
    assert.deepEqual(store.get(state.id), named.state);
    assert.deepEqual(store.leaderboard(), []);
    assert.equal(named.state.rollsUsed, 1);
    const action = request(named.state.revision, { kind: "shake" });
    const next = store.act(state.id, action);
    assert.equal(next.state.gold, "150");
    assert.equal(next.state.bestGold, "0");
    assert.equal(next.state.canShake, false);
    assert.notDeepEqual(next.state.probabilities, p);
    assert.deepEqual(store.act(state.id, action), next);
    assert.throws(() => store.act(state.id, request(next.state.revision, { kind: "shake" })), /changes your bankroll/);
    assert.deepEqual(store.get(state.id), next.state);
    store.close();
    store = new Store(path);
    assert.deepEqual(store.session(token), next.state);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("record integrity: break-even, loss, bankruptcy, retry and restart keep historical best", () => {
  const store = new Store(":memory:", () => 0.1);
  try {
    const { state } = store.create();
    fixture(store, state.id, "100", "180");
    const all = Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((n) => [`n${n}`, "10"]),
    );
    const even = store.act(
      state.id,
      request("0", { kind: "roll", wagers: all }),
    );
    assert.equal(even.state.gold, "100");
    assert.equal(even.state.bestGold, "180");
    assert.equal(even.state.canShake, false);
    const lost = store.act(
      state.id,
      request("1", { kind: "roll", wagers: { n2: "100" } }),
    );
    assert.equal(lost.state.gold, "0");
    assert.equal(lost.state.bestGold, "180");
    assert.equal(lost.state.canShake, false);
    const restart = request("2", { kind: "restart" });
    const next = store.act(state.id, restart);
    assert.equal(next.state.gold, "100");
    assert.equal(next.state.bestGold, "180");
    assert.equal(next.state.lastRoll, null);
    assert.equal(next.state.canShake, false);
    assert.deepEqual(store.act(state.id, restart), next);
  } finally {
    store.close();
  }
});

test("restarting an unfinished run resets progress without posting it or changing completed scores", () => {
  const store = new Store(":memory:", () => 0.1);
  try {
    for (const best of ["0", "180"]) {
      const { state } = store.create();
      fixture(store, state.id, "100", best);
      const won = store.act(state.id, request("0", { kind: "roll", wagers: { n1: "50" } }));
      assert.equal(won.state.gold, "350");
      assert.equal(won.state.rollsUsed, 1);
      assert.equal(won.state.canShake, true);
      const leaders = store.leaderboard();
      const restart = request("1", { kind: "restart" });
      const next = store.act(state.id, restart);
      assert.equal(next.state.gold, "100");
      assert.equal(next.state.rollsUsed, 0);
      assert.equal(next.state.lastRoll, null);
      assert.equal(next.state.canShake, false);
      assert.equal(next.state.bestGold, best);
      assert.equal(next.state.hasCompletedRun, best !== "0");
      assert.equal(next.state.nickname, state.nickname);
      assert.notDeepEqual(next.state.probabilities, won.state.probabilities);
      assert.deepEqual(store.leaderboard(), leaders);
      assert.deepEqual(store.act(state.id, restart), next);
      assert.throws(() => store.act(state.id, request("1", { kind: "restart" })), /Another tab/);
      assert.deepEqual(store.get(state.id), next.state);
      const firstRoll = store.act(state.id, request("2", { kind: "roll", wagers: { red: "1", black: "1" } }));
      assert.equal(firstRoll.state.rollsUsed, 1);
    }
  } finally {
    store.close();
  }
});

test("100 rolls post only final Gold, freeze the run, and retain the best completed score", () => {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-run-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  try {
    const { state, token } = store.create();
    fixture(store, state.id);
    const act = (action: Action) => store.act(state.id, request(store.get(state.id).revision, action));
    assert.deepEqual(store.leaderboard(), []);
    act({ kind: "roll", wagers: { n1: "10" } }); // Peak 150 G is not a score.
    act({ kind: "shake" });
    assert.equal(store.get(state.id).rollsUsed, 1);
    for (let roll = 2; roll <= 99; roll++) {
      const result = act({ kind: "roll", wagers: { red: "1", black: "1" } });
      assert.equal(result.state.rollsUsed, roll);
      assert.equal(result.state.hasCompletedRun, false);
      assert.equal(result.state.bestGold, "0");
      assert.deepEqual(store.leaderboard(), []);
    }
    store.close();
    store = new Store(path, () => 0.1);
    assert.equal(store.session(token)!.rollsUsed, 99);
    const finalRequest = request(store.get(state.id).revision, { kind: "roll", wagers: { n6: "50" } });
    const final = store.act(state.id, finalRequest);
    assert.equal(final.state.gold, "100");
    assert.equal(final.state.rollsUsed, 100);
    assert.equal(final.state.bestGold, "100");
    assert.equal(final.state.hasCompletedRun, true);
    assert.equal(final.state.canShake, false);
    assert.equal(store.leaderboard()[0].bestGold, "100");
    assert.deepEqual(store.act(state.id, finalRequest), final);
    assert.throws(() => act({ kind: "roll", wagers: { red: "1" } }), /run has ended/);
    assert.throws(() => act({ kind: "shake" }), /run has ended/);
    act({ kind: "nickname", nickname: "Finisher" });
    assert.equal(store.leaderboard()[0].nickname, "Finisher");
    const restartRequest = request(store.get(state.id).revision, { kind: "restart" });
    const restarted = store.act(state.id, restartRequest);
    assert.equal(restarted.state.gold, "100");
    assert.equal(restarted.state.rollsUsed, 0);
    assert.equal(restarted.state.bestGold, "100");
    assert.equal(restarted.state.lastRoll, null);
    assert.deepEqual(store.act(state.id, restartRequest), restarted);
    store.act(state.id, finalRequest);
    assert.deepEqual(store.get(state.id), restarted.state);
    for (const gold of ["80", "250"]) {
      store.db.prepare("UPDATE players SET rolls_used = 99, gold = ? WHERE id = ?").run(gold, state.id);
      act({ kind: "roll", wagers: { red: "1", black: "1" } });
      assert.equal(store.leaderboard()[0].bestGold, gold === "80" ? "100" : "250");
      act({ kind: "restart" });
    }
    store.db.prepare("UPDATE players SET rolls_used = 99, probabilities = ? WHERE id = ?")
      .run(JSON.stringify([0.09, 0.03, 0.4, 0.2, 0.15, 0.13]), state.id);
    const jackpotFinish = act({ kind: "roll", wagers: { n2: "10" } });
    assert.equal(jackpotFinish.result!.jackpot, true);
    assert.equal(jackpotFinish.state.rollsUsed, 100);
    assert.equal(jackpotFinish.state.bestGold, "330");
    assert.equal(jackpotFinish.state.canShake, false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("early bankruptcy is unranked; bankruptcy on roll 100 submits a zero score", () => {
  const store = new Store(":memory:", () => 0.1);
  try {
    const { state } = store.create();
    fixture(store, state.id);
    const act = (action: Action) => store.act(state.id, request(store.get(state.id).revision, action));
    const lost = act({ kind: "roll", wagers: { n6: "100" } });
    assert.equal(lost.state.gold, "0");
    assert.equal(lost.state.rollsUsed, 1);
    assert.deepEqual(store.leaderboard(), []);
    assert.throws(() => act({ kind: "shake" }), /run has ended/);
    assert.equal(act({ kind: "restart" }).state.rollsUsed, 0);
    store.db.prepare("UPDATE players SET rolls_used = 99 WHERE id = ?").run(state.id);
    const final = act({ kind: "roll", wagers: { n6: "100" } });
    assert.equal(final.state.gold, "0");
    assert.equal(final.state.hasCompletedRun, true);
    assert.equal(store.leaderboard()[0].bestGold, "0");
  } finally {
    store.close();
  }
});
test("completion preserves the previous personal best, and a named restart is atomic and retry-safe", () => {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-results-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  try {
    const { state, token } = store.create();
    for (const [gold, previous, best] of [["0", null, "0"], ["250", "0", "250"], ["80", "250", "250"], ["250", "250", "250"]]) {
      store.db.prepare("UPDATE players SET rolls_used = 99, gold = ?, probabilities = ? WHERE id = ?")
        .run(gold === "0" ? "1" : gold, JSON.stringify(p), state.id);
      const final = store.act(state.id, request(store.get(state.id).revision, {
        kind: "roll", wagers: gold === "0" ? { n6: "1" } : { red: "1", black: "1" },
      }));
      assert.equal(final.state.gold, gold);
      assert.equal(final.state.previousBestGold, previous);
      assert.equal(final.state.bestGold, best);
      store.close();
      store = new Store(path, () => 0.1);
      assert.deepEqual(store.session(token), final.state);
      const confirm = request(final.state.revision, { kind: "restart", nickname: "  Finisher  " });
      assert.throws(() => store.act(state.id, { ...confirm, action: { kind: "restart", nickname: "\n" } }), /nickname/);
      assert.deepEqual(store.get(state.id), final.state);
      const next = store.act(state.id, confirm);
      assert.equal(next.state.nickname, "Finisher");
      assert.equal(next.state.gold, "100");
      assert.equal(next.state.rollsUsed, 0);
      assert.equal(next.state.previousBestGold, null);
      assert.equal(next.state.bestGold, best);
      assert.deepEqual(store.act(state.id, confirm), next);
      assert.equal(store.leaderboard().find(row => row.id === state.id)!.nickname, "Finisher");
    }
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the results migration preserves competition players, scores and receipts", () => {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-results-migration-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  try {
    const { state, token } = store.create();
    fixture(store, state.id, "320", "400");
    store.db.prepare("UPDATE players SET rolls_used = 100 WHERE id = ?").run(state.id);
    const rename = request("0", { kind: "nickname", nickname: "Existing player" });
    const receipt = store.act(state.id, rename);
    store.db.exec("ALTER TABLE players DROP COLUMN previous_best_gold; PRAGMA user_version = 1");
    store.close();
    store = new Store(path);
    const migrated = { ...receipt.state, previousBestGold: "400" };
    assert.deepEqual(store.session(token), migrated);
    assert.deepEqual(store.act(state.id, rename), receipt);
    assert.equal(store.leaderboard()[0].bestGold, "400");
    assert.equal(store.db.prepare("PRAGMA user_version").get()!.user_version, 3);
    store.close();
    store = new Store(path);
    assert.deepEqual(store.session(token), migrated);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("large integer balances persist, settle, transport as strings and rank numerically", () => {
  const dir = mkdtempSync(join(tmpdir(), "one-six-big-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  try {
    const a = store.create().state;
    const b = store.create().state;
    const c = store.create().state;
    fixture(store, a.id, "9007199254740993", "9007199254740993");
    fixture(store, b.id, "100000000000000000000000000000001", "100000000000000000000000000000001");
    fixture(store, c.id, "9007199254740992", "9007199254740992");
    assert.deepEqual(
      store.leaderboard().map((x) => x.id),
      [b.id, a.id, c.id],
    );
    const r = store.act(
      a.id,
      request("0", { kind: "roll", wagers: { n1: "9007199254740993" } }),
    );
    assert.equal(r.state.gold, "54043195528445958");
    assert.equal(JSON.parse(JSON.stringify(r)).state.gold, "54043195528445958");
    store.close();
    store = new Store(path);
    assert.equal(store.get(a.id).gold, "54043195528445958");
    assert.deepEqual(
      store.leaderboard().map((x) => x.id),
      [b.id, a.id, c.id],
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("leaderboard returns top 10 plus the player's best and two above, without duplicate ranks", async () => {
  const store = new Store(":memory:");
  const server = createGameServer(store);
  try {
    const players = Array.from({ length: 65 }, (_, index) => {
      const player = store.create();
      // Include scores beyond Number and SQLite integer precision.
      fixture(store, player.state.id, "100", (10n ** 30n - BigInt(index)).toString());
      return player;
    });
    const top = Array.from({ length: 10 }, (_, i) => i + 1);
    const ranks = (id?: string) => store.leaderboard(id).map(row => row.rank);
    assert.deepEqual(ranks(), top);
    assert.deepEqual(ranks(players[0].state.id), top);
    assert.deepEqual(ranks(players[9].state.id), top);
    assert.deepEqual(ranks(players[10].state.id), [...top, 11]);
    assert.deepEqual(ranks(players[11].state.id), [...top, 11, 12]);
    assert.deepEqual(ranks(players[12].state.id), [...top, 11, 12, 13]);
    assert.deepEqual(ranks(players[60].state.id), [...top, 59, 60, 61]);
    const unranked = store.create();
    assert.deepEqual(ranks(unranked.state.id), top);
    assert.deepEqual(ranks("unknown"), top);
    fixture(store, players[64].state.id, "100", "0");
    store.db.prepare("UPDATE players SET has_completed_run = 1 WHERE id = ?").run(players[64].state.id);
    assert.equal(store.leaderboard(players[64].state.id).at(-1)!.bestGold, "0");
    // Ties retain deterministic player-ID ordering, including the two neighbors.
    const tied = players.slice(58, 62).map(player => player.state.id).sort();
    for (const id of tied) fixture(store, id, "100", (10n ** 30n - 58n).toString());
    const nearby = store.leaderboard(tied[3]).slice(-3);
    assert.deepEqual(nearby.map(row => row.id), tied.slice(1));
    assert.deepEqual(nearby.map(row => row.rank), [60, 61, 62]);

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}/api/leaderboard`;
    const anonymous = await (await fetch(url)).json();
    assert.deepEqual(anonymous.map((row: { rank: number }) => row.rank), top);
    const personal = await (await fetch(url, {
      headers: { Cookie: `one_of_six=${players[63].token}` },
    })).json();
    assert.deepEqual(personal.map((row: { rank: number }) => row.rank), [...top, 62, 63, 64]);
    assert.equal(personal.at(-1).id, players[63].state.id);
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
  }
});

test("server validates identity, payload, names and never accepts submitted scores", () => {
  const store = new Store(":memory:");
  try {
    const { state, token } = store.create();
    assert.equal(store.session(token)?.id, state.id);
    assert.equal(store.session("invalid"), null);
    assert.equal(store.session("a".repeat(64)), null);
    for (const bad of [
      null,
      {},
      [],
      { ...request("0", { kind: "shake" }), gold: "999" },
      request("0", { kind: "shake", score: "999" } as Action),
      request("0", { kind: "nickname", nickname: "\n" }),
      request("0", { kind: "nickname", nickname: "a".repeat(25) }),
    ])
      assert.throws(() => store.act(state.id, bad as ActionRequest));
    assert.equal(store.get(state.id).revision, "0");
    assert.equal(store.get(state.id).gold, "100");
  } finally {
    store.close();
  }
});
test("HTTP: independent sessions, concurrent duplicates, stale tab, lost response and server restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "one-six-http-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  let server = createGameServer(store);
  const start = async () => {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  };
  const stop = () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  let url = await start();
  const post = (cookie: string, req: ActionRequest) =>
    fetch(url + "/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie, Origin: url },
      body: JSON.stringify(req),
    });
  try {
    const first = await fetch(url + "/api/state");
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    const a = (await first.json()) as PlayerState;
    const second = await fetch(url + "/api/state");
    const b = (await second.json()) as PlayerState;
    assert.notEqual(a.id, b.id);
    fixture(store, a.id);
    const locked = await post(cookie, request("0", { kind: "shake" }));
    assert.equal(locked.status, 400);
    const rejected = await locked.json();
    assert.equal(rejected.state.canShake, false);
    assert.equal(rejected.state.revision, "0");
    assert.match(rejected.error, /changes your bankroll/);
    const roll = request("0", { kind: "roll", wagers: { n1: "10" } });
    const pair = await Promise.all([post(cookie, roll), post(cookie, roll)]);
    assert.ok(pair.every((r) => r.status === 200));
    const results = (await Promise.all(
      pair.map((r) => r.json()),
    )) as ActionResponse[];
    assert.deepEqual(results[0], results[1]);
    assert.equal(results[0].state.gold, "150");
    assert.equal(
      (await post(cookie, request("0", { kind: "shake" }))).status,
      409,
    );
    const loss = request("1", { kind: "roll", wagers: { n2: "10" } });
    await post(cookie, loss); // caller loses the response
    const recovered = (await (
      await post(cookie, loss)
    ).json()) as ActionResponse;
    assert.equal(recovered.state.gold, "140");
    assert.equal(recovered.state.revision, "2");
    const board = await (await fetch(url + "/api/leaderboard")).json();
    assert.deepEqual(board, []);
    assert.equal(recovered.state.rollsUsed, 2);
    assert.equal((await post("", request("0", { kind: "shake" }))).status, 401);
    assert.equal(
      (
        await fetch(url + "/api/action", {
          method: "POST",
          headers: {
            cookie,
            "Content-Type": "application/json",
            Origin: "https://other.example",
          },
          body: JSON.stringify(request("2", { kind: "shake" })),
        })
      ).status,
      403,
    );
    await stop();
    store.close();
    store = new Store(path, () => 0.99);
    server = createGameServer(store);
    url = await start();
    const resumed = await (
      await fetch(url + "/api/state", { headers: { cookie } })
    ).json();
    assert.deepEqual(resumed, recovered.state);
    const retried = await (await post(cookie, roll)).json();
    assert.deepEqual(retried, results[0]);
    assert.equal(store.get(a.id).gold, "140");
    fixture(store, b.id, "100000000000000000000000000000001", "100000000000000000000000000000001");
    const largeBoard = await (await fetch(url + "/api/leaderboard")).json();
    assert.equal(largeBoard[0].id, b.id);
    assert.equal(largeBoard[0].bestGold, "100000000000000000000000000000001");
    store.db.prepare("UPDATE players SET rolls_used = 99 WHERE id = ?").run(a.id);
    const completions = [0, 1].map(() => request("2", {
      kind: "roll", wagers: { red: "1", black: "1" },
    }));
    const racing = await Promise.all(completions.map(action => post(cookie, action)));
    assert.deepEqual(racing.map(response => response.status).sort(), [200, 409]);
    const winner = racing.findIndex(response => response.status === 200);
    const finished = await racing[winner].json();
    assert.equal(finished.state.rollsUsed, 100);
    assert.equal(finished.state.bestGold, "140");
    assert.deepEqual(await (await post(cookie, completions[winner])).json(), finished);
    assert.equal(store.get(a.id).rollsUsed, 100);
    assert.equal(store.leaderboard().find(player => player.id === a.id)!.bestGold, "140");
  } finally {
    await stop();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Shake requires a settled change since reset; break-even, names and retries cannot earn it", () => {
  const store = new Store(":memory:", () => 0.1);
  try {
    const { state } = store.create();
    fixture(store, state.id);
    const act = (action: Action) => store.act(state.id, request(store.get(state.id).revision, action));
    const all = Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`n${n}`, "10"]));
    assert.equal(store.get(state.id).canShake, false);
    assert.throws(() => act({ kind: "shake" }), /changes your bankroll/);
    const even = act({ kind: "roll", wagers: all });
    assert.equal(even.state.gold, "100");
    assert.equal(even.state.canShake, false);
    assert.notDeepEqual(even.state.probabilities, p);
    assert.throws(() => act({ kind: "shake" }), /changes your bankroll/);
    assert.equal(act({ kind: "nickname", nickname: "No shortcut" }).state.canShake, false);
    const loss = act({ kind: "roll", wagers: { n2: "1" } });
    assert.equal(loss.state.gold, "99");
    assert.equal(loss.state.canShake, true);
    const firstShake = request(loss.state.revision, { kind: "shake" });
    const reset = store.act(state.id, firstShake);
    assert.equal(reset.state.gold, "99");
    assert.equal(reset.state.canShake, false);
    assert.deepEqual(store.act(state.id, firstShake), reset);
    assert.throws(() => act({ kind: "shake" }), /changes your bankroll/);
    const win = act({ kind: "roll", wagers: { red: "1" } });
    assert.equal(win.state.gold, "100");
    assert.equal(win.state.canShake, true);
    const back = act({ kind: "roll", wagers: { n2: "1" } });
    assert.equal(back.state.gold, "99"); // Same balance as the reset still qualifies.
    assert.equal(back.state.canShake, true);
    assert.equal(act({ kind: "roll", wagers: all }).state.canShake, true);
    const secondReset = act({ kind: "shake" });
    assert.equal(secondReset.state.canShake, false);
    store.act(state.id, firstShake); // An old receipt cannot restore its entitlement.
    assert.deepEqual(store.get(state.id), secondReset.state);
    assert.throws(() => act({ kind: "shake" }), /changes your bankroll/);
  } finally {
    store.close();
  }
});

test("Jackpot's automatic reset consumes the bankroll change and locks the new board", () => {
  let draw = 0.1;
  const store = new Store(":memory:", () => draw);
  try {
    const { state } = store.create();
    fixture(store, state.id);
    const win = store.act(state.id, request("0", { kind: "roll", wagers: { n1: "1" } }));
    assert.equal(win.state.canShake, true);
    draw = 0.999;
    store.db.prepare("UPDATE players SET probabilities = ? WHERE id = ?").run(JSON.stringify([0.4, 0.2, 0.15, 0.12, 0.1, 0.03]), state.id);
    const jackpot = store.act(state.id, request("1", { kind: "roll", wagers: { n6: "10" } }));
    assert.equal(jackpot.result!.jackpot, true);
    assert.equal(jackpot.state.gold, "335");
    assert.equal(jackpot.state.canShake, false);
    assert.throws(() => store.act(state.id, request("2", { kind: "shake" })), /changes your bankroll/);
  } finally {
    store.close();
  }
});

test("legacy endless-game data is rejected without deleting saves or receipts", () => {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-legacy-"));
  const path = join(dir, "game.sqlite");
  const store = new Store(path, () => 0.1);
  const { state, token } = store.create();
  store.act(state.id, request("0", { kind: "nickname", nickname: "Legacy player" }));
  store.db.exec("PRAGMA user_version=0");
  store.close();
  try {
    assert.throws(() => new Store(path), /cannot be reset automatically/);
    const database = new DatabaseSync(path, { readOnly: true });
    try {
      assert.equal(database.prepare("SELECT count(*) AS n FROM players").get()!.n, 1);
      assert.equal(database.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 1);
      assert.equal(database.prepare("SELECT nickname FROM players WHERE id=?").get(state.id)!.nickname, "Legacy player");
      assert.equal(database.prepare("PRAGMA user_version").get()!.user_version, 0);
    } finally { database.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
