/** Offline pacing experiment. Uses the real rules, never a database or live player. */
import { CONFIG, TARGETS } from "../src/config.ts";
import { freshProbabilities, sample, tiltLevel, transfer } from "../src/game/rules.ts";

const trials = 10000;
const horizon = 80;
// Splitting the old middle band gives both new levels 3 and 4 its old rate.
// This reproduces the previous five-level transfer behavior with six-level labels.
const profiles = [
  { name: "Previous", rates: [.048, .072, .096, .096, .12, .144].map(min => ({ min, max: 2 * min })) },
  { name: "Configured", rates: CONFIG.transferRates },
];
const seeded = (seed: number) => () =>
  ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const value = sorted[Math.floor(sorted.length / 2)];
  return value > horizon ? `>${horizon}` : String(value);
};
const percent = (count: number, total: number) => `${(100 * count / total).toFixed(1)}%`;
const groups = TARGETS.filter(target => target.kind !== "number");

const frequencies = Array(CONFIG.transferRates.length).fill(0);
const distributionRandom = seeded(20261010);
for (let trial = 0; trial < 100000; trial++) frequencies[tiltLevel(freshProbabilities(distributionRandom)) - 1]++;
console.log("Fresh-board Tilt distribution:", frequencies.map(count => percent(count, 100000)).join(", "));
console.log(`${trials.toLocaleString()} identical seeded starts per profile/policy; all starting levels; ${horizon} rolls; no Shake.`);
console.log("Groups: cycle the seven groups every three rolls. Coverage: bet every face, so every roll pays.");
console.log("Strongest: keep betting the initially strongest face (an informed stress test, not a hidden-odds strategy).");
console.log("Chances = rolls through the first change from the starting Tilt, including the roll that changes it.");
console.log("Tilt 5 is the former Tilt 4; Tilt 6 is the former Tilt 5. No minimum stay is guaranteed.");
console.log("Opportunity = initially strongest face stays >= 30%, among non-Tilt-1 starts at or above 30%.\n");

for (const policy of ["Groups", "Coverage", "Strongest"] as const) {
  const rows = [];
  for (const profile of profiles) {
    const firstLow: number[] = [];
    const firstChanges = Array.from({ length: 6 }, () => [] as number[]);
    const opportunities: number[] = [];
    for (let trial = 0; trial < trials; trial++) {
      const random = seeded(20261010 + trial * 7919);
      let board = freshProbabilities(random);
      const initialLevel = tiltLevel(board);
      const strongest = board.indexOf(Math.max(...board));
      const hadOpportunity = board[strongest] >= 0.3;
      let lowAt = horizon + 1;
      let changedAt = horizon + 1;
      let opportunityEnds = horizon + 1;
      for (let roll = 1; roll <= horizon; roll++) {
        // Paired random tapes preserve equivalent outcome/rate/share draws across profiles.
        const draws = Array.from({ length: 7 }, random);
        let draw = 0;
        const rollRandom = () => draws[draw++];
        const outcome = sample(board, rollRandom);
        const target = groups[Math.floor((roll - 1) / 3) % groups.length];
        const pays = policy === "Coverage" || (policy === "Groups"
          ? target.coverage.includes(outcome) : outcome === strongest + 1);
        if (pays) board = transfer(board, outcome, rollRandom, profile.rates);
        const nextLevel = tiltLevel(board);
        if (nextLevel !== initialLevel && changedAt > horizon) changedAt = roll;
        if (nextLevel === 1 && lowAt > horizon) lowAt = roll;
        if (board[strongest] < 0.3 && opportunityEnds > horizon) opportunityEnds = roll;
      }
      firstChanges[initialLevel - 1].push(changedAt);
      if (initialLevel > 1) {
        firstLow.push(lowAt);
        if (hadOpportunity) opportunities.push(opportunityEnds);
      }
    }
    rows.push({
      profile: profile.name,
      "Tilt 4 chances (median)": median(firstChanges[3]),
      "Tilt 5 chances (median)": median(firstChanges[4]),
      "Tilt 6 chances (median)": median(firstChanges[5]),
      "Tilt 5 changes after one": percent(firstChanges[4].filter(n => n === 1).length, firstChanges[4].length),
      "Tilt 6 changes after one": percent(firstChanges[5].filter(n => n === 1).length, firstChanges[5].length),
      "Tilt 1 arrival (median)": median(firstLow),
      "opportunity (median)": median(opportunities),
    });
  }
  console.log(policy);
  console.table(rows);
}
