/** Local filesystem access is the authorization boundary; no administrative API. */
import { DatabaseSync, backup } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { openSync, closeSync, rmSync, chmodSync, realpathSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { inside } from "../server/config.ts";

const [command, ...args] = process.argv.slice(2);
const path = resolve(process.env.DB_PATH || "data/one-of-six.sqlite");
if (!existsSync(path)) throw new Error("Database does not exist. Set DB_PATH to the existing database.");
if (!["hide", "show", "backup", "compact", "info", "checkpoint"].includes(command))
  throw new Error("Usage: admin hide|show PLAYER_ID; backup NEW_FILE; compact [LIMIT=1000] [AFTER_ROWID=0]; info; checkpoint");
const database = new DatabaseSync(path, { readOnly: ["backup", "info"].includes(command) });
database.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
try {
  const version = database.prepare("PRAGMA user_version").get()!.user_version;
  // A read-only snapshot is also needed before the first upgrade, when the
  // database still has the old schema. It never interprets or migrates its rows.
  if (version !== 4 && command !== "backup") throw new Error("Use the administrative script matching this database's release. This script never migrates data.");
  if (command === "hide" || command === "show") {
    if (args.length !== 1 || !/^[a-f0-9-]{36}$/.test(args[0])) throw new Error("Supply the public player ID from the leaderboard (not a session cookie).");
    const result = database.prepare("UPDATE players SET leaderboard_hidden=? WHERE id=?").run(command === "hide" ? 1 : 0, args[0]);
    if (result.changes !== 1) throw new Error("Player not found.");
    console.log(command === "hide" ? "Entry hidden; game, score, and retry receipts preserved." : "Entry restored.");
  } else if (command === "backup") {
    if (args.length !== 1) throw new Error("Supply one new backup file path; existing backups are never overwritten.");
    const destination = resolve(args[0]);
    const actualParent = realpathSync(dirname(destination));
    for (const directory of ["dist", "public"]) {
      if (inside(actualParent, existsSync(directory) ? realpathSync(directory) : resolve(directory))) throw new Error("Backups must be outside static directories.");
    }
    const reserved = openSync(destination, "wx", 0o600);
    closeSync(reserved);
    try {
      await backup(database, destination);
      chmodSync(destination, 0o600);
      const check = new DatabaseSync(destination, { readOnly: true });
      try {
        if (check.prepare("PRAGMA quick_check").get()!.quick_check !== "ok" || check.prepare("PRAGMA foreign_key_check").all().length)
          throw new Error("Backup integrity check failed.");
      } finally { check.close(); }
    } catch (error) { rmSync(destination, { force: true }); throw error; }
    console.log("Consistent SQLite backup completed and integrity checked.");
  } else if (command === "compact") {
    const [rawLimit = "1000", rawAfter = "0"] = args;
    if (args.length > 2 || !/^[1-9]\d*$/.test(rawLimit) || Number(rawLimit) > 1000 || !/^\d+$/.test(rawAfter) || !Number.isSafeInteger(Number(rawAfter)))
      throw new Error("Compact takes a batch size from 1 to 1000 and a nonnegative after-rowid cursor.");
    const rows = database.prepare("SELECT rowid,response FROM receipts WHERE rowid>? ORDER BY rowid LIMIT ?").all(Number(rawAfter), Number(rawLimit)) as { rowid: number; response: string }[];
    let compacted = 0, savedBytes = 0;
    const packed = rows.filter(row => !row.response.startsWith("gz:")).map(row => ({ ...row, compressed: "gz:" + gzipSync(row.response, { level: 9 }).toString("base64") })).filter(row => row.compressed.length < row.response.length);
    database.exec("BEGIN IMMEDIATE");
    try {
      const update = database.prepare("UPDATE receipts SET response=? WHERE rowid=? AND response=?");
      for (const row of packed) {
        const result = update.run(row.compressed, row.rowid, row.response);
        if (result.changes) { compacted++; savedBytes += Buffer.byteLength(row.response) - Buffer.byteLength(row.compressed); }
      }
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    console.log(JSON.stringify({ examined: rows.length, compacted, savedBytes, nextAfterRowid: rows.at(-1)?.rowid ?? Number(rawAfter), moreMayRemain: rows.length === Number(rawLimit) }));
  } else if (command === "checkpoint") {
    if (args.length) throw new Error("Checkpoint accepts no arguments.");
    console.log(JSON.stringify(database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get()));
  } else {
    if (args.length) throw new Error("Info accepts no arguments.");
    console.log(JSON.stringify({ schemaVersion: version, players: database.prepare("SELECT count(*) AS n FROM players").get()!.n, receipts: database.prepare("SELECT count(*) AS n FROM receipts").get()!.n, hiddenEntries: database.prepare("SELECT count(*) AS n FROM players WHERE leaderboard_hidden=1").get()!.n, pages: database.prepare("PRAGMA page_count").get()!.page_count, freePages: database.prepare("PRAGMA freelist_count").get()!.freelist_count, pageBytes: database.prepare("PRAGMA page_size").get()!.page_size }));
  }
} finally { database.close(); }
