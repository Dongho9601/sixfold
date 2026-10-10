/** Bounded, isolated recovery and storage checks. Never accepts an existing DB or URL. */
import assert from "node:assert/strict";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../server/store.ts";
import type { ActionRequest, ActionResponse, PlayerState } from "../src/types.ts";

if (process.argv.length !== 2) throw new Error("This check accepts no arguments, existing data path, or public URL.");
const exec = promisify(execFile);
const root = mkdtempSync(join(tmpdir(), "sixfold-closure-"));
const children = new Set<ChildProcess>();
const request = (state: PlayerState): ActionRequest => ({ requestId: randomUUID(), playerId: state.id, revision: state.revision, action: { kind: "roll", wagers: { red: "1", black: "1" } } });
const size = (path: string) => existsSync(path) ? statSync(path).size : 0;
function files(path: string) {
  const databaseBytes = size(path), walBytes = size(path + "-wal"), shmBytes = size(path + "-shm");
  return { databaseBytes, walBytes, shmBytes, totalBytes: databaseBytes + walBytes + shmBytes };
}
function admin(path: string, ...args: string[]) {
  return exec(process.execPath, ["--import", "tsx", "scripts/admin.ts", ...args], { cwd: process.cwd(), env: { ...process.env, DB_PATH: path } });
}
async function port() {
  const probe = createServer();
  await new Promise<void>(done => probe.listen(0, "127.0.0.1", done));
  const value = (probe.address() as { port: number }).port;
  await new Promise<void>(done => probe.close(() => done()));
  return value;
}
async function start(path: string, listenPort: number) {
  const origin = `http://127.0.0.1:${listenPort}`;
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", DB_PATH: path, HOST: "127.0.0.1", PORT: String(listenPort), PUBLIC_ORIGIN: origin, ALLOW_INSECURE_HTTP: "true", STATIC_COMPRESSION: "true" };
  delete env.TRUST_PROXY_IPS;
  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  // Bound startup diagnostics; do not retain action bodies, cookies, or player IDs.
  let diagnostics = "";
  child.stderr!.on("data", data => { diagnostics = (diagnostics + String(data)).slice(-2048); });
  await new Promise<void>((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Production startup timed out: " + diagnostics)), 10000);
    child.stdout!.on("data", data => { if (String(data).includes("Listening:")) { clearTimeout(timer); done(); } });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Production startup exited ${code}: ${diagnostics}`)); });
  });
  const health = await fetch(origin + "/healthz", { signal: AbortSignal.timeout(5000) });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("set-cookie"), null);
  const index = await fetch(origin + "/", { signal: AbortSignal.timeout(5000) });
  assert.equal(index.status, 200);
  assert.match(await index.text(), /Sixfold/);
  return { child, origin };
}
async function stop(child: ChildProcess) {
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    const [code, signal] = await exited;
    assert.equal(code, 0); assert.equal(signal, null);
  } finally { clearTimeout(timeout); children.delete(child); }
}
async function state(origin: string, cookie: string) {
  const response = await fetch(origin + "/api/state", { headers: { cookie }, signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  return await response.json() as PlayerState;
}
async function action(origin: string, cookie: string, value: ActionRequest) {
  const response = await fetch(origin + "/api/action", { method: "POST", headers: { cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(value), signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  return { text: await response.text() };
}
async function productionRecovery() {
  const path = join(root, "source/game.sqlite"), snapshot = join(root, "snapshot.sqlite"), restoredPath = join(root, "restored/private/game.sqlite");
  const listenPort = await port();
  let server = await start(path, listenPort);
  const initialResponse = await fetch(server.origin + "/api/state", { signal: AbortSignal.timeout(5000) });
  assert.equal(initialResponse.status, 200);
  const cookie = initialResponse.headers.get("set-cookie")!.split(";")[0];
  const initial = await initialResponse.json() as PlayerState;
  const firstRequest = request(initial), first = await action(server.origin, cookie, firstRequest);
  const receipt = JSON.parse(first.text) as ActionResponse;
  await admin(path, "backup", snapshot); // Source remains live in WAL mode.
  const backupHash = createHash("sha256").update(readFileSync(snapshot)).digest("hex");
  await stop(server.child);
  server = await start(path, listenPort);
  assert.deepEqual(await state(server.origin, cookie), receipt.state);
  assert.equal((await action(server.origin, cookie, firstRequest)).text, first.text);
  await stop(server.child);
  mkdirSync(join(root, "restored/private"), { recursive: true, mode: 0o700 });
  copyFileSync(snapshot, restoredPath);
  server = await start(restoredPath, listenPort);
  assert.deepEqual(await state(server.origin, cookie), receipt.state);
  assert.equal((await action(server.origin, cookie, firstRequest)).text, first.text);
  const nextRequest = request(receipt.state), next = await action(server.origin, cookie, nextRequest);
  const nextReceipt = JSON.parse(next.text) as ActionResponse;
  assert.equal(nextReceipt.state.rollsUsed, 2);
  assert.equal(BigInt(nextReceipt.state.revision), BigInt(receipt.state.revision) + 1n);
  await stop(server.child);
  server = await start(restoredPath, listenPort);
  assert.deepEqual(await state(server.origin, cookie), nextReceipt.state);
  assert.equal((await action(server.origin, cookie, firstRequest)).text, first.text);
  assert.equal((await action(server.origin, cookie, nextRequest)).text, next.text);
  await stop(server.child);
  const check = new DatabaseSync(restoredPath, { readOnly: true });
  try {
    assert.equal(check.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 2);
    assert.equal(check.prepare("PRAGMA quick_check").get()!.quick_check, "ok");
    assert.equal(check.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { check.close(); }
  assert.equal(createHash("sha256").update(readFileSync(snapshot)).digest("hex"), backupHash);
  return { productionStarts: 4, gracefulStops: 4, originalRestart: true, liveBackup: true, restoredIntoNewDirectory: true, savedStateRestored: true, byteIdenticalOldReplay: true, newActionAndRestart: true, byteIdenticalNewReplay: true, receipts: 2, integrity: "ok", databaseMode: statSync(restoredPath).mode & 0o777, developmentDependenciesAbsent: ["vite", "typescript", "playwright"].every(name => !existsSync(resolve("node_modules", name))) };
}
async function storageGrowth() {
  const path = join(root, "growth/game.sqlite"), snapshot = join(root, "growth-backup.sqlite");
  new Store(path).close(); // Close/checkpoint schema creation to give a standalone initial size.
  const initial = files(path);
  const store = new Store(path);
  let closed = false;
  try {
    const players = Array.from({ length: 10 }, () => store.create().state);
    const afterSessions = files(path);
    const pageBytes = store.db.prepare("PRAGMA page_size").get()!.page_size as number;
    const settings = { journalMode: store.db.prepare("PRAGMA journal_mode").get()!.journal_mode, synchronous: store.db.prepare("PRAGMA synchronous").get()!.synchronous, foreignKeys: store.db.prepare("PRAGMA foreign_keys").get()!.foreign_keys, autoCheckpointPages: store.db.prepare("PRAGMA wal_autocheckpoint").get()!.wal_autocheckpoint };
    assert.equal(settings.journalMode, "wal"); assert.equal(settings.synchronous, 2); assert.equal(settings.foreignKeys, 1);
    const peak = { ...afterSessions };
    for (let player of players) for (let i = 0; i < 100; i++) {
      player = store.act(player.id, request(player)).state;
      const sample = files(path);
      for (const key of ["databaseBytes", "walBytes", "shmBytes", "totalBytes"] as const) peak[key] = Math.max(peak[key], sample[key]);
    }
    assert.equal(store.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 1000);
    const afterActionsOpen = files(path);
    const logicalDatabaseBytes = (store.db.prepare("PRAGMA page_count").get()!.page_count as number) * pageBytes;
    const freePages = store.db.prepare("PRAGMA freelist_count").get()!.freelist_count;
    await admin(path, "backup", snapshot);
    const backup = files(snapshot);
    const backupCheck = new DatabaseSync(snapshot, { readOnly: true });
    try { assert.equal(backupCheck.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 1000); assert.equal(backupCheck.prepare("PRAGMA quick_check").get()!.quick_check, "ok"); }
    finally { backupCheck.close(); }
    store.close(); closed = true;
    const afterActionsClosed = files(path);
    return { newActions: 1000, newPlayers: 10, actionKinds: "100 rolls per player; 1 G red plus 1 G black", seededLeaderboardRows: 0, retainedReceipts: 1000, initial, afterSessions, afterActionsOpen, peakDuringActions: peak, logicalDatabaseBytes, freePages, pageBytes, settings, backup, afterActionsClosed, databaseGrowthAboveInitialBytes: afterActionsClosed.databaseBytes - initial.databaseBytes, growthPerActionIncludingPlayersBytes: (afterActionsClosed.databaseBytes - initial.databaseBytes) / 1000, receiptCompaction: false, method: "File lengths, not allocated filesystem blocks. Per-action file sampling includes WAL/SHM; checkpoint and durability settings are unchanged. The standalone initial database includes only schema/index creation. Backup was generated live and includes all receipts." };
  } finally { if (!closed) store.close(); }
}

try {
  assert.ok(existsSync(resolve("dist/index.html")), "Run npm run build before this check.");
  const recovery = await productionRecovery();
  const growth = await storageGrowth();
  console.log(JSON.stringify({ runtime: { node: process.version, sqlite: process.versions.sqlite, platform: process.platform, arch: process.arch }, recovery, growth }, null, 2));
} finally {
  for (const child of children) if (child.exitCode === null) { child.kill("SIGKILL"); await once(child, "exit").catch(() => {}); }
  rmSync(root, { recursive: true, force: true });
}
