import { test } from "node:test";
import assert from "node:assert/strict";
import { Tutorial } from "../src/game/tutorial.ts";
import { TARGETS } from "../src/config.ts";

test("practice covers every group, pays real overlapping bets and charges one turn", () => {
  for (const group of TARGETS.filter(target => target.kind !== "number")) {
    const tutorial = new Tutorial();
    tutorial.bet("n3");
    tutorial.bet(group.id);
    assert.equal(tutorial.canRoll, true);
    tutorial.roll();
    const groupReturn = group.coverage.includes(3) ? group.multiplier * 10 : 0;
    assert.equal(tutorial.result?.outcome, 3);
    assert.equal(tutorial.result?.totalReturn, String(60 + groupReturn));
    assert.equal(tutorial.state.gold, String(100 - 20 + 60 + groupReturn));
    assert.equal(tutorial.state.rollsUsed, 1);
    assert.equal(tutorial.state.canShake, true);
    assert.deepEqual(tutorial.wagers, {});
    assert.equal(tutorial.result?.transferred, true);
    assert.equal(tutorial.result?.jackpot, false);
  }
});

test("guided Shake costs no Gold or turn, resets net, and the solo rare bet really Jackpots", () => {
  const tutorial = new Tutorial();
  tutorial.bet("n3");
  tutorial.bet("row0");
  tutorial.roll();
  const before = structuredClone(tutorial.state);
  tutorial.continue();
  tutorial.shake();
  assert.equal(tutorial.phase, "jackpot");
  assert.equal(tutorial.state.gold, before.gold);
  assert.equal(tutorial.state.rollsUsed, before.rollsUsed);
  assert.equal(tutorial.state.boardStartingGold, before.gold);
  assert.equal(tutorial.state.canShake, false);
  assert.notDeepEqual(tutorial.state.probabilities, before.probabilities);
  const rare = tutorial.state.jackpotNumber;
  tutorial.bet(`n${rare}`);
  tutorial.bet("red"); // Extra bets are unavailable during this solo exercise.
  assert.deepEqual(tutorial.wagers, { [`n${rare}`]: "10" });
  tutorial.roll();
  assert.equal(tutorial.phase, "complete");
  assert.equal(tutorial.result?.jackpot, true);
  assert.equal(tutorial.result?.totalReturn, "240");
  assert.equal(tutorial.state.gold, "390");
  assert.equal(tutorial.state.rollsUsed, 2);
  assert.equal(tutorial.state.boardStartingGold, "390");
  assert.equal(tutorial.state.recorded, false);
});

test("lessons require the player's bets, allow comparisons, and ignore repeated completed actions", () => {
  const tutorial = new Tutorial();
  const initial = structuredClone(tutorial.state);
  tutorial.roll(); tutorial.shake(); tutorial.continue(); tutorial.bet("red"); tutorial.bet("n6");
  assert.deepEqual(tutorial.state, initial);
  assert.equal(tutorial.phase, "number");
  tutorial.bet("n3");
  tutorial.roll();
  assert.equal(tutorial.phase, "coverage");
  assert.equal(tutorial.canRoll, false);
  tutorial.bet("row0"); tutorial.bet("row0"); tutorial.bet("red");
  assert.deepEqual(tutorial.wagers, { n3: "10", row0: "20", red: "10" });
  tutorial.remove("row0"); tutorial.remove("red");
  assert.equal(tutorial.canRoll, false);
  tutorial.bet("col1");
  assert.deepEqual(tutorial.wagers, { n3: "10", col1: "10" });
  tutorial.roll();
  const settled = structuredClone(tutorial.state);
  tutorial.roll(); tutorial.bet("red"); tutorial.shake();
  assert.deepEqual(tutorial.state, settled);
  assert.equal(tutorial.phase, "result");
  assert.deepEqual(new Tutorial().state, initial);
});

test("practice adds repeated bets with exact limits and removes a whole group like the game", () => {
  const tutorial = new Tutorial();
  tutorial.bet("n3");
  for (let i = 0; i < 20; i++) tutorial.bet("row0");
  assert.deepEqual(tutorial.wagers, { n3: "10", row0: "90" });
  tutorial.remove("n3");
  assert.equal(tutorial.wagers.n3, "10");
  tutorial.remove("row0");
  assert.deepEqual(tutorial.wagers, { n3: "10" });
  assert.equal(tutorial.canRoll, false);
});

test("the main game action adapter accepts the real Bet amount and gates unrelated saved-run actions", () => {
  const tutorial = new Tutorial();
  assert.equal(tutorial.canAct({ kind: "restart" }), false);
  assert.equal(tutorial.canAct({ kind: "probabilities", enabled: true }), false);
  tutorial.bet("n3", "20");
  tutorial.bet("row0", "5");
  const rolled = tutorial.act({ kind: "roll", wagers: { ...tutorial.wagers } });
  assert.equal(rolled.result?.stake, "25");
  assert.equal(rolled.result?.totalReturn, "130");
  assert.equal(rolled.state.gold, "205");
  tutorial.continue();
  const shaken = tutorial.act({ kind: "shake" });
  assert.equal(shaken.result, null);
  assert.equal(shaken.state.gold, "205");
  assert.equal(shaken.state.rollsUsed, 1);
  tutorial.bet(`n${tutorial.state.jackpotNumber}`, "7");
  const jackpot = tutorial.act({ kind: "roll", wagers: { ...tutorial.wagers } });
  assert.equal(jackpot.result?.jackpot, true);
  assert.equal(jackpot.result?.totalReturn, "168");
  assert.equal(jackpot.state.gold, "366");
});
