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
  marker,
  parseGold,
  settle,
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
        probabilities TEXT NOT NULL, revision TEXT NOT NULL, last_roll TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS receipts (
        player_id TEXT NOT NULL REFERENCES players(id), request_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, response TEXT NOT NULL,
        PRIMARY KEY(player_id, request_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS best_gold_order ON players(length(best_gold) DESC, best_gold DESC, id);
    `);
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
      probabilities,
      revision: row.revision,
      jackpotNumber: marker(probabilities),
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
      .prepare("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, NULL)")
      .run(
        id,
        hash(token),
        `Player ${id.slice(0, 4).toUpperCase()}`,
        CONFIG.startingGold,
        CONFIG.startingGold,
        JSON.stringify(freshProbabilities(this.random)),
        "0",
      );
    return { token, state: this.get(id) };
  }
  leaderboard(): Leader[] {
    const rows = this.db
      .prepare(
        "SELECT id, nickname, best_gold FROM players ORDER BY length(best_gold) DESC, best_gold DESC, id ASC LIMIT ?",
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
        return JSON.parse(receipt.response);
      }
      const state = this.get(id);
      if (state.revision !== request.revision)
        throw new GameError(
          "Another tab changed this board. Your draft was cleared; review the current board.",
          409,
        );
      const action = request.action;
      let result: ActionResponse["result"] = null;
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
        if (settled.gold > BigInt(state.bestGold)) state.bestGold = state.gold;
      } else if (action.kind === "shake") {
        state.probabilities = freshProbabilities(this.random);
      } else if (action.kind === "restart") {
        if (state.gold !== "0")
          throw new GameError(
            "A new game is available when your Gold reaches zero.",
          );
        state.gold = CONFIG.startingGold;
        state.probabilities = freshProbabilities(this.random);
        state.lastRoll = null;
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
      this.db
        .prepare(
          "UPDATE players SET nickname = ?, gold = ?, best_gold = ?, probabilities = ?, revision = ?, last_roll = ? WHERE id = ?",
        )
        .run(
          state.nickname,
          state.gold,
          state.bestGold,
          JSON.stringify(state.probabilities),
          state.revision,
          state.lastRoll ? JSON.stringify(state.lastRoll) : null,
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
