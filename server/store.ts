import { DatabaseSync, type StatementSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
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
  settle,
  tiltLevel,
  type Random,
} from "./rules.ts";

interface Row {
  id: string;
  nickname: string;
  gold: string;
  best_gold: string;
  previous_best_gold: string | null;
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
  private readonly statements = new Map<string, StatementSync>();
  private prepare(sql: string) {
    let statement = this.statements.get(sql);
    if (!statement) { statement = this.db.prepare(sql); this.statements.set(sql, statement); }
    return statement;
  }
  constructor(
    path: string,
    private random: Random = secureRandom,
  ) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    try {
      const existingVersion = this.db.prepare("PRAGMA user_version").get()!.user_version as number;
      if (existingVersion > 3) throw new Error("Database schema is newer than this build. Use the matching release; do not downgrade this database.");
      const existingPlayers = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='players'").get();
      if (existingVersion === 0 && existingPlayers && this.db.prepare("SELECT 1 FROM players LIMIT 1").get())
        throw new Error("Legacy endless-game data cannot be reset automatically. Keep the original database and run its previous release, or choose a new DB_PATH for competition games.");
      if (path !== ":memory:") chmodSync(path, 0o600);
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
      `);
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const version = this.db.prepare("PRAGMA user_version").get()!.user_version as number;
        if (version < 1) {
          // Nonempty legacy databases were rejected before schema initialization.
          // Initialize new/empty storage without a destructive reset.
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
        if (version < 2) {
          if (!this.db.prepare("PRAGMA table_info(players)").all().some(column => column.name === "previous_best_gold"))
            this.db.exec("ALTER TABLE players ADD COLUMN previous_best_gold TEXT");
          // Existing finished runs can show the saved best, but their older best
          // was not recorded. Do not invent a 'new record' for those runs.
          this.db.exec("UPDATE players SET previous_best_gold = best_gold WHERE has_completed_run = 1");
          this.db.exec("PRAGMA user_version = 2");
        }
        if (version < 3) {
          if (!this.db.prepare("PRAGMA table_info(players)").all().some(column => column.name === "leaderboard_hidden"))
            this.db.exec("ALTER TABLE players ADD COLUMN leaderboard_hidden INTEGER NOT NULL DEFAULT 0 CHECK (leaderboard_hidden IN (0,1))");
          this.db.exec("PRAGMA user_version = 3");
        }
        this.db.exec(`DROP INDEX IF EXISTS best_gold_order;
          CREATE INDEX IF NOT EXISTS ranked_gold_order ON players(length(best_gold) DESC, best_gold DESC, id ASC)
          WHERE has_completed_run = 1 AND leaderboard_hidden = 0;`);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    } catch (error) { this.db.close(); throw error; }
  }
  close() {
    this.statements.clear();
    this.db.close();
  }
  private state(row: Row): PlayerState {
    const probabilities: number[] = JSON.parse(row.probabilities);
    return {
      id: row.id,
      nickname: row.nickname,
      gold: row.gold,
      bestGold: row.best_gold,
      previousBestGold: row.previous_best_gold,
      hasCompletedRun: row.has_completed_run === 1,
      rollsUsed: row.rolls_used,
      probabilities,
      tiltLevel: tiltLevel(probabilities),
      canShake: row.can_shake === 1,
      revision: row.revision,
      jackpotNumber: marker(probabilities),
      lastRoll: row.last_roll ? JSON.parse(row.last_roll) : null,
    };
  }
  get(id: string): PlayerState {
    const row = this.prepare("SELECT * FROM players WHERE id = ?")
      .get(id) as unknown as Row | undefined;
    if (!row) throw new GameError("Player session not found.", 401);
    return this.state(row);
  }
  session(token: string | undefined): PlayerState | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.prepare("SELECT * FROM players WHERE session_hash = ?")
      .get(hash(token)) as unknown as Row | undefined;
    return row ? this.state(row) : null;
  }
  identify(token: string | undefined): { id: string; revision: string } | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.prepare("SELECT id,revision FROM players WHERE session_hash=?").get(hash(token)) as { id: string; revision: string } | undefined || null;
  }
  create(): { token: string; state: PlayerState } {
    const token = randomBytes(32).toString("hex");
    const id = randomUUID();
    this.prepare("INSERT INTO players (id, session_hash, nickname, gold, best_gold, probabilities, revision, last_roll, can_shake) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0)")
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
  leaderboard(playerId?: string): Leader[] {
    type ScoreRow = Pick<Row, "id" | "nickname" | "best_gold">;
    const visible = "has_completed_run = 1 AND leaderboard_hidden = 0";
    const projection = "SELECT id,nickname,best_gold FROM players";
    const top = this.prepare(`${projection} WHERE ${visible} ORDER BY length(best_gold) DESC,best_gold DESC,id ASC LIMIT ?`).all(CONFIG.leaderboardLimit) as unknown as ScoreRow[];
    const leader = (row: ScoreRow, rank: number): Leader => ({ id: row.id, nickname: row.nickname, bestGold: row.best_gold, rank });
    const leaders = top.map((row, i) => leader(row, i + 1));
    if (!playerId || top.some(row => row.id === playerId)) return leaders;
    const own = this.prepare(`${projection} WHERE id=? AND ${visible}`).get(playerId) as ScoreRow | undefined;
    if (!own) return leaders;
    const length = own.best_gold.length;
    // Three disjoint indexed ranges retain stable ascending-ID ties. No ranking
    // table is materialized; each neighbor query returns at most two rows.
    const ranges = [
      { where: "length(best_gold)>?", params: [length], order: "length(best_gold) ASC,best_gold ASC,id DESC" },
      { where: "length(best_gold)=? AND best_gold>?", params: [length, own.best_gold], order: "best_gold ASC,id DESC" },
      { where: "length(best_gold)=? AND best_gold=? AND id<?", params: [length, own.best_gold, own.id], order: "id DESC" },
    ];
    let rank = 1;
    const nearby: ScoreRow[] = [];
    for (const range of ranges) {
      rank += this.prepare(`SELECT count(*) AS n FROM players WHERE ${visible} AND ${range.where}`).get(...range.params)!.n as number;
      nearby.push(...this.prepare(`${projection} WHERE ${visible} AND ${range.where} ORDER BY ${range.order} LIMIT 2`).all(...range.params) as unknown as ScoreRow[]);
    }
    nearby.sort((a, b) => a.best_gold.length - b.best_gold.length || (a.best_gold < b.best_gold ? -1 : a.best_gold > b.best_gold ? 1 : b.id.localeCompare(a.id)));
    const context = nearby.slice(0, 2).reverse();
    context.forEach((row, i) => { if (!top.some(topRow => topRow.id === row.id)) leaders.push(leader(row, rank - context.length + i)); });
    leaders.push(leader(own, rank));
    return leaders;
  }
  act(id: string, request: ActionRequest): ActionResponse {
    this.validateRequest(request);
    if (request.playerId !== undefined && request.playerId !== id)
      throw new GameError("The player session changed. This saved action belongs to another player.", 409);
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
      const receipt = this.prepare(
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
        return JSON.parse(receipt.response.startsWith("gz:")
          ? gunzipSync(Buffer.from(receipt.response.slice(3), "base64")).toString("utf8")
          : receipt.response) as ActionResponse;
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
          state.previousBestGold = state.hasCompletedRun ? state.bestGold : null;
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
        if (action.nickname !== undefined) state.nickname = this.nickname(action.nickname);
        state.gold = CONFIG.startingGold;
        state.probabilities = freshProbabilities(this.random);
        state.lastRoll = null;
        state.canShake = false;
        state.rollsUsed = 0;
        state.previousBestGold = null;
      } else {
        state.nickname = this.nickname(action.nickname);
      }
      state.revision = (BigInt(state.revision) + 1n).toString();
      state.jackpotNumber = marker(state.probabilities);
      state.tiltLevel = tiltLevel(state.probabilities);
      this.prepare(
          "UPDATE players SET nickname = ?, gold = ?, best_gold = ?, probabilities = ?, revision = ?, last_roll = ?, can_shake = ?, rolls_used = ?, has_completed_run = ?, previous_best_gold = ? WHERE id = ?",
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
          state.previousBestGold,
          id,
        );
      const response = { state, result };
      this.prepare("INSERT INTO receipts VALUES (?, ?, ?, ?)")
        .run(id, request.requestId, fingerprint, JSON.stringify(response));
      this.db.exec("COMMIT");
      return response;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec("ROLLBACK");
      throw error;
    }
  }
  private nickname(value: string) {
    if (value.length > 192) throw new GameError("Use a nickname of 1–24 visible characters.");
    const nickname = value.trim().normalize("NFC");
    if (!nickname || [...nickname].length > 24 || /[\p{C}]/u.test(nickname))
      throw new GameError("Use a nickname of 1–24 visible characters.");
    return nickname;
  }
  private validateRequest(request: ActionRequest) {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request) ||
      Object.keys(request).some(
        (k) => !["requestId", "revision", "playerId", "action"].includes(k),
      )
    )
      throw new GameError("Invalid action request.");
    if (
      typeof request.requestId !== "string" ||
      !/^[\w-]{16,100}$/.test(request.requestId)
    )
      throw new GameError("Invalid request ID.");
    if (typeof request.revision !== "string" || request.revision.length > 128 || !/^(0|[1-9]\d*)$/.test(request.revision))
      throw new GameError("Invalid revision.");
    if (request.playerId !== undefined && (typeof request.playerId !== "string" || !/^[a-f0-9-]{36}$/.test(request.playerId)))
      throw new GameError("Invalid player ID.");
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
        : action.kind === "nickname" || action.kind === "restart"
          ? ["kind", "nickname"]
          : ["kind"];
    if (Object.keys(action).some((k) => !allowed.includes(k)))
      throw new GameError("Unexpected action field.");
    // Validate the shallow wire shape before fingerprinting. Nested wager values
    // are invalid and could exhaust JSON.stringify's stack before settlement.
    if (action.kind === "roll" && (!action.wagers || typeof action.wagers !== "object" || Array.isArray(action.wagers) || Object.values(action.wagers).some(value => typeof value !== "string")))
      throw new GameError("Invalid wagers. Use decimal strings for bet amounts.");
    if (action.kind === "nickname" && typeof action.nickname !== "string")
      throw new GameError("Invalid nickname.");
    if (action.kind === "restart" && "nickname" in action && typeof action.nickname !== "string")
      throw new GameError("Invalid nickname.");
  }
}
