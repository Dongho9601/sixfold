import { CONFIG, TARGET_BY_ID } from "../config.ts";
import { marker, tiltLevel } from "./rules.ts";
import { newRun, transition } from "./run.ts";
import type { Action, PlayerState, Settlement, Wagers } from "../types.ts";

export type TutorialPhase = "number" | "coverage" | "result" | "shake" | "jackpot" | "complete";

/** A disposable practice run. It never receives a saved player or writes a record. */
export class Tutorial {
  phase: TutorialPhase = "number";
  state: PlayerState;
  wagers: Wagers = {};
  resultWagers: Wagers = {};
  group: string | null = null;
  result: Settlement | null = null;
  readonly stake = CONFIG.selectedWager;

  constructor() {
    this.state = newRun("practice", "Practice", () => .5);
    this.state.probabilities = [.03, .05, .68, .08, .07, .09];
    this.state.tiltLevel = tiltLevel(this.state.probabilities);
    this.state.jackpotNumber = marker(this.state.probabilities);
  }

  canBet(id: string) {
    const target = TARGET_BY_ID.get(id);
    if (!target) return false;
    if (this.phase === "number") return id === "n3";
    if (this.phase === "coverage") return target.kind !== "number" || id === "n3";
    return this.phase === "jackpot" && id === `n${this.state.jackpotNumber}` && !this.wagers[id];
  }

  bet(id: string, amount: string = this.stake) {
    if (!this.canBet(id)) return;
    const total = Object.values(this.wagers).reduce((sum, value) => sum + BigInt(value), 0n);
    if (BigInt(amount) < 1n || total + BigInt(amount) > BigInt(this.state.gold)) return;
    if (this.phase === "number") {
      this.wagers = { n3: amount };
      this.phase = "coverage";
    } else if (this.phase === "coverage") {
      if (id !== "n3") this.group = id;
      this.wagers[id] = (BigInt(this.wagers[id] ?? "0") + BigInt(amount)).toString();
    } else this.wagers = { [id]: amount };
  }

  remove(id: string) {
    if (this.phase !== "coverage" || TARGET_BY_ID.get(id)?.kind === "number") return;
    delete this.wagers[id];
    this.group = Object.keys(this.wagers).filter(id => id !== "n3").at(-1) ?? null;
  }

  get canRoll() {
    return (this.phase === "coverage" && this.group !== null) ||
      (this.phase === "jackpot" && Object.keys(this.wagers).length === 1);
  }

  canAct(action: Action) {
    return action.kind === "roll" ? this.canRoll : action.kind === "shake" && this.phase === "shake";
  }

  act(action: Action) {
    if (!this.canAct(action)) throw new Error("Follow the highlighted tutorial action.");
    if (action.kind === "roll") {
      this.roll();
      return { state: this.state, result: this.result };
    }
    this.shake();
    return { state: this.state, result: null };
  }

  roll() {
    if (!this.canRoll) return;
    const jackpot = this.phase === "jackpot";
    const outcome = jackpot ? this.state.jackpotNumber : 3;
    const p = this.state.probabilities;
    // Only the practice outcome is guided. Payouts, transfers and replacements
    // go through the same rules as the real game, without consuming its RNG.
    const draw = p.slice(0, outcome - 1).reduce((sum, value) => sum + value, 0) + p[outcome - 1] / 2;
    let first = true;
    const next = transition(this.state, { kind: "roll", wagers: this.wagers }, () => {
      if (first) { first = false; return draw; }
      return .5;
    }, this.state.id);
    this.state = next.state;
    this.result = next.result;
    this.resultWagers = { ...this.wagers };
    this.wagers = {};
    this.phase = jackpot ? "complete" : "result";
  }

  continue() {
    if (this.phase === "result") this.phase = "shake";
  }

  shake() {
    if (this.phase !== "shake") return;
    const draws = [.2, .35, .8, .4, .65, .5];
    let i = 0;
    this.state = transition(this.state, { kind: "shake" }, () => draws[i++ % draws.length], this.state.id).state;
    this.result = null;
    this.phase = "jackpot";
  }
}
