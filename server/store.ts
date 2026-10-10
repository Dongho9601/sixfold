import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CONFIG } from "../src/config.ts";
import type {
  ActionRequest,
  ActionResponse,
  Leader,
  PlayerState,
} from "../src/types.ts";
import {
  freshProbabilities,
  GameError,
  jackpotAvailable,
  marker,
  parseGold,
  settle,
  tiltLevel,
  type Random,
} from "./rules.ts";

interface Row {
  id: string;
  nickname: string;
  gold: string;
  best_gold: string;
  probabilities: string;
  revision: string;
  last_roll: string | null;
  can_shake: number;
  rolls_used: number;
  has_completed_run: number;
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export const secureRandom: Random = () =>
  randomBytes(6).readUIntBE(0, 6) / 281474976710656;

export class Store {
  readonly db: DatabaseSync;
  constructor(
    path: string,
    private random: Random = secureRandom,
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, session_hash TEXT NOT NULL UNIQUE,
        nickname TEXT NOT NULL, gold TEXT NOT NULL, best_gold TEXT NOT NULL,
        probabilities TEXT NOT NULL, revision TEXT NOT NULL, last_roll TEXT,
        can_shake INTEGER NOT NULL DEFAULT 0 CHECK (can_shake IN (0, 1)),
        rolls_used INTEGER NOT NULL DEFAULT 0 CHECK (rolls_used BETWEEN 0 AND 100),
        has_completed_run INTEGER NOT NULL DEFAULT 0 CHECK (has_completed_run IN (0, 1))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS receipts (
        player_id TEXT NOT NULL REFERENCES players(id), request_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, response TEXT NOT NULL,
        PRIMARY KEY(player_id, request_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS best_gold_order ON players(length(best_gold) DESC, best_gold DESC, id);
    `);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = this.db.prepare("PRAGMA user_version").get()!.user_version as number;
      if (version < 1) {
        // One-time reset requested for the new competition. Old endless-game
        // scores, sessions and receipts must not enter or replay into ranked runs.
        this.db.exec("DELETE FROM receipts; DELETE FROM players;");
        const columns = this.db.prepare("PRAGMA table_info(players)").all();
        for (const [name, check] of [
          ["can_shake", "can_shake IN (0, 1)"],
          ["rolls_used", "rolls_used BETWEEN 0 AND 100"],
          ["has_completed_run", "has_completed_run IN (0, 1)"],
        ]) {
          if (!columns.some(column => column.name === name))
            this.db.exec(`ALTER TABLE players ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0 CHECK (${check})`);
        }
        this.db.exec("PRAGMA user_version = 1");
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  private state(row: Row): PlayerState {
    const probabilities: number[] = JSON.parse(row.probabilities);
    return {
      id: row.id,
      nickname: row.nickname,
      gold: row.gold,
      bestGold: row.best_gold,
      hasCompletedRun: row.has_completed_run === 1,
      rollsUsed: row.rolls_used,
      probabilities,
      tiltLevel: tiltLevel(probabilities),
      canShake: row.can_shake === 1,
      revision: row.revision,
      jackpotNumber: marker(probabilities),
      jackpotAvailable: jackpotAvailable(probabilities),
      lastRoll: row.last_roll ? JSON.parse(row.last_roll) : null,
    };
  }
  get(id: string): PlayerState {
    const row = this.db
      .prepare("SELECT * FROM players WHERE id = ?")
      .get(id) as unknown as Row | undefined;
    if (!row) throw new GameError("Player session not found.", 401);
    return this.state(row);
  }
  session(token: string | undefined): PlayerState | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.db
      .prepare("SELECT * FROM players WHERE session_hash = ?")
      .get(hash(token)) as unknown as Row | undefined;
    return row ? this.state(row) : null;
  }
  create(): { token: string; state: PlayerState } {
    const token = randomBytes(32).toString("hex");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO players (id, session_hash, nickname, gold, best_gold, probabilities, revision, last_roll, can_shake) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0)")
      .run(
        id,
        hash(token),
        `Player ${id.slice(0, 4).toUpperCase()}`,
        CONFIG.startingGold,
        "0",
        JSON.stringify(freshProbabilities(this.random)),
        "0",
      );
    return { token, state: this.get(id) };
  }
  leaderboard(): Leader[] {
    const rows = this.db
      .prepare(
        "SELECT id, nickname, best_gold FROM players WHERE has_completed_run = 1 ORDER BY length(best_gold) DESC, best_gold DESC, id ASC LIMIT ?",
      )
      .all(CONFIG.leaderboardLimit) as unknown as Row[];
    return rows.map((row, i) => ({
      id: row.id,
      nickname: row.nickname,
      bestGold: row.best_gold,
      rank: i + 1,
    }));
  }
  act(id: string, request: ActionRequest): ActionResponse {
    this.validateRequest(request);
    const fingerprint = hash(
      JSON.stringify(
        { revision: request.revision, action: request.action },
        (_key, value) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(
                Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
              )
            : value,
      ),
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const receipt = this.db
        .prepare(
          "SELECT fingerprint, response FROM receipts WHERE player_id = ? AND request_id = ?",
        )
        .get(id, request.requestId) as
        | { fingerprint: string; response: string }
        | undefined;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new GameError(
            "This request ID was already used for a different action.",
            409,
          );
        this.db.exec("COMMIT");
        return JSON.parse(receipt.response) as ActionResponse;
      }
      const state = this.get(id);
      if (state.revision !== request.revision)
        throw new GameError(
          "Another tab changed this board. Your draft was cleared; review the current board.",
          409,
        );
      const action = request.action;
      let result: ActionResponse["result"] = null;
      const finished = state.rollsUsed >= CONFIG.rollsPerRun || state.gold === "0";
      if (finished && (action.kind === "roll" || action.kind === "shake"))
        throw new GameError("This run has ended. Start a new run with 100 G.");
      if (action.kind === "roll") {
        const settled = settle(
          BigInt(state.gold),
          state.probabilities,
          action.wagers,
          this.random,
        );
        state.gold = settled.gold.toString();
        state.probabilities = settled.probabilities;
        state.lastRoll = result = settled.result;
        state.rollsUsed++;
        state.canShake = settled.result.jackpot
          ? false
          : state.canShake || settled.result.net !== "0";
        if (state.rollsUsed === CONFIG.rollsPerRun) {
          if (!state.hasCompletedRun || settled.gold > BigInt(state.bestGold))
            state.bestGold = state.gold;
          state.hasCompletedRun = true;
        }
        if (state.gold === "0" || state.rollsUsed === CONFIG.rollsPerRun)
          state.canShake = false;
      } else if (action.kind === "shake") {
        if (!state.canShake)
          throw new GameError("Shake unlocks after a roll changes your bankroll. Break-even rolls do not count.");
        state.probabilities = freshProbabilities(this.random);
        state.canShake = false;
      } else if (action.kind === "restart") {
        state.gold = CONFIG.startingGold;
        state.probabilities = freshProbabilities(this.random);
        state.lastRoll = null;
        state.canShake = false;
        state.rollsUsed = 0;
      } else {
        const nickname = action.nickname.trim().normalize("NFC");
        if (
          nickname.length < 1 ||
          [...nickname].length > 24 ||
          /[\p{C}]/u.test(nickname)
        )
          throw new GameError("Use a nickname of 1–24 visible characters.");
        state.nickname = nickname;
      }
      state.revision = (BigInt(state.revision) + 1n).toString();
      state.jackpotNumber = marker(state.probabilities);
      state.jackpotAvailable = jackpotAvailable(state.probabilities);
      state.tiltLevel = tiltLevel(state.probabilities);
      this.db
        .prepare(
          "UPDATE players SET nickname = ?, gold = ?, best_gold = ?, probabilities = ?, revision = ?, last_roll = ?, can_shake = ?, rolls_used = ?, has_completed_run = ? WHERE id = ?",
        )
        .run(
          state.nickname,
          state.gold,
          state.bestGold,
          JSON.stringify(state.probabilities),
          state.revision,
          state.lastRoll ? JSON.stringify(state.lastRoll) : null,
          state.canShake ? 1 : 0,
          state.rollsUsed,
          state.hasCompletedRun ? 1 : 0,
          id,
        );
      const response = { state, result };
      this.db
        .prepare("INSERT INTO receipts VALUES (?, ?, ?, ?)")
        .run(id, request.requestId, fingerprint, JSON.stringify(response));
      this.db.exec("COMMIT");
      return response;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private validateRequest(request: ActionRequest) {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request) ||
      Object.keys(request).some(
        (k) => !["requestId", "revision", "action"].includes(k),
      )
    )
      throw new GameError("Invalid action request.");
    if (
      typeof request.requestId !== "string" ||
      !/^[\w-]{16,100}$/.test(request.requestId)
    )
      throw new GameError("Invalid request ID.");
    parseGold(request.revision);
    const action = request.action;
    if (
      !action ||
      typeof action !== "object" ||
      Array.isArray(action) ||
      !["roll", "shake", "restart", "nickname"].includes(action.kind)
    )
      throw new GameError("Unknown action.");
    const allowed =
      action.kind === "roll"
        ? ["kind", "wagers"]
        : action.kind === "nickname"
          ? ["kind", "nickname"]
          : ["kind"];
    if (Object.keys(action).some((k) => !allowed.includes(k)))
      throw new GameError("Unexpected action field.");
    if (action.kind === "nickname" && typeof action.nickname !== "string")
      throw new GameError("Invalid nickname.");
  }
}
