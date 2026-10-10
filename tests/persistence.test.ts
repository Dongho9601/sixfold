import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { Store } from "../server/store.ts";
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
function fixture(store: Store, id: string, gold = "100", best = gold) {
  store.db
    .prepare(
      "UPDATE players SET gold = ?, best_gold = ?, probabilities = ? WHERE id = ?",
    )
    .run(gold, best, JSON.stringify(p), id);
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
    assert.equal(response.state.bestGold, "150");
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
    assert.equal(store.leaderboard()[0].nickname, "Ada");
    const action = request(named.state.revision, { kind: "shake" });
    const next = store.act(state.id, action);
    assert.equal(next.state.gold, "150");
    assert.equal(next.state.bestGold, "150");
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
    assert.equal(lost.state.canShake, true);
    const restart = request("2", { kind: "restart" });
    const next = store.act(state.id, restart);
    assert.equal(next.state.gold, "100");
    assert.equal(next.state.bestGold, "180");
    assert.equal(next.state.lastRoll, null);
    assert.equal(next.state.canShake, false);
    assert.deepEqual(store.act(state.id, restart), next);
    assert.throws(
      () => store.act(state.id, request("3", { kind: "restart" })),
      /reaches zero/,
    );
  } finally {
    store.close();
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
    fixture(store, a.id, "9007199254740993");
    fixture(store, b.id, "100000000000000000000000000000001");
    fixture(store, c.id, "9007199254740992");
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
      headers: { "Content-Type": "application/json", cookie },
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
    assert.equal(board.length, 2);
    assert.equal(board[0].id, a.id);
    assert.equal(board[0].bestGold, "150");
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
    fixture(store, b.id, "100000000000000000000000000000001");
    const largeBoard = await (await fetch(url + "/api/leaderboard")).json();
    assert.equal(largeBoard[0].id, b.id);
    assert.equal(largeBoard[0].bestGold, "100000000000000000000000000000001");
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
    const jackpot = store.act(state.id, request("1", { kind: "roll", wagers: { n6: "10" } }));
    assert.equal(jackpot.result!.jackpot, true);
    assert.equal(jackpot.state.gold, "335");
    assert.equal(jackpot.state.canShake, false);
    assert.throws(() => store.act(state.id, request("2", { kind: "shake" })), /changes your bankroll/);
  } finally {
    store.close();
  }
});

test("legacy databases and receipts migrate without resetting Gold, odds or records", () => {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-migration-"));
  const path = join(dir, "game.sqlite");
  let store = new Store(path, () => 0.1);
  try {
    const { state, token } = store.create();
    fixture(store, state.id, "101", "900");
    const name = request("0", { kind: "nickname", nickname: "Existing player" });
    const previous = store.act(state.id, name);
    const old = JSON.parse(JSON.stringify(previous));
    delete old.state.canShake;
    delete old.state.tiltLevel;
    store.db.prepare("UPDATE receipts SET response = ? WHERE player_id = ?")
      .run(JSON.stringify(old), state.id);
    store.db.exec("ALTER TABLE players DROP COLUMN can_shake");
    store.close();
    store = new Store(path);
    assert.deepEqual(store.session(token), previous.state);
    assert.deepEqual(store.act(state.id, name), previous);
    assert.throws(() => store.act(state.id, request("1", { kind: "shake" })), /changes your bankroll/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
