import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIG } from "../src/config.ts";
import { freshProbabilities, marker, tiltLevel } from "../src/game/rules.ts";
import { newRun, transition } from "../src/game/run.ts";
import type { PlayerState } from "../src/types.ts";
import { seeded } from "./random.ts";

const assertFresh = (state: PlayerState) => {
  assert.ok(state.tiltLevel >= 3 && state.tiltLevel <= 6);
  assert.equal(state.tiltLevel, tiltLevel(state.probabilities));
  assert.equal(state.jackpotNumber, marker(state.probabilities));
  assert.equal(state.canShake, false);
  assert.ok(state.probabilities.every(value => value >= CONFIG.probabilityFloor));
  assert.ok(Math.abs(state.probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-12);
};

test("fresh boards reject Tilt 1 and 2, then accept each of Tilt 3, 4, 5 and 6", () => {
  const board = (peak: number) => [peak, ...Array(5).fill((1 - peak) / 5)];
  // Invert the exponential draw to supply candidates with known probabilities.
  const drawsFor = (p: number[]) => p.map(value =>
    -Math.expm1(-(value - CONFIG.probabilityFloor) / (1 - 6 * CONFIG.probabilityFloor)));
  for (const [index, peak] of [.475, .5, .55, .7].entries()) {
    const expected = board(peak);
    const draws = [board(1 / 6), board(.4), expected].flatMap(drawsFor);
    let used = 0;
    const actual = freshProbabilities(() => {
      assert.ok(used < draws.length, "The valid candidate should be accepted");
      return draws[used++];
    });
    assert.equal(used, 18);
    assert.equal(tiltLevel(actual), index + 3);
    actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-12));
  }
});

test("new runs, Shake, Jackpot replacements and restarts always start at Tilt 3–6", () => {
  for (let seed = 0; seed < 500; seed++) {
    const random = seeded(seed);
    const initial = newRun("first", "Player", random);
    assertFresh(initial);

    const earned = { ...initial, gold: "110", rollsUsed: 1, canShake: true };
    const shaken = transition(earned, { kind: "shake" }, random, initial.id).state;
    assertFresh(shaken);
    assert.equal(shaken.gold, earned.gold);
    assert.equal(shaken.rollsUsed, earned.rollsUsed);
    assert.equal(shaken.boardStartingGold, earned.gold);

    const face = initial.jackpotNumber;
    const outcomeDraw = initial.probabilities.slice(0, face - 1).reduce((a, b) => a + b, 0)
      + initial.probabilities[face - 1] / 2;
    let first = true;
    const jackpot = transition(initial, { kind: "roll", wagers: { [`n${face}`]: "1" } }, () => {
      if (first) { first = false; return outcomeDraw; }
      return random();
    }, initial.id).state;
    assert.equal(jackpot.lastRoll?.jackpot, true);
    assertFresh(jackpot);

    const restarted = transition(shaken, { kind: "restart" }, random, "next").state;
    assertFresh(restarted);
    assert.equal(restarted.gold, CONFIG.startingGold);
    assert.equal(restarted.rollsUsed, 0);
  }
});

test("paying rolls can develop a fresh high-Tilt board into Tilt 2 and then Tilt 1", () => {
  let state = newRun("first", "Player", seeded());
  assertFresh(state);
  const levels = new Set([state.tiltLevel]);
  const wagers = Object.fromEntries([1, 2, 3, 4, 5, 6].map(face => [`n${face}`, "1"]));
  while (state.tiltLevel > 1 && state.rollsUsed < CONFIG.rollsPerRun) {
    const face = state.probabilities.indexOf(Math.max(...state.probabilities));
    const outcomeDraw = state.probabilities.slice(0, face).reduce((a, b) => a + b, 0)
      + state.probabilities[face] / 2;
    let first = true;
    const next = transition(state, { kind: "roll", wagers }, () => {
      if (first) { first = false; return outcomeDraw; }
      return .5;
    }, state.id);
    assert.equal(next.result?.transferred, true);
    assert.equal(next.result?.jackpot, false);
    state = next.state;
    levels.add(state.tiltLevel);
  }
  assert.ok(levels.has(2), "Ordinary paying rolls must still be able to reach Tilt 2");
  assert.equal(state.tiltLevel, 1);
  assert.equal(state.gold, CONFIG.startingGold);
});
