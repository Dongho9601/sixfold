import { CONFIG, TARGET_BY_ID } from "../src/config.ts";
import type { Settlement, Wagers } from "../src/types.ts";

export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Random = () => number;

export function freshProbabilities(random: Random): number[] {
  const values: number[] = [...CONFIG.initialProbabilities];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
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

export function transfer(p: readonly number[], outcome: number): number[] {
  const delta = CONFIG.alpha * p[outcome - 1];
  return p.map((value, i) =>
    i === outcome - 1 ? value - delta : value + delta / 5,
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
      ? transfer(p, outcome)
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
