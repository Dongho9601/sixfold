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
  /** Whether a record-eligible run has ever been completed in this browser. */
  hasCompletedRun: boolean;
  showProbabilities: boolean;
  /** Once probabilities are shown, this run stays ineligible until restart. */
  leaderboardEligible: boolean;
  rollsUsed: number;
  probabilities: number[];
  tiltLevel: number;
  canShake: boolean;
  revision: string;
  /** Completion receipt survives reload even if this run falls out of the top ten. */
  recorded: boolean;
  jackpotNumber: number;
  lastRoll: Settlement | null;
}
export type Action =
  | { kind: "roll"; wagers: Wagers }
  | { kind: "shake" }
  | { kind: "restart"; nickname?: string }
  | { kind: "probabilities"; enabled: boolean }
  | { kind: "nickname"; nickname: string };
