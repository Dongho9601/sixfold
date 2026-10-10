export type Wagers = Record<string, string>;
export interface Settlement {
  outcome: number;
  stake: string;
  totalReturn: string;
  net: string;
  jackpot: boolean;
  paidTargets: string[];
  probabilitiesBefore: number[];
  probabilitiesAfter: number[];
  markerBefore: number;
  transferred: boolean;
}
export interface PlayerState {
  id: string;
  nickname: string;
  gold: string;
  bestGold: string;
  previousBestGold: string | null;
  /** Whether a leaderboard-eligible run has ever been completed. */
  hasCompletedRun: boolean;
  showProbabilities: boolean;
  /** Once probabilities are shown, this run stays ineligible until restart. */
  leaderboardEligible: boolean;
  rollsUsed: number;
  probabilities: number[];
  tiltLevel: number;
  canShake: boolean;
  revision: string;
  jackpotNumber: number;
  lastRoll: Settlement | null;
}
export type Action =
  | { kind: "roll"; wagers: Wagers }
  | { kind: "shake" }
  | { kind: "restart"; nickname?: string }
  | { kind: "probabilities"; enabled: boolean }
  | { kind: "nickname"; nickname: string };
export interface ActionRequest {
  requestId: string;
  revision: string;
  /** Optional only for compatibility with already saved pre-release requests. */
  playerId?: string;
  action: Action;
}
export interface ActionResponse {
  state: PlayerState;
  result: Settlement | null;
}
/** Opt-in wire representation; the complete result is already in state.lastRoll. */
export interface ActionWireResponse {
  state: PlayerState;
  result: Settlement | null | "lastRoll";
}
export interface Leader {
  id: string;
  nickname: string;
  bestGold: string;
  rank: number;
}
