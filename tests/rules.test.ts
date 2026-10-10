import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD, CONFIG, TARGETS, TARGET_BY_ID } from "../src/config.ts";
import {
  freshProbabilities,
  marker,
  parseGold,
  sample,
  settle,
  transfer,
  validateWagers,
} from "../server/rules.ts";
import type { Wagers } from "../src/types.ts";

const p = [0.4, 0.2, 0.15, 0.1, 0.1, 0.05];
const all: Wagers = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((n) => [`n${n}`, "10"]),
);
const near = (actual: readonly number[], expected: readonly number[]) =>
  actual.forEach((v, i) =>
    assert.ok(
      Math.abs(v - expected[i]) < 1e-12,
      `${i}: ${v} != ${expected[i]}`,
    ),
  );
const land =
  (outcome: number, probabilities = p) =>
  () =>
    (probabilities.slice(0, outcome - 1).reduce((a, b) => a + b, 0) +
      probabilities[outcome - 1] / 2) /
    probabilities.reduce((a, b) => a + b, 0);

test("all 13 targets derive from the requested board mapping", () => {
  assert.deepEqual(
    BOARD.map((r) => r.map((c) => c.number)),
    [
      [1, 3, 5],
      [2, 4, 6],
    ],
  );
  assert.equal(TARGETS.length, 13);
  const expected = {
    row0: [1, 3, 5],
    row1: [2, 4, 6],
    col0: [1, 2],
    col1: [3, 4],
    col2: [5, 6],
    red: [1, 4, 5],
    black: [2, 3, 6],
  };
  for (const [id, coverage] of Object.entries(expected))
    assert.deepEqual(TARGET_BY_ID.get(id)!.coverage, coverage);
});
for (const target of TARGETS) {
  test(`target ${target.id}: all six outcomes pay only covered numbers`, () => {
    for (let outcome = 1; outcome <= 6; outcome++) {
      const result = settle(100n, p, { [target.id]: "10" }, land(outcome));
      const multiplier =
        target.id === "n6" && outcome === 6 ? 24 : target.multiplier;
      assert.equal(
        result.result.totalReturn,
        target.coverage.includes(outcome) ? String(10 * multiplier) : "0",
      );
    }
  });
}
test("ordinary 10 G hit from 100 settles 150; one draw and one transfer", () => {
  let draws = 0;
  const result = settle(100n, p, { n1: "10" }, () => {
    draws++;
    return 0.1;
  });
  assert.equal(draws, 1);
  assert.equal(result.gold, 150n);
  assert.equal(result.result.net, "50");
  near(result.probabilities, [0.3, 0.22, 0.17, 0.12, 0.12, 0.07]);
});
test("miss settles 90 and leaves probabilities unchanged", () => {
  const result = settle(100n, p, { n1: "10" }, land(2));
  assert.equal(result.gold, 90n);
  assert.equal(result.result.transferred, false);
  assert.deepEqual(result.probabilities, p);
});
test("full coverage breaks even and always transfers once, never Jackpots", () => {
  for (let n = 1; n <= 6; n++) {
    const r = settle(100n, p, all, land(n));
    assert.equal(r.gold, 100n);
    assert.equal(r.result.jackpot, false);
    near(r.probabilities, transfer(p, n));
  }
});
test("net-loss win still transfers, independent of wager amount", () => {
  const r = settle(100n, p, { n1: "1", n2: "20" }, land(1));
  assert.equal(r.gold, 85n);
  assert.equal(r.result.net, "-15");
  near(r.probabilities, transfer(p, 1));
  assert.deepEqual(
    settle(100n, p, { n1: "1" }, land(1)).probabilities,
    settle(100n, p, { n1: "100" }, land(1)).probabilities,
  );
});
test("overlapping number, row, column, and color add returns with one transfer", () => {
  const r = settle(100n, p, { n1: "10", row0: "10", red: "10" }, land(1));
  assert.equal(r.result.totalReturn, "100");
  assert.equal(r.gold, 170n);
  near(r.probabilities, transfer(p, 1));
  const four = settle(
    100n,
    p,
    { n4: "10", row1: "10", col1: "10", red: "10" },
    land(4),
  );
  assert.equal(four.result.totalReturn, "130");
  assert.equal(four.gold, 190n);
  near(four.probabilities, transfer(p, 4));
});
test("two transfers match spec arithmetic and uniform boards also move", () => {
  const once = transfer(p, 1);
  const twice = transfer(once, 1);
  near(once, [0.3, 0.22, 0.17, 0.12, 0.12, 0.07]);
  near(twice, [0.225, 0.235, 0.185, 0.135, 0.135, 0.085]);
  assert.ok(twice[1] > twice[0]);
  near(
    transfer(Array(6).fill(1 / 6), 1),
    [0.125, 0.175, 0.175, 0.175, 0.175, 0.175],
  );
});
test("ordinary win on rare marked number reduces it to 3.75%, without Shake", () => {
  const r = settle(100n, p, all, land(6));
  near(r.probabilities, [0.4025, 0.2025, 0.1525, 0.1025, 0.1025, 0.0375]);
  assert.equal(r.result.jackpot, false);
});
test("sole 10 G Jackpot from 100 finishes at 330 G, then fresh permutation", () => {
  let draws = 0;
  const r = settle(100n, p, { n6: "10" }, () => {
    draws++;
    return draws === 1 ? 0.99 : 0;
  });
  assert.equal(r.gold, 330n);
  assert.equal(r.result.totalReturn, "240");
  assert.equal(r.result.net, "230");
  assert.equal(r.result.jackpot, true);
  assert.equal(r.result.transferred, false);
  assert.equal(r.result.markerBefore, 6);
  assert.equal(draws, 6);
  assert.deepEqual([...r.probabilities].sort(), [...p].sort());
  assert.notDeepEqual(r.probabilities, p);
});
test("every additional positive target disables Jackpot, including overlapping groups", () => {
  for (const target of TARGETS.filter((t) => t.id !== "n6")) {
    const r = settle(100n, p, { n6: "10", [target.id]: "1" }, land(6));
    assert.equal(r.result.jackpot, false);
    assert.equal(r.result.transferred, true);
    near(r.probabilities, transfer(p, 6));
  }
  assert.equal(
    settle(100n, p, { n6: "10", n1: "0", black: "0" }, land(6)).result.jackpot,
    true,
  );
  const miss = settle(100n, p, { n6: "10" }, land(1));
  assert.equal(miss.gold, 90n);
  assert.deepEqual(miss.probabilities, p);
});
test("marker uses internal minimum and lowest numerical label for exact ties", () => {
  assert.equal(marker([0.1, 0.1, 0.2, 0.2, 0.2, 0.2]), 1);
  assert.equal(marker([0.1, 0.099999999999, 0.2, 0.2, 0.2, 0.200000000001]), 2);
  assert.equal(marker(transfer(p, 2)), 6);
});
test("shuffle preserves template and can assign each weight to every number", () => {
  assert.deepEqual(
    freshProbabilities(() => 0.999),
    p,
  );
  assert.notDeepEqual(
    freshProbabilities(() => 0),
    p,
  );
  for (let k = 0; k < 100; k++)
    near(
      [...freshProbabilities(Math.random)].sort(),
      [...CONFIG.initialProbabilities].sort(),
    );
});
test("weighted sampling boundaries use the committed weights", () => {
  assert.equal(
    sample(p, () => 0),
    1,
  );
  assert.equal(
    sample(p, () => 0.39999),
    1,
  );
  assert.equal(
    sample(p, () => 0.40001),
    2,
  );
  assert.equal(
    sample(p, () => 0.999999),
    6,
  );
  const counts = Array(6).fill(0);
  for (let i = 0; i < 10000; i++)
    counts[sample(p, () => (i + 0.5) / 10000) - 1]++;
  assert.deepEqual(counts, [4000, 2000, 1500, 1000, 1000, 500]);
});
test("probabilities stay positive and sum to one during long play", () => {
  let values = p;
  for (let i = 0; i < 100000; i++) {
    values = transfer(values, (i % 6) + 1);
    if (i % 1000 === 0) {
      assert.ok(values.every((v) => v > 0 && Number.isFinite(v)));
      assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    }
  }
});
test("wager validation rejects malformed, empty, negative, fractional and overspending input", () => {
  for (const wagers of [
    null,
    [],
    {},
    { n1: 10 },
    { n1: "-1" },
    { n1: "1.5" },
    { n1: "1e3" },
    { n1: "01" },
    { n1: "0" },
    { n7: "1" },
    { n1: "101" },
    { n1: "60", red: "41" },
  ])
    assert.throws(() => validateWagers(wagers, 100n));
  assert.equal(validateWagers({ n1: "1" }, 1n).get("n1"), 1n);
  assert.throws(() => parseGold(Number.MAX_SAFE_INTEGER));
});
test("Gold beyond Number and SQLite integer limits remains exact", () => {
  const gold = 10n ** 80n + 123456789n;
  const stake = 9007199254740993n;
  const r = settle(gold, p, { n1: stake.toString() }, land(1));
  assert.equal(r.gold, gold + 5n * stake);
  assert.equal(r.result.totalReturn, (6n * stake).toString());
  assert.equal(r.result.net, (5n * stake).toString());
});
