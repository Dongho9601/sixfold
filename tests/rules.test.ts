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
} from "../src/game/rules.ts";
import type { Wagers } from "../src/types.ts";
import { seeded } from "./random.ts";

const p = [0.4, 0.2, 0.15, 0.1, 0.1, 0.05];
const rare = [0.4, 0.2, 0.15, 0.12, 0.1, 0.03];
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
  let draws = 0;
  const random = seeded();
  return () => {
    // Keep ordinary rate/share draws fixed, then allow rejected fresh boards
    // after a Jackpot to consume more draws.
    if (draws++ > 0) return draws <= 7 ? steady() : random();
    return (probabilities.slice(0, outcome - 1).reduce((a, b) => a + b, 0) +
      probabilities[outcome - 1] / 2) / probabilities.reduce((a, b) => a + b, 0);
  };
};
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
  assert.deepEqual(["col0", "col1", "col2", "row0", "row1"].map(id => TARGET_BY_ID.get(id)!.label),
    ["1st 2", "2nd 2", "3rd 2", "Odds", "Evens"]);
});
for (const target of TARGETS) {
  test(`target ${target.id}: all six outcomes pay only covered numbers`, () => {
    for (let outcome = 1; outcome <= 6; outcome++) {
      const result = settle(100n, p, { [target.id]: "10" }, land(outcome));
      const multiplier =
        target.id === "n6" ? CONFIG.multipliers.jackpot : target.multiplier;
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
  near(result.probabilities, [0.3715, 0.2057, 0.1557, 0.1057, 0.1057, 0.0557]);
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
  near(once, [0.3715, 0.2057, 0.1557, 0.1057, 0.1057, 0.0557]);
  near(twice, [0.3451375, 0.2109725, 0.1609725, 0.1109725, 0.1109725, 0.0609725]);
  near(
    transfer(Array(6).fill(1 / 6), 1, steady),
    [0.15786666666666666, ...Array(5).fill(0.16842666666666667)],
  );
});
test("ordinary win on a rare number transfers only its surplus, without Shake", () => {
  const r = settle(100n, p, all, land(6));
  near(r.probabilities, [0.40045, 0.20045, 0.15045, 0.10045, 0.10045, 0.04775]);
  assert.equal(r.result.jackpot, false);
});
test("sole 10 G Jackpot from 100 finishes at 330 G, then a fresh random board", () => {
  let draws = 0;
  const random = seeded();
  const r = settle(100n, rare, { n6: "10" }, () => {
    draws++;
    return draws === 1 ? 0.99 : random();
  });
  assert.equal(r.gold, 330n);
  assert.equal(r.result.totalReturn, "240");
  assert.equal(r.result.net, "230");
  assert.equal(r.result.jackpot, true);
  assert.equal(r.result.transferred, false);
  assert.equal(r.result.markerBefore, 6);
  assert.ok(draws >= 7 && (draws - 1) % 6 === 0);
  validBoard(r.probabilities);
  assert.ok(tiltLevel(r.probabilities) >= 3);
  assert.notDeepEqual(r.probabilities, rare);
});
test("every additional positive target disables Jackpot, including overlapping groups", () => {
  for (const board of [rare, p, Array(6).fill(1 / 6)]) {
    const marked = marker(board);
    for (const target of TARGETS.filter(t => t.id !== `n${marked}`)) {
      const r = settle(100n, board, { [`n${marked}`]: "10", [target.id]: "1" }, land(marked, board));
      assert.equal(r.result.jackpot, false);
      assert.equal(r.result.transferred, true);
      near(r.probabilities, transfer(board, marked, steady));
    }
  }
  assert.equal(
    settle(100n, rare, { n6: "10", n1: "0", black: "0" }, land(6, rare)).result.jackpot,
    true,
  );
  const miss = settle(100n, rare, { n6: "10" }, land(1, rare));
  assert.equal(miss.gold, 90n);
  assert.deepEqual(miss.probabilities, rare);
});
test("marker uses internal minimum and lowest numerical label for exact ties", () => {
  assert.equal(marker([0.1, 0.1, 0.2, 0.2, 0.2, 0.2]), 1);
  assert.equal(marker([0.1, 0.099999999999, 0.2, 0.2, 0.2, 0.200000000001]), 2);
  assert.equal(marker(transfer(p, 2, steady)), 6);
});

test("a sole least-likely number hit Jackpots on every board, regardless of its chance", () => {
  for (const board of [rare, p, [0.2, 0.16, 0.16, 0.16, 0.16, 0.16], Array(6).fill(1 / 6), Array(6).fill(2)]) {
    const face = marker(board);
    const result = settle(100n, board, { [`n${face}`]: "10" }, land(face, board));
    assert.equal(result.result.jackpot, true);
    assert.equal(result.result.totalReturn, "240");
    assert.equal(result.gold, 330n);
    assert.equal(result.result.transferred, false);
    validBoard(result.probabilities);
    const missed = settle(100n, board, { [`n${face}`]: "10" }, land(face % 6 + 1, board));
    assert.equal(missed.result.jackpot, false);
    assert.equal(missed.gold, 90n);
    assert.deepEqual(missed.probabilities, board);
  }
  const tied = Array(6).fill(1 / 6);
  const ordinary = settle(100n, tied, { n2: "10" }, land(2, tied));
  assert.equal(ordinary.result.jackpot, false);
  assert.equal(ordinary.result.totalReturn, "60");
});
test("Jackpot uses the least-likely number before the roll, then recomputes it for the next roll", () => {
  const before = [0.2, 0.2, 0.2, 0.13, 0.135, 0.135];
  assert.equal(marker(before), 4);
  const ordinary = settle(100n, before, { n5: "10" }, land(5, before));
  assert.equal(ordinary.result.jackpot, false);
  assert.equal(ordinary.result.totalReturn, "60");
  assert.equal(marker(ordinary.probabilities), 5);
  const next = settle(ordinary.gold, ordinary.probabilities, { n5: "10" }, land(5, ordinary.probabilities));
  assert.equal(next.result.jackpot, true);
});
test("initial odds vary continuously, stay bounded and treat every face symmetrically", () => {
  for (const endpoint of [0, Number.EPSILON, 0.5, 1 - Number.EPSILON]) {
    let draws = 0;
    const random = seeded();
    const board = freshProbabilities(() => draws++ < 6 ? endpoint : random());
    validBoard(board);
    assert.ok(draws > 6, "An even candidate must be rejected, including clamped RNG endpoints");
    assert.ok(tiltLevel(board) >= 3);
  }
  const random = seeded();
  const totals = Array(6).fill(0);
  const levels = Array(6).fill(0);
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
  assert.deepEqual(levels.slice(0, 2), [0, 0]);
  assert.ok(levels.slice(2).every((count) => count > 100));
});
test("random transfers vary both amount and recipient shares within configured bounds", () => {
  const random = seeded();
  const { min, max } = CONFIG.transferRates[tiltLevel(p) - 1];
  const amounts = new Set<number>();
  for (let n = 1; n <= 6; n++) {
    for (let trial = 0; trial < 100; trial++) {
      const next = transfer(p, n, random);
      validBoard(next);
      const delta = p[n - 1] - next[n - 1];
      amounts.add(delta);
      assert.ok(delta >= min * (p[n - 1] - 0.02) - 1e-12);
      assert.ok(delta <= max * (p[n - 1] - 0.02) + 1e-12);
      const gains = next.flatMap((v, i) => i === n - 1 ? [] : [v - p[i]]);
      assert.ok(gains.every((gain) => gain > 0));
      assert.ok(new Set(gains).size > 1);
      assert.ok(Math.abs(gains.reduce((a, b) => a + b, 0) - delta) < 1e-12);
    }
  }
  assert.equal(amounts.size, 600);
  near(transfer(p, 1, () => 0), [0.381, 0.2038, 0.1538, 0.1038, 0.1038, 0.0538]);
  const legacy = [0.01, 0.19, 0.2, 0.2, 0.2, 0.2];
  near(transfer(legacy, 1, random), legacy);
});
test("Tilt has six concentration levels, independent of labels and float normalization", () => {
  assert.equal(tiltLevel(Array(6).fill(1 / 6)), 1);
  assert.equal(tiltLevel([0.9, 0.02, 0.02, 0.02, 0.02, 0.02]), 6);
  let previous = 1;
  const seen = new Set<number>();
  for (let peak = 1 / 6; peak <= 0.9; peak += 0.001) {
    const board = [peak, ...Array(5).fill((1 - peak) / 5)];
    const level = tiltLevel(board);
    assert.ok(level >= previous && level <= 6);
    assert.equal(tiltLevel([...board].reverse()), level);
    assert.equal(tiltLevel(board.map((v) => v * 1.0000001)), level);
    previous = level;
    seen.add(level);
  }
  assert.equal(seen.size, 6);
  assert.equal(tiltLevel(p), tiltLevel([0.39, 0.21, 0.15, 0.1, 0.1, 0.05]));
});
test("paying updates use the tuned range for pre-roll Tilt", () => {
  const peaks = [1 / 6, 0.4, 0.475, 0.5, 0.55, 0.7];
  let previousRate = 0;
  peaks.forEach((peak, index) => {
    const board = [peak, ...Array(5).fill((1 - peak) / 5)];
    assert.equal(tiltLevel(board), index + 1);
    const { min, max } = CONFIG.transferRates[index];
    for (const draw of [0, 0.5, 1 - Number.EPSILON]) {
      const next = transfer(board, 1, () => draw);
      validBoard(next);
      const rate = (peak - next[0]) / (peak - 0.02);
      assert.ok(Math.abs(rate - (min + (max - min) * draw)) < 1e-12);
    }
    const midpointRate = (peak - transfer(board, 1, steady)[0]) / (peak - 0.02);
    assert.ok(midpointRate > previousRate);
    previousRate = midpointRate;
    const settled = settle(100n, board, all, land(1, board));
    near(settled.probabilities, transfer(board, 1, steady));
  });
  // A level change caused by this payout affects the next roll, not this one.
  const edge = [0.64, ...Array(5).fill(0.072)];
  assert.equal(tiltLevel(edge), 6);
  const after = transfer(edge, 1, steady);
  assert.equal(tiltLevel(after), 5);
  const topRate = CONFIG.transferRates[5];
  assert.ok(Math.abs((edge[0] - after[0]) / 0.62 - (topRate.min + topRate.max) / 2) < 1e-12);
});
test("small group bets reach Tilt 1 within a session while preserving an opportunity window", () => {
  const groups = TARGETS.filter(target => target.kind !== "number");
  const firstLow: number[] = [];
  const opportunities: number[] = [];
  for (let trial = 0; trial < 1000; trial++) {
    const random = seeded(20261010 + trial * 7919);
    let board = freshProbabilities(random);
    const strongest = board.indexOf(Math.max(...board));
    const hadOpportunity = board[strongest] >= 0.3;
    let lowAt = 81;
    let opportunityEnds = 81;
    let gold = 100n;
    for (let roll = 1; roll <= 80; roll++) {
      const draws = Array.from({ length: 7 }, random);
      let draw = 0;
      const target = groups[Math.floor((roll - 1) / 3) % groups.length];
      const result = settle(gold, board, { [target.id]: "1" }, () => draws[draw++]);
      gold = result.gold;
      board = result.probabilities;
      if (tiltLevel(board) === 1 && lowAt === 81) lowAt = roll;
      if (board[strongest] < 0.3 && opportunityEnds === 81) opportunityEnds = roll;
    }
    firstLow.push(lowAt);
    if (hadOpportunity) opportunities.push(opportunityEnds);
  }
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const reachBy80 = firstLow.filter(roll => roll <= 80).length / firstLow.length;
  assert.ok(reachBy80 >= 0.95, `Only ${reachBy80 * 100}% reached Tilt 1 within 80 rolls`);
  const lowMedian = median(firstLow);
  assert.ok(lowMedian >= 33 && lowMedian <= 41, `Tilt 1 median: ${lowMedian}`);
  const opportunityMedian = median(opportunities);
  assert.ok(opportunityMedian >= 30 && opportunityMedian <= 40, `Opportunity median: ${opportunityMedian}`);
});
test("upper Tilt pacing gives repeated chances with groups and the strongest face", () => {
  const groups = TARGETS.filter(target => target.kind !== "number");
  for (const policy of ["groups", "strongest"] as const) {
    const chances = new Map([[5, [] as number[]], [6, [] as number[]]]);
    for (let trial = 0; trial < 10000; trial++) {
      const random = seeded(20261010 + trial * 7919);
      let board = freshProbabilities(random);
      const level = tiltLevel(board);
      if (!chances.has(level)) continue;
      const strongest = board.indexOf(Math.max(...board)) + 1;
      let gold = 100n;
      let rolls = 0;
      while (tiltLevel(board) === level && rolls < 80) {
        const draws = Array.from({ length: 7 }, random);
        let draw = 0;
        const id = policy === "groups" ? groups[Math.floor(rolls / 3) % groups.length].id : `n${strongest}`;
        const result = settle(gold, board, { [id]: "1" }, () => draws[draw++]);
        board = result.probabilities;
        gold = result.gold;
        rolls++;
      }
      chances.get(level)!.push(rolls);
    }
    const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const level5 = median(chances.get(5)!);
    const level6 = median(chances.get(6)!);
    const minimum5 = policy === "groups" ? 3 : 2;
    assert.ok(level5 >= minimum5 && level5 <= 4, `${policy} Tilt 5 median: ${level5}`);
    assert.ok(level6 >= 2 && level6 <= 4, `${policy} Tilt 6 median: ${level6}`);
    // These are pacing targets, not a lock: a near-boundary board can still move on roll one.
    assert.ok(chances.get(6)!.some(rolls => rolls === 1));
  }
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
test("Gold beyond Number and 64-bit integer limits remains exact", () => {
  const gold = 10n ** 80n + 123456789n;
  const stake = 9007199254740993n;
  const r = settle(gold, p, { n1: stake.toString() }, land(1));
  assert.equal(r.gold, gold + 5n * stake);
  assert.equal(r.result.totalReturn, (6n * stake).toString());
  assert.equal(r.result.net, (5n * stake).toString());
});
