/** Offline pacing experiment. Uses the real rules, never a database or live player. */
import { CONFIG, TARGETS } from "../src/config.ts";
import { freshProbabilities, sample, tiltLevel, transfer } from "../server/rules.ts";

const trials = 10000;
const horizon = 80;
const baseline = [
  { min: 0.02, max: 0.04 },
  { min: 0.03, max: 0.06 },
  { min: 0.04, max: 0.08 },
  { min: 0.05, max: 0.10 },
  { min: 0.06, max: 0.12 },
];
const profiles = [1, 1.5, 2, 3, 4].map(scale => ({
  name: `${scale}× baseline`,
  rates: baseline.map(({ min, max }) => ({ min: min * scale, max: max * scale })),
}));
profiles.push({ name: "Configured", rates: CONFIG.transferRates.map(rate => ({ ...rate })) });
const seeded = (seed: number) => () =>
  ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const value = sorted[Math.floor(sorted.length / 2)];
  return value > horizon ? `>${horizon}` : String(value);
};
const fraction = (values: number[], cutoff: number) =>
  `${(100 * values.filter(value => value <= cutoff).length / values.length).toFixed(1)}%`;
const groups = TARGETS.filter(target => target.kind !== "number");

console.log(`${trials.toLocaleString()} identical seeded starts per profile/policy; Tilt 2–5 only; ${horizon} rolls; no Shake.`);
console.log("Groups: 1 G, cycle the seven groups every three rolls. Coverage: 1 G on every face, always breaks even.");
console.log("Opportunity window: first passage of the initially strongest face below 30%, among starts at or above 30%.");
console.log("This is a pacing comparison, not a model of human enjoyment or an optimal hidden-odds strategy.\n");

for (const policy of ["Groups", "Coverage"] as const) {
  const rows = [];
  for (const profile of profiles) {
    const firstLow: number[] = [];
    const firstChange: number[] = [];
    const opportunity: number[] = [];
    let levelChanges = 0;
    let lowOccupancy = 0;
    for (let trial = 0; trial < trials; trial++) {
      const initial = seeded(20261010 + trial * 7919);
      let board = freshProbabilities(initial);
      while (tiltLevel(board) === 1) board = freshProbabilities(initial);
      let level = tiltLevel(board);
      const strongest = board.indexOf(Math.max(...board));
      const hadOpportunity = board[strongest] >= 0.3;
      let lowAt = horizon + 1;
      let changedAt = horizon + 1;
      let opportunityEnds = horizon + 1;
      for (let roll = 1; roll <= horizon; roll++) {
        // Consume seven draws per roll even on misses, keeping the outcome,
        // rate and shares paired across all candidate profiles and policies.
        const draws = Array.from({ length: 7 }, initial);
        let draw = 0;
        const random = () => draws[draw++];
        const outcome = sample(board, random);
        const target = groups[Math.floor((roll - 1) / 3) % groups.length];
        if (policy === "Coverage" || target.coverage.includes(outcome))
          board = transfer(board, outcome, random, profile.rates);
        const nextLevel = tiltLevel(board);
        if (nextLevel !== level) {
          if (changedAt > horizon) changedAt = roll;
          if (roll <= 20) levelChanges++;
        }
        level = nextLevel;
        if (level === 1 && lowAt > horizon) lowAt = roll;
        if (roll > 20 && roll <= 40 && level === 1) lowOccupancy++;
        if (board[strongest] < 0.3 && opportunityEnds > horizon) opportunityEnds = roll;
      }
      firstLow.push(lowAt);
      firstChange.push(changedAt);
      if (hadOpportunity) opportunity.push(opportunityEnds);
    }
    rows.push({
      profile: profile.name,
      "first change (median)": median(firstChange),
      "Tilt 1 (median)": median(firstLow),
      "Tilt 1 by 20": fraction(firstLow, 20),
      "Tilt 1 by 40": fraction(firstLow, 40),
      "Tilt 1 by 80": fraction(firstLow, 80),
      "opportunity (median)": median(opportunity),
      "changes / 20": (levelChanges / trials).toFixed(1),
      "Tilt 1 occupancy, 21–40": `${(100 * lowOccupancy / (trials * 20)).toFixed(1)}%`,
    });
  }
  console.log(policy);
  console.table(rows);
}
