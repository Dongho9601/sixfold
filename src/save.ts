import { CONFIG, TARGET_BY_ID, TUTORIAL_VERSION } from "./config.ts";
import type { Action, PlayerState, Settlement } from "./types.ts";
import { parseGold, tiltLevel, marker, type Random } from "./game/rules.ts";
import { browserRandom, runId } from "./game/random.ts";
import { compareRecords, newRun, nickname, recordCompletion, transition, type PersonalRecord } from "./game/run.ts";

export const SAVE_KEY = "sixfold:save:v1";
export const RECOVERY_KEY = "sixfold:save:recovery";
export const SETTINGS_JOURNAL_KEY = "sixfold:settings:pending:v1";
export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
  swapMobileActions: boolean;
  guideLanguage: string | null;
  guideSeen: boolean;
  tutorialVersion: number;
  recentAmounts: string[];
}
export interface Save {
  version: 1;
  revision: string;
  state: PlayerState;
  settings: Settings;
  records: PersonalRecord[];
}
type StorageAccess = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const decimal = (value: unknown): value is string => {
  try { parseGold(value); return true; } catch { return false; }
};
const bool = (value: unknown) => typeof value === "boolean";
const probabilities = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === 6 && value.every(p => typeof p === "number" && Number.isFinite(p) && p > 0 && p < 1) &&
  Math.abs(value.reduce((sum, p) => sum + p, 0) - 1) < 1e-9;
const face = (value: unknown) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6;
const name = (value: unknown): value is string => {
  try { return typeof value === "string" && nickname(value) === value; } catch { return false; }
};
const id = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
function validSettlement(value: unknown): value is Settlement | null {
  if (value === null) return true;
  return object(value) && face(value.outcome) && decimal(value.stake) && decimal(value.totalReturn) &&
    typeof value.net === "string" && /^(0|-?[1-9]\d*)$/.test(value.net) &&
    BigInt(value.net) === BigInt(value.totalReturn) - BigInt(value.stake) &&
    bool(value.jackpot) && bool(value.transferred) && face(value.markerBefore) &&
    probabilities(value.probabilitiesBefore) && probabilities(value.probabilitiesAfter) &&
    Array.isArray(value.paidTargets) && value.paidTargets.every(target => typeof target === "string" && TARGET_BY_ID.has(target));
}
function validSettings(p: unknown): p is Settings {
  return object(p) && bool(p.sound) && bool(p.reducedMotion) && bool(p.guideSeen) &&
    (p.tutorialVersion === undefined || (typeof p.tutorialVersion === "number" && Number.isInteger(p.tutorialVersion) && p.tutorialVersion >= 0 && p.tutorialVersion <= TUTORIAL_VERSION)) &&
    (p.swapMobileActions === undefined || bool(p.swapMobileActions)) &&
    (p.guideLanguage === null || (typeof p.guideLanguage === "string" && ["en", "ko", "ja", "zh", "es", "fr", "de"].includes(p.guideLanguage))) &&
    Array.isArray(p.recentAmounts) && p.recentAmounts.length <= 3 &&
    p.recentAmounts.every(amount => decimal(amount) && amount !== "0") && new Set(p.recentAmounts).size === p.recentAmounts.length;
}

/** Validate the complete boundary before any saved value reaches the UI or BigInt. */
export function decodeSave(raw: string): Save {
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !decimal(value.revision) || !object(value.state) || !object(value.settings) || !Array.isArray(value.records))
    throw new Error("Incompatible save.");
  const s = value.state, p = value.settings;
  if (!id(s.id) || !name(s.nickname) || !decimal(s.gold) || !decimal(s.bestGold) ||
    !(s.boardStartingGold === undefined || decimal(s.boardStartingGold)) ||
    !(s.previousBestGold === null || decimal(s.previousBestGold)) || !decimal(s.revision) ||
    ![s.hasCompletedRun, s.showProbabilities, s.leaderboardEligible, s.canShake, s.recorded].every(bool) ||
    !Number.isInteger(s.rollsUsed) || Number(s.rollsUsed) < 0 || Number(s.rollsUsed) > CONFIG.rollsPerRun ||
    !probabilities(s.probabilities) || !validSettlement(s.lastRoll) ||
    (s.showProbabilities && s.leaderboardEligible) || (s.recorded && (s.rollsUsed !== CONFIG.rollsPerRun || !s.leaderboardEligible)) ||
    ((s.rollsUsed === CONFIG.rollsPerRun || s.gold === "0") && s.canShake))
    throw new Error("Invalid saved run.");
  if (!validSettings(p))
    throw new Error("Invalid saved settings.");
  if (value.records.length > CONFIG.leaderboardLimit || value.records.some(r =>
    !object(r) || !id(r.id) || !name(r.nickname) || !decimal(r.score) || !decimal(r.order)) ||
    new Set(value.records.map(r => r.id)).size !== value.records.length)
    throw new Error("Invalid personal records.");
  const save = value as unknown as Save;
  save.settings.swapMobileActions ??= false;
  save.settings.tutorialVersion ??= 0;
  // Earlier v1 saves did not track die arrivals. Begin the counter at the
  // restored bankroll instead of guessing profit from an unknown board history.
  save.state.boardStartingGold ??= save.state.gold;
  // Derived display fields are recomputed; probabilities themselves stay exact.
  save.state.tiltLevel = tiltLevel(save.state.probabilities);
  save.state.jackpotNumber = marker(save.state.probabilities);
  save.records.sort(compareRecords);
  return save;
}

export class StaleRunError extends Error {
  constructor() { super("This game changed in another tab. Draft cleared; review the saved board."); }
}

/** One JSON write commits the run, its completion receipt, settings and records. */
export class LocalGame {
  data: Save;
  warning = "";
  private storage?: StorageAccess;
  private queue: Promise<unknown> = Promise.resolve();
  private pendingSettings: Partial<Settings> = {};
  private settingsJournal: string | null = null;
  constructor(
    access: () => StorageAccess = () => localStorage,
    private random: Random = browserRandom,
    private makeId: () => string = runId,
  ) {
    try { this.storage = access(); } catch { this.unavailable(); }
    const loaded = this.read();
    this.data = loaded ?? {
      version: 1, revision: "0", state: newRun(this.makeId(), "Player", this.random),
      settings: { sound: true, reducedMotion: false, swapMobileActions: false, guideLanguage: null, guideSeen: false, tutorialVersion: 0, recentAmounts: [] },
      records: [],
    };
    // Recovery of a valid completion without a receipt is also idempotent.
    const recorded = this.data.state.recorded;
    this.data.records = recordCompletion(this.data.state, this.data.records);
    if (!loaded || recorded !== this.data.state.recorded) this.write();
    this.resumeSettings();
  }
  private unavailable() {
    this.storage = undefined;
    this.warning = "Browser storage is unavailable. You can play, but progress and personal records cannot be saved.";
  }
  private read(): Save | null {
    if (!this.storage) return null;
    let raw: string | null;
    try { raw = this.storage.getItem(SAVE_KEY); } catch { this.unavailable(); return null; }
    if (raw === null) return null;
    try { return decodeSave(raw); } catch {
      this.warning = "The previous Sixfold save could not be read. A fresh run is ready; the unreadable save is kept in Sixfold’s recovery storage.";
      try { if (this.storage.getItem(RECOVERY_KEY) === null) this.storage.setItem(RECOVERY_KEY, raw); }
      catch { this.unavailable(); }
      return null;
    }
  }
  private write() {
    if (!this.storage) return;
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { this.unavailable(); }
  }
  refresh(): boolean {
    const latest = this.read();
    if (!latest || BigInt(latest.revision) <= BigInt(this.data.revision)) return false;
    this.data = latest;
    return true;
  }
  private serialized<T>(work: () => T): Promise<T> {
    const task = this.queue.then(async () => {
      // GitHub Pages is HTTPS. Web Locks serializes writes across its tabs.
      if (typeof navigator !== "undefined" && navigator.locks)
        return await navigator.locks.request("sixfold:save:write", async () => work());
      // Older browsers still check the latest revision before a synchronous write.
      return work();
    });
    this.queue = task.catch(() => {});
    return task;
  }
  act(expected: Pick<PlayerState, "id" | "revision">, action: Action) {
    return this.serialized(() => {
      this.refresh();
      if (expected.id !== this.data.state.id || expected.revision !== this.data.state.revision)
        throw new StaleRunError();
      const response = transition(this.data.state, action, this.random, action.kind === "restart" ? this.makeId() : this.data.state.id);
      this.data.state = response.state;
      this.data.records = recordCompletion(response.state, this.data.records);
      if (action.kind === "nickname" || (action.kind === "restart" && action.nickname !== undefined))
        this.data.records = this.data.records.map(record => record.id === expected.id ? { ...record, nickname: response.state.nickname } : record);
      this.data.revision = (BigInt(this.data.revision) + 1n).toString();
      this.write(); // Always before returning an outcome to the animation layer.
      return response;
    });
  }
  updateSettings(patch: Partial<Settings>) {
    this.pendingSettings = { ...this.pendingSettings, ...patch };
    return this.serialized(() => this.flushSettings());
  }
  /** Navigation cannot await a lock. Journal only preferences, never a stale run. */
  stageSettings() {
    if (!this.storage || !Object.keys(this.pendingSettings).length) return;
    const raw = JSON.stringify({ version: 1, patch: this.pendingSettings });
    try {
      this.storage.setItem(SETTINGS_JOURNAL_KEY, raw);
      this.settingsJournal = raw;
    } catch { this.unavailable(); }
  }
  private resumeSettings() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(SETTINGS_JOURNAL_KEY);
      if (!raw) return;
      const journal: unknown = JSON.parse(raw);
      if (!object(journal) || journal.version !== 1 || !object(journal.patch) ||
        Object.keys(journal.patch).some(key => !Object.keys(this.data.settings).includes(key))) return;
      const settings = { ...this.data.settings, ...journal.patch };
      if (!validSettings(settings)) return;
      this.data.settings = settings;
      this.pendingSettings = journal.patch;
      this.settingsJournal = raw;
      void this.serialized(() => this.flushSettings());
    } catch { /* An unreadable optional preference journal never invalidates the run. */ }
  }
  private flushSettings() {
    if (!Object.keys(this.pendingSettings).length) return;
    this.refresh();
    this.data.settings = { ...this.data.settings, ...this.pendingSettings };
    this.pendingSettings = {};
    this.data.revision = (BigInt(this.data.revision) + 1n).toString();
    this.write();
    try {
      if (this.settingsJournal && this.storage?.getItem(SETTINGS_JOURNAL_KEY) === this.settingsJournal)
        this.storage.removeItem?.(SETTINGS_JOURNAL_KEY);
      this.settingsJournal = null;
    } catch { /* The committed save remains valid if journal cleanup is blocked. */ }
  }
}
