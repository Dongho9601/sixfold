import { CONFIG, TARGET_BY_ID } from "../config.ts";
import type { Settlement, Wagers } from "../types.ts";

export class GameError extends Error {
  constructor(message: string) { super(message); }
}
export type Random = () => number;

// Normalized independent exponential weights sample Dirichlet(1, ..., 1).
// Clamp only the RNG endpoints so injected zeroes cannot create 0 / 0.
function randomShares(count: number, random: Random): number[] {
  const weights = Array.from({ length: count }, () => {
    const u = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, random()));
    return -Math.log1p(-u);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

export function freshProbabilities(random: Random): number[] {
  const floor = CONFIG.probabilityFloor;
  // Condition the existing symmetric distribution on Tilt 3–6. The lower
  // levels are reached by playing a board, never by replacing it.
  let probabilities: number[];
  do {
    probabilities = randomShares(6, random).map((share) => floor + (1 - 6 * floor) * share);
  } while (tiltLevel(probabilities) < CONFIG.minimumFreshTilt);
  return probabilities;
}

export function probabilityEntropy(p: readonly number[]): number {
  // Sort before summing so relabeling faces cannot affect boundary rounding.
  const values = [...p].sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  return -values.reduce((sum, value) => {
    const probability = value / total;
    return sum + (probability > 0 ? probability * Math.log(probability) : 0);
  }, 0);
}

export function tiltLevel(p: readonly number[]): number {
  const effectiveOutcomes = Math.exp(probabilityEntropy(p));
  return 1 + CONFIG.tiltThresholds.filter((cutoff) => effectiveOutcomes < cutoff).length;
}

export function marker(p: readonly number[]): number {
  return p.indexOf(Math.min(...p)) + 1;
}

export function parseGold(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new GameError("Gold must be a whole, nonnegative decimal string.");
  }
  return BigInt(value);
}

export function validateWagers(
  input: unknown,
  gold: bigint,
): Map<string, bigint> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new GameError("Invalid wagers.");
  const wagers = new Map<string, bigint>();
  let total = 0n;
  for (const [id, raw] of Object.entries(input)) {
    if (!TARGET_BY_ID.has(id)) throw new GameError("Unknown bet target.");
    // A decimal with more digits than the available bankroll cannot be affordable.
    // Reject before BigInt conversion, without imposing a gameplay score cap.
    if (typeof raw === "string" && raw.length > gold.toString().length)
      throw new GameError("Your wagers exceed your available Gold.");
    const amount = parseGold(raw);
    if (amount === 0n) continue;
    if (amount < BigInt(CONFIG.minimumWager))
      throw new GameError("Wager below the minimum.");
    wagers.set(id, amount);
    total += amount;
  }
  if (total === 0n) throw new GameError("Place a wager before rolling.");
  if (total > gold)
    throw new GameError("Your wagers exceed your available Gold.");
  return wagers;
}

export function sample(p: readonly number[], random: Random): number {
  // Exactly one outcome draw. Summing the stored weights absorbs floating-point drift only.
  const threshold = random() * p.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  for (let i = 0; i < p.length; i++) {
    cumulative += p[i];
    if (threshold < cumulative) return i + 1;
  }
  return 6;
}

export function transfer(
  p: readonly number[],
  outcome: number,
  random: Random,
  rates: readonly { min: number; max: number }[] = CONFIG.transferRates,
): number[] {
  const { min, max } = rates[tiltLevel(p) - 1];
  const rate = min + (max - min) * random();
  // Older saved boards can contain probabilities below the new floor. Preserve
  // those boards; their rare faces donate nothing until they receive more mass.
  const delta = rate * Math.max(0, p[outcome - 1] - CONFIG.probabilityFloor);
  const shares = randomShares(5, random);
  let recipient = 0;
  return p.map((value, i) =>
    i === outcome - 1 ? value - delta : value + delta * shares[recipient++],
  );
}

export function settle(
  gold: bigint,
  p: readonly number[],
  input: Wagers,
  random: Random,
): { gold: bigint; probabilities: number[]; result: Settlement } {
  const wagers = validateWagers(input, gold);
  const marked = marker(p);
  const eligible = wagers.size === 1 && wagers.has(`n${marked}`);
  const outcome = sample(p, random);
  const jackpot = eligible && outcome === marked;
  let stake = 0n;
  let totalReturn = 0n;
  const paidTargets: string[] = [];
  for (const [id, amount] of wagers) {
    stake += amount;
    const target = TARGET_BY_ID.get(id)!;
    if (target.coverage.includes(outcome)) {
      paidTargets.push(id);
      totalReturn +=
        amount *
        BigInt(jackpot ? CONFIG.multipliers.jackpot : target.multiplier);
    }
  }
  const transferred = !jackpot && paidTargets.length > 0;
  const probabilities = jackpot
    ? freshProbabilities(random)
    : transferred
      ? transfer(p, outcome, random)
      : [...p];
  return {
    gold: gold - stake + totalReturn,
    probabilities,
    result: {
      outcome,
      stake: stake.toString(),
      totalReturn: totalReturn.toString(),
      net: (totalReturn - stake).toString(),
      jackpot,
      paidTargets,
      probabilitiesBefore: [...p],
      probabilitiesAfter: probabilities,
      markerBefore: marked,
      transferred,
    },
  };
}
