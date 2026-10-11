import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalGame, SAVE_KEY, RECOVERY_KEY, SETTINGS_JOURNAL_KEY, decodeSave, StaleRunError } from "../src/save.ts";
import { compareRecords, recordCompletion, transition, type PersonalRecord } from "../src/game/run.ts";
import { browserRandom } from "../src/game/random.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function fixture() {
  const storage = new MemoryStorage();
  let ids = 0;
  const makeId = () => (++ids).toString(16).padStart(32, "0");
  const game = new LocalGame(() => storage, () => .1, makeId);
  game.data.state.probabilities = [.4, .2, .15, .1, .1, .05];
  return { storage, game, makeId };
}
const record = (score: string, order: number): PersonalRecord => ({
  score, order: String(order), nickname: "Player", id: order.toString(16).padStart(32, "0"),
});

test("local settlement persists exact Gold, odds, rolls and last result before returning", async () => {
  const { storage, game } = fixture();
  game.data.state.gold = "9007199254740993";
  const response = await game.act(game.data.state, { kind: "roll", wagers: { n1: "9007199254740993" } });
  assert.equal(response.state.gold, "54043195528445958");
  const durable = decodeSave(storage.getItem(SAVE_KEY)!);
  assert.deepEqual(durable.state, response.state);
  const reopened = new LocalGame(() => storage);
  assert.deepEqual(reopened.data, durable);
});

test("board net accumulates gains and losses, survives reload, and resets on die replacement", async () => {
  const { game, storage, makeId } = fixture();
  const net = (state: typeof game.data.state) => BigInt(state.gold) - BigInt(state.boardStartingGold);
  await game.act(game.data.state, { kind: "roll", wagers: { red: "10" } });
  assert.equal(net(game.data.state), 10n);
  await game.act(game.data.state, { kind: "roll", wagers: { black: "4" } });
  assert.equal(net(game.data.state), 6n);
  await game.act(game.data.state, { kind: "roll", wagers: { red: "1", black: "1" } });
  assert.equal(net(game.data.state), 6n);
  const reopened = new LocalGame(() => storage, () => .1, makeId);
  assert.equal(net(reopened.data.state), 6n);
  await reopened.act(reopened.data.state, { kind: "shake" });
  assert.equal(reopened.data.state.gold, "106");
  assert.equal(net(reopened.data.state), 0n);
  assert.equal(net(new LocalGame(() => storage).data.state), 0n);
  await reopened.act(reopened.data.state, { kind: "roll", wagers: { n2: "3" } });
  assert.equal(net(reopened.data.state), -3n);
  await reopened.act(reopened.data.state, { kind: "roll", wagers: { n1: "1" } });
  assert.equal(reopened.data.state.lastRoll?.jackpot, true);
  assert.equal(reopened.data.state.gold, "126");
  assert.equal(net(reopened.data.state), 0n);
  await reopened.act(reopened.data.state, { kind: "restart" });
  assert.equal(reopened.data.state.boardStartingGold, "100");
  assert.equal(net(reopened.data.state), 0n);
});

test("older saves preserve progress and records while initializing board net without guessing", () => {
  const legacy = fixture().game.data;
  legacy.state.gold = (10n ** 80n + 1n).toString();
  legacy.state.rollsUsed = 20;
  legacy.records = [record("999", 1)];
  const { boardStartingGold: _baseline, ...oldState } = legacy.state;
  const raw = JSON.stringify({ ...legacy, state: oldState });
  const restored = decodeSave(raw);
  assert.equal(restored.state.boardStartingGold, legacy.state.gold);
  assert.equal(restored.state.rollsUsed, 20);
  assert.deepEqual(restored.records, legacy.records);
  for (const value of [null, -1, "-1", "1.5", "01", 100])
    assert.throws(() => decodeSave(JSON.stringify({ ...legacy, state: { ...oldState, boardStartingGold: value } })), /Invalid saved run/);
});

test("mobile action preference defaults for older saves and validates persisted values", async () => {
  const { game, storage } = fixture();
  const { swapMobileActions: _preference, ...legacySettings } = game.data.settings;
  const legacy = { ...game.data, settings: legacySettings };
  assert.equal(decodeSave(JSON.stringify(legacy)).settings.swapMobileActions, false);
  await game.updateSettings({ swapMobileActions: true });
  assert.equal(new LocalGame(() => storage).data.settings.swapMobileActions, true);
  for (const invalid of [null, 0, "true", {}])
    assert.throws(() => decodeSave(JSON.stringify({ ...legacy, settings: { ...legacySettings, swapMobileActions: invalid } })), /Invalid saved settings/);
});

test("100th roll records the final bankroll exactly once, including after repeated reload", async () => {
  const { storage, game } = fixture();
  game.data.state.rollsUsed = 99;
  game.data.state.gold = "1234567890123456789012345678901234567890";
  const response = await game.act(game.data.state, { kind: "roll", wagers: { red: "1", black: "1" } });
  assert.equal(response.state.rollsUsed, 100);
  assert.equal(game.data.records[0].score, response.state.gold);
  assert.equal(response.state.previousBestGold, null);
  for (let i = 0; i < 3; i++) assert.equal(new LocalGame(() => storage).data.records.length, 1);
  assert.equal(recordCompletion(response.state, game.data.records).length, 1);
  await assert.rejects(game.act(response.state, { kind: "roll", wagers: { n1: "1" } }), /ended/);
  assert.equal(game.data.records.length, 1);
});

test("zero is a valid final score; early bankruptcy and assisted runs never enter records", async () => {
  for (const [rolls, eligible, expected] of [[99, true, 1], [98, true, 0], [99, false, 0]] as const) {
    const { game } = fixture();
    game.data.state.rollsUsed = rolls;
    game.data.state.gold = "1";
    game.data.state.leaderboardEligible = eligible;
    await game.act(game.data.state, { kind: "roll", wagers: { n6: "1" } });
    assert.equal(game.data.state.gold, "0");
    assert.equal(game.data.records.length, expected);
    assert.equal(game.data.state.hasCompletedRun, expected === 1);
  }
});

test("top ten compare unbounded integers, resolve ties by completion order and keep a receipt below the cutoff", () => {
  const { game } = fixture();
  const huge = 10n ** 80n;
  const records = Array.from({ length: 12 }, (_, i) => record((huge + BigInt(i)).toString(), i + 1));
  records.push(record((huge + 11n).toString(), 13));
  records.sort(compareRecords);
  assert.equal(records[0].order, "12");
  assert.equal(records[1].order, "13");
  assert.equal(records[2].score, (huge + 10n).toString());
  const state = game.data.state;
  state.rollsUsed = 100;
  state.revision = "50";
  const top = recordCompletion(state, records.slice(0, 10));
  assert.equal(top.length, 10);
  assert.ok(!top.some(record => record.id === state.id));
  assert.equal(state.recorded, true);
  assert.deepEqual(recordCompletion(state, top), top);
});

test("restart retains records, best score and settings while resetting run flags and identity", async () => {
  const { game, storage } = fixture();
  game.data.state.rollsUsed = 99;
  await game.updateSettings({ sound: false, reducedMotion: true, swapMobileActions: true, guideLanguage: "ko", guideSeen: true, recentAmounts: ["5", "10"] });
  await game.act(game.data.state, { kind: "roll", wagers: { red: "1", black: "1" } });
  const oldId = game.data.state.id;
  const settings = structuredClone(game.data.settings);
  await game.act(game.data.state, { kind: "restart", nickname: "Finisher" });
  assert.notEqual(game.data.state.id, oldId);
  assert.equal(game.data.state.gold, "100");
  assert.equal(game.data.state.rollsUsed, 0);
  assert.equal(game.data.state.bestGold, "100");
  assert.equal(game.data.state.lastRoll, null);
  assert.equal(game.data.state.canShake, false);
  assert.equal(game.data.state.showProbabilities, false);
  assert.equal(game.data.state.leaderboardEligible, true);
  assert.equal(game.data.state.recorded, false);
  assert.equal(game.data.records[0].nickname, "Finisher");
  assert.deepEqual(game.data.settings, settings);
  assert.deepEqual(new LocalGame(() => storage).data, game.data);
});

test("probability exclusion survives hiding, Shake, reload and is cleared only by restart", async () => {
  const { game, storage } = fixture();
  await game.act(game.data.state, { kind: "probabilities", enabled: true });
  await game.act(game.data.state, { kind: "probabilities", enabled: false });
  await game.act(game.data.state, { kind: "roll", wagers: { n1: "1" } });
  await game.act(game.data.state, { kind: "shake" });
  const reopened = new LocalGame(() => storage);
  assert.equal(reopened.data.state.leaderboardEligible, false);
  assert.equal(reopened.data.state.showProbabilities, false);
  await reopened.act(reopened.data.state, { kind: "restart" });
  assert.equal(reopened.data.state.leaderboardEligible, true);
});

test("Shake entitlement survives break-even rolls and return to old bankroll; Jackpot consumes it", () => {
  const { game } = fixture();
  const original = game.data.state;
  assert.throws(() => transition(original, { kind: "shake" }, () => .1, original.id), /unlocks/);
  const won = transition(original, { kind: "roll", wagers: { red: "1" } }, () => .1, original.id).state;
  assert.equal(won.canShake, true);
  const lost = transition(won, { kind: "roll", wagers: { black: "1" } }, () => .1, won.id).state;
  assert.equal(lost.gold, original.gold);
  assert.equal(lost.canShake, true);
  const even = transition(lost, { kind: "roll", wagers: { red: "1", black: "1" } }, () => .1, lost.id).state;
  assert.equal(even.canShake, true);
  const jackpot = transition(original, { kind: "roll", wagers: { n6: "1" } }, () => .99, original.id).state;
  assert.equal(jackpot.lastRoll?.jackpot, true);
  assert.equal(jackpot.canShake, false);
});

test("invalid actions do not change a save or consume randomness", async () => {
  const { game, storage } = fixture();
  const before = storage.getItem(SAVE_KEY);
  await assert.rejects(game.act(game.data.state, { kind: "roll", wagers: { n1: "101" } }), /exceed/);
  await assert.rejects(game.act(game.data.state, { kind: "nickname", nickname: "\u0001" }), /visible/);
  await assert.rejects(game.act(game.data.state, { kind: "restart", nickname: "" }), /visible/);
  assert.equal(storage.getItem(SAVE_KEY), before);
});

test("malformed, truncated, incompatible and structurally invalid saves recover without touching other origin data", () => {
  const good = JSON.stringify(fixture().game.data);
  const invalid = ["{", "null", '{"version":2}', good.replace('"gold":"100"', '"gold":100'), good.replace('"sound":true', '"sound":"yes"'), good.replace('"records":[]', '"records":[{}]'), good.replace('"probabilities":[0.4,0.2,0.15,0.1,0.1,0.05]', '"probabilities":[0,0,0,0,0,0]')];
  for (const raw of invalid) {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, raw);
    storage.setItem("homepage:settings", "keep");
    const game = new LocalGame(() => storage);
    assert.equal(game.data.state.gold, "100");
    assert.match(game.warning, /could not be read/);
    assert.equal(storage.getItem(RECOVERY_KEY), raw);
    assert.equal(storage.getItem("homepage:settings"), "keep");
    assert.doesNotThrow(() => decodeSave(storage.getItem(SAVE_KEY)!));
  }
});

test("unavailable getters, reads and quota-limited writes leave the game playable in memory", async () => {
  for (const access of [
    () => { throw new Error("blocked"); },
    () => ({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} }),
    () => ({ getItem: () => null, setItem: () => { throw new Error("quota"); } }),
  ]) {
    const game = new LocalGame(access, () => .1);
    await game.act(game.data.state, { kind: "roll", wagers: { red: "1", black: "1" } });
    assert.equal(game.data.state.rollsUsed, 1);
    assert.match(game.warning, /cannot be saved/);
    await game.act(game.data.state, { kind: "restart" });
    assert.equal(game.data.state.rollsUsed, 0);
  }
});

test("two queued actions with one expected board settle once; stale tabs cannot overwrite a restart", async () => {
  const { game, storage } = fixture();
  const expected = structuredClone(game.data.state);
  const results = await Promise.allSettled([
    game.act(expected, { kind: "roll", wagers: { red: "1", black: "1" } }),
    game.act(expected, { kind: "roll", wagers: { red: "1", black: "1" } }),
  ]);
  assert.deepEqual(results.map(result => result.status), ["fulfilled", "rejected"]);
  assert.equal(game.data.state.rollsUsed, 1);
  const other = new LocalGame(() => storage);
  const stale = structuredClone(other.data.state);
  await game.act(game.data.state, { kind: "restart" });
  await assert.rejects(other.act(stale, { kind: "roll", wagers: { n1: "1" } }), StaleRunError);
  assert.equal(other.data.state.id, game.data.state.id);
  assert.equal(decodeSave(storage.getItem(SAVE_KEY)!).state.rollsUsed, 0);
});

test("Web Crypto draws use the same 48-bit uniform grid without Node APIs", () => {
  const original = crypto.getRandomValues;
  try {
    crypto.getRandomValues = ((array: Uint8Array) => { array.fill(255); return array; }) as typeof crypto.getRandomValues;
    assert.equal(browserRandom(), (2 ** 48 - 1) / 2 ** 48);
    crypto.getRandomValues = ((array: Uint8Array) => { array.fill(0); return array; }) as typeof crypto.getRandomValues;
    assert.equal(browserRandom(), 0);
  } finally { crypto.getRandomValues = original; }
});

test("navigation journals queued preferences without overwriting a newer run and replays them after reload", async () => {
  const { game, storage } = fixture();
  const other = new LocalGame(() => storage);
  await other.act(other.data.state, { kind: "roll", wagers: { red: "1", black: "1" } });
  const durableRun = storage.getItem(SAVE_KEY);
  const pending = game.updateSettings({ guideLanguage: "ko", sound: false });
  game.stageSettings(); // Before the queued lock callback can execute.
  assert.equal(storage.getItem(SAVE_KEY), durableRun);
  assert.ok(storage.getItem(SETTINGS_JOURNAL_KEY));
  const reopened = new LocalGame(() => storage);
  assert.equal(reopened.data.state.rollsUsed, 1);
  assert.equal(reopened.data.settings.guideLanguage, "ko");
  await pending;
  await reopened.updateSettings({});
  const saved = decodeSave(storage.getItem(SAVE_KEY)!);
  assert.equal(saved.state.rollsUsed, 1);
  assert.equal(saved.settings.guideLanguage, "ko");
  assert.equal(saved.settings.sound, false);
  assert.equal(storage.getItem(SETTINGS_JOURNAL_KEY), null);
});
