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
  tiltLevel,
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
const steady = () => 0.5;
const land = (outcome: number, probabilities = p) => {
  let first = true;
  return () => {
    if (!first) return steady();
    first = false;
    return (probabilities.slice(0, outcome - 1).reduce((a, b) => a + b, 0) +
      probabilities[outcome - 1] / 2) / probabilities.reduce((a, b) => a + b, 0);
  };
};
const seeded = (seed = 12345) => () =>
  ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const validBoard = (values: readonly number[]) => {
  assert.equal(values.length, 6);
  assert.ok(values.every((v) => Number.isFinite(v) && v >= CONFIG.probabilityFloor - 1e-12 && v <= 0.9 + 1e-12));
  assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) - 1) < 1e-10);
};

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
test("ordinary hit uses one outcome draw, one rate draw and five recipient draws", () => {
  let draws = 0;
  const result = settle(100n, p, { n1: "10" }, () => {
    draws++;
    return draws === 1 ? 0.1 : 0.5;
  });
  assert.equal(draws, 7);
  assert.equal(result.gold, 150n);
  assert.equal(result.result.net, "50");
  near(result.probabilities, [0.3829, 0.20342, 0.15342, 0.10342, 0.10342, 0.05342]);
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
    near(r.probabilities, transfer(p, n, steady));
  }
});
test("net-loss win still transfers, independent of wager amount", () => {
  const r = settle(100n, p, { n1: "1", n2: "20" }, land(1));
  assert.equal(r.gold, 85n);
  assert.equal(r.result.net, "-15");
  near(r.probabilities, transfer(p, 1, steady));
  assert.deepEqual(
    settle(100n, p, { n1: "1" }, land(1)).probabilities,
    settle(100n, p, { n1: "100" }, land(1)).probabilities,
  );
});
test("overlapping number, row, column, and color add returns with one transfer", () => {
  const r = settle(100n, p, { n1: "10", row0: "10", red: "10" }, land(1));
  assert.equal(r.result.totalReturn, "100");
  assert.equal(r.gold, 170n);
  near(r.probabilities, transfer(p, 1, steady));
  const four = settle(
    100n,
    p,
    { n4: "10", row1: "10", col1: "10", red: "10" },
    land(4),
  );
  assert.equal(four.result.totalReturn, "130");
  assert.equal(four.gold, 190n);
  near(four.probabilities, transfer(p, 4, steady));
});
test("fixed randomness gives reproducible transfers and uniform boards also move", () => {
  const once = transfer(p, 1, steady);
  const twice = transfer(once, 1, steady);
  near(once, [0.3829, 0.20342, 0.15342, 0.10342, 0.10342, 0.05342]);
  near(twice, [0.3665695, 0.2066861, 0.1566861, 0.1066861, 0.1066861, 0.0566861]);
  near(
    transfer(Array(6).fill(1 / 6), 1, steady),
    [0.16226666666666667, ...Array(5).fill(0.16754666666666665)],
  );
});
test("ordinary win on a rare number transfers only its surplus, without Shake", () => {
  const r = settle(100n, p, all, land(6));
  near(r.probabilities, [0.40027, 0.20027, 0.15027, 0.10027, 0.10027, 0.04865]);
  assert.equal(r.result.jackpot, false);
});
test("sole 10 G Jackpot from 100 finishes at 330 G, then a fresh random board", () => {
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
  assert.equal(draws, 7);
  validBoard(r.probabilities);
  assert.notDeepEqual(r.probabilities, p);
});
test("every additional positive target disables Jackpot, including overlapping groups", () => {
  for (const target of TARGETS.filter((t) => t.id !== "n6")) {
    const r = settle(100n, p, { n6: "10", [target.id]: "1" }, land(6));
    assert.equal(r.result.jackpot, false);
    assert.equal(r.result.transferred, true);
    near(r.probabilities, transfer(p, 6, steady));
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
  assert.equal(marker(transfer(p, 2, steady)), 6);
});
test("initial odds vary continuously, stay bounded and treat every face symmetrically", () => {
  for (const endpoint of [0, Number.EPSILON, 0.5, 1 - Number.EPSILON]) {
    validBoard(freshProbabilities(() => endpoint));
    near(freshProbabilities(() => endpoint), Array(6).fill(1 / 6));
  }
  const random = seeded();
  const totals = Array(6).fill(0);
  const levels = Array(5).fill(0);
  const distinct = new Set<string>();
  for (let k = 0; k < 10000; k++) {
    const board = freshProbabilities(random);
    validBoard(board);
    board.forEach((value, i) => totals[i] += value);
    distinct.add([...board].sort().join(","));
    levels[tiltLevel(board) - 1]++;
  }
  assert.equal(distinct.size, 10000);
  assert.ok(totals.every((total) => Math.abs(total / 10000 - 1 / 6) < 0.005));
  assert.ok(levels.every((count) => count > 100));
});
test("random transfers vary both amount and recipient shares within configured bounds", () => {
  const random = seeded();
  const amounts = new Set<number>();
  for (let n = 1; n <= 6; n++) {
    for (let trial = 0; trial < 100; trial++) {
      const next = transfer(p, n, random);
      validBoard(next);
      const delta = p[n - 1] - next[n - 1];
      amounts.add(delta);
      assert.ok(delta >= 0.03 * (p[n - 1] - 0.02) - 1e-12);
      assert.ok(delta <= 0.06 * (p[n - 1] - 0.02) + 1e-12);
      const gains = next.flatMap((v, i) => i === n - 1 ? [] : [v - p[i]]);
      assert.ok(gains.every((gain) => gain > 0));
      assert.ok(new Set(gains).size > 1);
      assert.ok(Math.abs(gains.reduce((a, b) => a + b, 0) - delta) < 1e-12);
    }
  }
  assert.equal(amounts.size, 600);
  near(transfer(p, 1, () => 0), [0.3886, 0.20228, 0.15228, 0.10228, 0.10228, 0.05228]);
  const legacy = [0.01, 0.19, 0.2, 0.2, 0.2, 0.2];
  near(transfer(legacy, 1, random), legacy);
});
test("Tilt is a coarse concentration clue, independent of labels and float normalization", () => {
  assert.equal(tiltLevel(Array(6).fill(1 / 6)), 1);
  assert.equal(tiltLevel([0.9, 0.02, 0.02, 0.02, 0.02, 0.02]), 5);
  let previous = 1;
  const seen = new Set<number>();
  for (let peak = 1 / 6; peak <= 0.9; peak += 0.001) {
    const board = [peak, ...Array(5).fill((1 - peak) / 5)];
    const level = tiltLevel(board);
    assert.ok(level >= previous && level <= 5);
    assert.equal(tiltLevel([...board].reverse()), level);
    assert.equal(tiltLevel(board.map((v) => v * 1.0000001)), level);
    previous = level;
    seen.add(level);
  }
  assert.equal(seen.size, 5);
  assert.equal(tiltLevel(p), tiltLevel([0.39, 0.21, 0.15, 0.1, 0.1, 0.05]));
});
test("paying updates accelerate with pre-roll Tilt but remain slower than the old range", () => {
  const peaks = [1 / 6, 0.4, 0.5, 0.55, 0.7];
  const expectedBounds = [[0.02, 0.04], [0.03, 0.06], [0.04, 0.08], [0.05, 0.10], [0.06, 0.12]];
  let previousRate = 0;
  peaks.forEach((peak, index) => {
    const board = [peak, ...Array(5).fill((1 - peak) / 5)];
    assert.equal(tiltLevel(board), index + 1);
    const [min, max] = expectedBounds[index];
    for (const draw of [0, 0.5, 1 - Number.EPSILON]) {
      const next = transfer(board, 1, () => draw);
      validBoard(next);
      const rate = (peak - next[0]) / (peak - 0.02);
      assert.ok(Math.abs(rate - (min + (max - min) * draw)) < 1e-12);
      assert.ok(rate < 0.25); // Even the largest update is below the old mean.
    }
    const midpointRate = (peak - transfer(board, 1, steady)[0]) / (peak - 0.02);
    assert.ok(midpointRate > previousRate);
    previousRate = midpointRate;
    const settled = settle(100n, board, all, land(1, board));
    near(settled.probabilities, transfer(board, 1, steady));
  });
  // A level change caused by this payout affects the next roll, not this one.
  const edge = [0.64, ...Array(5).fill(0.072)];
  assert.equal(tiltLevel(edge), 5);
  const after = transfer(edge, 1, steady);
  assert.ok(tiltLevel(after) < 5);
  assert.ok(Math.abs((edge[0] - after[0]) / 0.62 - 0.09) < 1e-12);
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
  const random = seeded();
  for (let i = 0; i < 100000; i++) {
    values = transfer(values, (i % 6) + 1, random);
    if (i % 1000 === 0) {
      validBoard(values);
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
