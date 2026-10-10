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
  | { kind: "restart" }
  | { kind: "nickname"; nickname: string };
export interface ActionRequest {
  requestId: string;
  revision: string;
  action: Action;
}
export interface ActionResponse {
  state: PlayerState;
  result: Settlement | null;
}
export interface Leader {
  id: string;
  nickname: string;
  bestGold: string;
  rank: number;
}
