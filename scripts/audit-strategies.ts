/** Offline balance audit. Uses production settlement; never opens a database. */
import assert from "node:assert/strict";
import { CONFIG, TARGETS } from "../src/config.ts";
import { freshProbabilities, jackpotAvailable, marker, settle } from "../server/rules.ts";
import type { Wagers } from "../src/types.ts";

const trials = 5000;
const hedge: Wagers = { red: "1", black: "1" };
const seeded = (seed: number) => () =>
  ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const percent = (count: number) => `${(100 * count / trials).toFixed(2)}%`;
const total = (p: readonly number[]) => p.reduce((sum, value) => sum + value, 0);
const minimumChance = (p: readonly number[]) => Math.min(...p) / total(p);

// Ordinary portfolios cannot guarantee a positive one-roll profit: summing
// their net returns across all six outcomes gives zero.
for (const target of TARGETS)
  assert.equal(target.coverage.length * target.multiplier, 6);

const example = [0.4, 0.2, 0.15, 0.1, 0.1, 0.05];
for (let outcome = 1; outcome <= 6; outcome++) {
  let first = true;
  const random = () => {
    if (!first) return 0.5;
    first = false;
    return (example.slice(0, outcome - 1).reduce((a, b) => a + b, 0)
      + example[outcome - 1] / 2) / total(example);
  };
  const next = settle(100n, example, hedge, random);
  assert.equal(next.result.outcome, outcome);
  assert.equal(next.gold, 100n);
  assert.equal(next.result.transferred, true);
}

// Blind number choice has zero ordinary expectation. Its extra return is now
// 3*p_min only on eligible boards, bounded by 1/8; otherwise it is zero.
for (let trial = 0; trial < trials; trial++) {
  const p = freshProbabilities(seeded(20261010 + trial * 7919));
  const eligible = jackpotAvailable(p);
  const marked = marker(p);
  const expectedReturn = p.reduce((sum, chance, i) => sum + chance / total(p)
    * (eligible && i + 1 === marked ? CONFIG.multipliers.jackpot : CONFIG.multipliers.number) / 6, 0);
  const bonus = eligible ? 3 * minimumChance(p) : 0;
  assert.ok(Math.abs(expectedReturn - 1 - bonus) < 1e-12);
  assert.ok(bonus <= 0.125 + 1e-12);
}
assert.equal(jackpotAvailable(Array(6).fill(1 / 6)), false);
console.log("Verified zero-Gold-cost hedges and the gated Jackpot expectation. Hedges still consume a roll.");
console.log(`${trials.toLocaleString()} seeded runs per policy; ${CONFIG.startingGold} G start; ${CONFIG.rollsPerRun} rolls or bankruptcy.`);
console.log("No Shake or restart. Fixed 1 G bets (2 G total for a hedge). All preparation counts toward the limit.");
console.log("Policies share fresh boards; later random streams diverge. This is not an optimal-strategy search.\n");

for (const policy of ["Random number", "Old hedge-to-12% strategy", "Known best expected return"] as const) {
  let profitable = 0;
  let doubled = 0;
  let bankrupt = 0;
  let jackpots = 0;
  let hedgeRolls = 0;
  const endingGold: number[] = [];
  for (let trial = 0; trial < trials; trial++) {
    const random = seeded(20261010 + trial * 7919);
    const choose = seeded(0x91e10da5 + trial * 104729);
    let p = freshProbabilities(random);
    let gold = BigInt(CONFIG.startingGold);
    let preparing = true;
    for (let roll = 0; roll < CONFIG.rollsPerRun && gold > 0n; roll++) {
      let wagers: Wagers;
      if (policy === "Random number") {
        wagers = { [`n${1 + Math.floor(choose() * 6)}`]: "1" };
      } else if (policy === "Old hedge-to-12% strategy") {
        if (preparing && minimumChance(p) < 0.12 && gold >= 2n) {
          wagers = hedge;
          hedgeRolls++;
        } else {
          preparing = false;
          wagers = { [`n${marker(p)}`]: "1" };
        }
      } else {
        const marked = marker(p);
        const eligible = jackpotAvailable(p);
        const expected = (target: typeof TARGETS[number]) => {
          const multiplier = eligible && target.id === `n${marked}`
            ? CONFIG.multipliers.jackpot : target.multiplier;
          return multiplier * target.coverage.reduce((sum, face) => sum + p[face - 1], 0) / total(p);
        };
        const best = TARGETS.reduce((best, candidate) => expected(candidate) > expected(best) ? candidate : best);
        wagers = { [best.id]: "1" };
      }
      const next = settle(gold, p, wagers, random);
      if (wagers === hedge) assert.equal(next.gold, gold);
      gold = next.gold;
      p = next.probabilities;
      if (next.result.jackpot) {
        jackpots++;
        preparing = true;
      }
    }
    // With 100 fixed 1 G attack wagers, all values here are safely small.
    endingGold.push(Number(gold));
    if (gold > BigInt(CONFIG.startingGold)) profitable++;
    if (gold >= 2n * BigInt(CONFIG.startingGold)) doubled++;
    if (gold === 0n) bankrupt++;
  }
  console.log(JSON.stringify({
    policy,
    profitable: percent(profitable),
    atLeastDoubled: percent(doubled),
    bankrupt: percent(bankrupt),
    meanFinalGold: (endingGold.reduce((sum, value) => sum + value, 0) / trials).toFixed(2),
    medianFinalGold: median(endingGold),
    jackpots,
    hedgeRolls,
  }, null, 2));
}
console.log("\nA favorable informed strategy is intentional. These samples do not prove that every exploit is eliminated.");
