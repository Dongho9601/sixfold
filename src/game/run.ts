import { CONFIG } from "../config.ts";
import type { Action, PlayerState, Settlement } from "../types.ts";
import { freshProbabilities, GameError, marker, settle, tiltLevel, type Random } from "./rules.ts";

export interface PersonalRecord {
  id: string;
  nickname: string;
  score: string;
  /** Monotonic completion order, independent of changes to the browser clock. */
  order: string;
}

export function compareRecords(a: PersonalRecord, b: PersonalRecord): number {
  const x = BigInt(a.score), y = BigInt(b.score);
  if (x !== y) return x > y ? -1 : 1;
  const first = BigInt(a.order), second = BigInt(b.order);
  if (first !== second) return first < second ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function nickname(value: string): string {
  const name = value.trim().normalize("NFC");
  if (value.length > 192 || !name || [...name].length > 24 || /[\p{C}]/u.test(name))
    throw new GameError("Use a nickname of 1–24 visible characters.");
  return name;
}

export function newRun(id: string, name: string, random: Random): PlayerState {
  const normalizedName = nickname(name);
  const probabilities = freshProbabilities(random);
  return {
    id, nickname: normalizedName, gold: CONFIG.startingGold,
    boardStartingGold: CONFIG.startingGold, bestGold: "0",
    previousBestGold: null, hasCompletedRun: false, showProbabilities: false,
    leaderboardEligible: true, rollsUsed: 0, probabilities,
    tiltLevel: tiltLevel(probabilities), canShake: false, revision: "0",
    recorded: false, jackpotNumber: marker(probabilities), lastRoll: null,
  };
}

/** Pure transition. Animation and persistence cannot influence settlement. */
export function transition(
  before: PlayerState, action: Action, random: Random, nextId: string,
): { state: PlayerState; result: Settlement | null } {
  let state = structuredClone(before);
  let result: Settlement | null = null;
  const finished = state.rollsUsed >= CONFIG.rollsPerRun || state.gold === "0";
  if (finished && ["roll", "shake", "probabilities"].includes(action.kind))
    throw new GameError("This run has ended. Start a new run with 100 G.");
  if (action.kind === "roll") {
    const settled = settle(BigInt(state.gold), state.probabilities, action.wagers, random);
    state.gold = settled.gold.toString();
    state.probabilities = settled.probabilities;
    state.lastRoll = result = settled.result;
    if (result.jackpot) state.boardStartingGold = state.gold;
    state.rollsUsed++;
    state.canShake = !result.jackpot && (state.canShake || result.net !== "0");
    if (state.gold === "0" || state.rollsUsed === CONFIG.rollsPerRun) state.canShake = false;
  } else if (action.kind === "shake") {
    if (!state.canShake)
      throw new GameError("Shake unlocks after a roll changes your bankroll. Break-even rolls do not count.");
    state.probabilities = freshProbabilities(random);
    state.boardStartingGold = state.gold;
    state.canShake = false;
  } else if (action.kind === "restart") {
    state = newRun(nextId, action.nickname === undefined ? state.nickname : action.nickname, random);
    state.bestGold = before.bestGold;
    state.hasCompletedRun = before.hasCompletedRun;
  } else if (action.kind === "probabilities") {
    state.showProbabilities = action.enabled;
    if (action.enabled) state.leaderboardEligible = false;
  } else {
    state.nickname = nickname(action.nickname);
  }
  state.revision = (BigInt(before.revision) + 1n).toString();
  state.jackpotNumber = marker(state.probabilities);
  state.tiltLevel = tiltLevel(state.probabilities);
  return { state, result };
}

/** Receipt and record live in the same save; repeat calls are harmless. */
export function recordCompletion(state: PlayerState, records: PersonalRecord[]): PersonalRecord[] {
  if (state.recorded || state.rollsUsed !== CONFIG.rollsPerRun || !state.leaderboardEligible)
    return records;
  state.previousBestGold = state.hasCompletedRun ? state.bestGold : null;
  if (!state.hasCompletedRun || BigInt(state.gold) > BigInt(state.bestGold)) state.bestGold = state.gold;
  state.hasCompletedRun = true;
  state.recorded = true;
  const record = { id: state.id, nickname: state.nickname, score: state.gold, order: state.revision };
  return [...records.filter(item => item.id !== state.id), record].sort(compareRecords).slice(0, CONFIG.leaderboardLimit);
}
