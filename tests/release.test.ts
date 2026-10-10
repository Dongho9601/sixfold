import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, statSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../server/store.ts";
import { createGameServer, MAX_BODY_BYTES, clientIp, type HttpOptions } from "../server/http.ts";
import { createStaticHandler } from "../server/static.ts";
import { RateLimiter } from "../server/limits.ts";
import { readConfig, storageLocation, inside } from "../server/config.ts";
import type { Action, ActionRequest } from "../src/types.ts";

const exec = promisify(execFile);
const action = (revision = "0", value: Action = { kind: "roll", wagers: { red: "1", black: "1" } }): ActionRequest => ({ requestId: randomUUID(), revision, action: value });
const wideLimits = { network: { capacity: 10000, perSecond: 10000 }, reads: { capacity: 10000, perSecond: 10000 }, actions: { capacity: 10000, perSecond: 10000 } };
function temporary(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-release-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
async function http(t: TestContext, options: HttpOptions = {}, store = new Store(":memory:", () => .1), fallback?: Parameters<typeof createGameServer>[1]) {
  const server = createGameServer(store, fallback, { limits: wideLimits, ...options });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); });
  const response = await fetch(origin + "/api/state", { headers: options.publicOrigin ? { Origin: options.publicOrigin } : {} });
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const state = await response.json();
  const post = (value: unknown = action(), extra: Record<string, string> = {}) => fetch(origin + "/api/action", { method: "POST", headers: { cookie, Origin: options.publicOrigin || origin, "Content-Type": "application/json", ...extra }, body: JSON.stringify(value) });
  return { store, server, origin, cookie, state, post, first: response };
}
function raw(origin: string, path: string, options: { method?: string; headers?: Record<string, string>; chunks?: Buffer[] } = {}) {
  return new Promise<{ status: number; text: string; headers: IncomingMessage["headers"] }>((resolve, reject) => {
    const req = httpRequest(origin + path, { method: options.method || "POST", headers: options.headers }, res => {
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode!, text: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on("error", reject);
    for (const chunk of options.chunks || []) req.write(chunk);
    req.end();
  });
}

test("methods, JSON types, byte limits and malformed input reject without settlement or internal errors", async t => {
  const game = await http(t);
  for (const [path, method, allow] of [["/api/state", "POST", "GET, HEAD"], ["/api/action", "GET", "POST"], ["/api/action", "OPTIONS", "POST"]]) {
    const response = await fetch(game.origin + path, { method });
    assert.equal(response.status, 405); assert.equal(response.headers.get("allow"), allow);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
  for (const type of ["text/plain", "application/jsonp", "application/json; charset=latin1", "application/jsonbad"]) assert.equal((await game.post(action(), { "Content-Type": type })).status, 415);
  assert.equal((await game.post(action(), { "Content-Encoding": "gzip" })).status, 415);
  for (const bad of [null, [], {}, { ...action(), score: "99" }, action("01"), action("-1"), action("9".repeat(129)), { ...action(), requestId: "x".repeat(101) }, { ...action(), action: { kind: "roll", wagers: { nowhere: "1" } } }, { ...action(), action: { kind: "roll", wagers: [] } }, { ...action(), action: { kind: "roll", wagers: { red: 1 } } }, action("0", { kind: "roll", wagers: { red: "9".repeat(5000) } }), action("0", { kind: "nickname", nickname: "\u202Ebad" }), action("0", { kind: "nickname", nickname: "x".repeat(193) }), { ...action(), action: { kind: "restart", nickname: {} } }]) {
    const response = await game.post(bad);
    assert.equal(response.status, 400, JSON.stringify(bad).slice(0, 200));
    const error = await response.json(); assert.equal(typeof error.error, "string"); assert.doesNotMatch(error.error, /SQLITE|TypeError|stack/i);
  }
  const headers = { cookie: game.cookie, Origin: game.origin, "Content-Type": "application/json" };
  assert.equal((await raw(game.origin, "/api/action", { headers, chunks: [Buffer.alloc(MAX_BODY_BYTES + 1, 32)] })).status, 413);
  assert.equal((await raw(game.origin, "/api/action", { headers: { ...headers, "Content-Length": String(MAX_BODY_BYTES + 1) } })).status, 413);
  assert.equal((await raw(game.origin, "/api/action", { headers, chunks: [Buffer.from("{")] })).status, 400);
  assert.equal((await raw(game.origin, "/api/action", { headers, chunks: [Buffer.from([0xff])] })).status, 400);
  // This valid JSON fits the byte budget but must not reach recursive fingerprinting.
  const nested = '{"requestId":"' + randomUUID() + '","revision":"0","action":{"kind":"roll","wagers":{"red":' + "[".repeat(7000) + '"1"' + "]".repeat(7000) + "}}}";
  assert.ok(Buffer.byteLength(nested) < MAX_BODY_BYTES);
  assert.equal((await raw(game.origin, "/api/action", { headers, chunks: [Buffer.from(nested)] })).status, 400);
  assert.equal((await raw(game.origin, "/api/state", { method: "GET", headers: { ...headers, "Content-Length": "3" }, chunks: [Buffer.from("bad")] })).status, 400);
  let abortedRequest!: IncomingMessage;
  const partialBody = new Promise<void>(resolve => game.server.once("request", req => {
    abortedRequest = req;
    req.once("data", () => resolve());
  }));
  const interrupted = httpRequest(game.origin + "/api/action", { method: "POST", headers: { ...headers, "Content-Length": "100" } });
  interrupted.on("error", () => {}); // The client intentionally disconnects.
  interrupted.write("{\"requestId\":");
  await partialBody;
  const aborted = new Promise<void>(resolve => abortedRequest.once("close", () => resolve()));
  interrupted.destroy();
  await aborted;
  assert.equal((await fetch(game.origin + "/healthz")).status, 200);
  assert.equal(game.store.get(game.state.id).revision, "0");
  assert.equal(game.store.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 0);
  // UTF-8 code points may straddle arbitrary network chunks.
  const unicode = Buffer.from(JSON.stringify(action("0", { kind: "nickname", nickname: "한국어" })));
  assert.equal((await raw(game.origin, "/api/action", { headers, chunks: Array.from(unicode, value => Buffer.from([value])) })).status, 200);
  assert.equal(game.store.get(game.state.id).nickname, "한국어");
});

test("origins, cookies and forwarding use explicit trust and cross-site reads cannot create players", async t => {
  const game = await http(t, { publicOrigin: "https://sixfold.example", production: true });
  assert.match(game.first.headers.get("set-cookie")!, /HttpOnly; SameSite=Lax; Path=\/; Max-Age=31536000; Secure/);
  assert.equal(game.first.headers.get("cache-control"), "no-store");
  for (const origin of ["", "null", "garbage", "http://sixfold.example", "https://other.example", "https://sixfold.example/evil"]) assert.equal((await game.post(action(), { Origin: origin })).status, 403);
  assert.equal((await game.post(action(), { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await fetch(game.origin + "/api/state", { headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
  assert.equal(game.store.db.prepare("SELECT count(*) AS n FROM players").get()!.n, 1);
  assert.equal((await game.post(action(), { "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http", "X-Forwarded-For": "not an IP" })).status, 200);
  assert.equal(game.first.headers.get("access-control-allow-origin"), null);
  assert.match(game.first.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
  const plain = await http(t);
  assert.doesNotMatch(plain.first.headers.get("set-cookie")!, /Secure/);
  const req = { socket: { remoteAddress: "::ffff:127.0.0.1" }, headers: { "x-forwarded-for": "203.0.113.7" } } as unknown as IncomingMessage;
  assert.equal(clientIp(req, new Set()), "127.0.0.1");
  assert.equal(clientIp(req, new Set(["127.0.0.1"])), "203.0.113.7");
  req.headers["x-forwarded-for"] = "203.0.113.7, 10.0.0.1";
  assert.throws(() => clientIp(req, new Set(["127.0.0.1"])), /one client IP/);
});

test("private revalidation is isolated by player and updates after actions and moderation", async t => {
  const game = await http(t);
  const response = await fetch(game.origin + "/api/state", { headers: { cookie: game.cookie } });
  const tag = response.headers.get("etag")!;
  assert.equal(response.headers.get("cache-control"), "private, no-cache");
  assert.equal(response.headers.get("vary"), "Cookie");
  const unchanged = await fetch(game.origin + "/api/state", { headers: { cookie: game.cookie, "If-None-Match": tag } });
  assert.equal(unchanged.status, 304); assert.equal(await unchanged.text(), "");
  const other = game.store.create();
  const separate = await fetch(game.origin + "/api/state", { headers: { cookie: `one_of_six=${other.token}`, "If-None-Match": tag } });
  assert.equal(separate.status, 200); assert.equal((await separate.json()).id, other.state.id);
  await game.post();
  const changed = await fetch(game.origin + "/api/state", { headers: { cookie: game.cookie, "If-None-Match": tag } });
  assert.equal(changed.status, 200); assert.notEqual(changed.headers.get("etag"), tag);
  game.store.db.prepare("UPDATE players SET has_completed_run=1,best_gold='100' WHERE id=?").run(game.state.id);
  const board = await fetch(game.origin + "/api/leaderboard", { headers: { cookie: game.cookie } });
  const boardTag = board.headers.get("etag")!;
  assert.equal((await board.json()).length, 1);
  assert.equal((await fetch(game.origin + "/api/leaderboard", { headers: { cookie: game.cookie, "If-None-Match": boardTag } })).status, 304);
  game.store.db.prepare("UPDATE players SET leaderboard_hidden=1 WHERE id=?").run(game.state.id);
  const hidden = await fetch(game.origin + "/api/leaderboard", { headers: { cookie: game.cookie, "If-None-Match": boardTag } });
  assert.equal(hidden.status, 200); assert.deepEqual(await hidden.json(), []);
  const head = await fetch(game.origin + "/api/state", { method: "HEAD" });
  assert.equal(head.headers.get("set-cookie"), null);
  assert.equal(game.store.db.prepare("SELECT count(*) AS n FROM players").get()!.n, 2);
  // An internal failure after selecting a revalidation tag must remain no-store.
  const originalGet = game.store.get;
  const originalLog = console.error;
  game.store.get = () => { throw new Error("private fixture data"); };
  console.error = () => {};
  try {
    const failed = await fetch(game.origin + "/api/state", { headers: { cookie: game.cookie } });
    assert.equal(failed.status, 500);
    assert.equal(failed.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await failed.text(), /private fixture/);
  } finally { game.store.get = originalGet; console.error = originalLog; }
});

test("player-bound pending actions cannot settle if another tab replaces the cookie", async t => {
  const game = await http(t);
  const other = game.store.create();
  const request = { ...action(), playerId: game.state.id };
  const rejected = await game.post(request, { cookie: `one_of_six=${other.token}` });
  assert.equal(rejected.status, 409);
  assert.match((await rejected.json()).error, /session changed/);
  assert.equal(game.store.get(other.state.id).revision, "0");
  assert.equal(game.store.get(game.state.id).revision, "0");
  const committed = await (await game.post(request)).json();
  // Binding is checked outside the fingerprint: an existing legacy receipt
  // remains recoverable when the new client adds the correct player binding.
  const { playerId: _, ...legacy } = request;
  assert.deepEqual(await (await game.post(legacy)).json(), committed);
});

test("compact action transport omits only the duplicate settlement, preserving receipts and legacy clients", async t => {
  const game = await http(t);
  const request = { ...action(), playerId: game.state.id };
  const compactResponse = await game.post(request, { "X-Sixfold-Response": "compact-v1" });
  assert.equal(compactResponse.headers.get("cache-control"), "no-store");
  const compactText = await compactResponse.text();
  const compact = JSON.parse(compactText);
  assert.equal(compact.result, "lastRoll");
  const completeText = await (await game.post(request)).text();
  const complete = JSON.parse(completeText);
  assert.deepEqual({ state: compact.state, result: compact.state.lastRoll }, complete);
  assert.deepEqual(game.store.act(game.state.id, request), complete);
  assert.ok(compactText.length < completeText.length);
  assert.equal(game.store.get(game.state.id).revision, "1");
});

test("bounded rate limits refill, protect creation, isolate shared-network players and keep rejected retries safe", async t => {
  let now = 0;
  const limiter = new RateLimiter(100, () => now);
  const game = await http(t, { limiter, limits: { ...wideLimits, sessions: { capacity: 1, perSecond: 1 }, actions: { capacity: 1, perSecond: 1 }, reads: { capacity: 2, perSecond: 1 } } });
  const blocked = await fetch(game.origin + "/api/state");
  assert.equal(blocked.status, 429); assert.equal(blocked.headers.get("retry-after"), "1"); assert.equal((await blocked.json()).retryAfter, 1);
  assert.equal(game.store.db.prepare("SELECT count(*) AS n FROM players").get()!.n, 1);
  const request = action();
  const accepted = await (await game.post(request)).json();
  assert.equal((await game.post(request)).status, 429);
  const second = game.store.create();
  assert.equal((await game.post(action(), { cookie: `one_of_six=${second.token}` })).status, 200);
  now += 1000;
  assert.deepEqual(await (await game.post(request)).json(), accepted);
  assert.equal(game.store.get(game.state.id).rollsUsed, 1);
  assert.equal((await fetch(game.origin + "/api/state", { headers: { cookie: game.cookie } })).status, 200);
  assert.equal((await fetch(game.origin + "/api/leaderboard", { headers: { cookie: game.cookie } })).status, 200);
  assert.equal((await fetch(game.origin + "/api/state", { headers: { cookie: game.cookie } })).status, 429);
  const bound = new RateLimiter(2, () => now);
  assert.equal(bound.take("a", { capacity: 1, perSecond: 1 }), null);
  assert.equal(bound.take("b", { capacity: 1, perSecond: 1 }), null);
  assert.equal(bound.take("c", { capacity: 1, perSecond: 1 })!.full, true);
  assert.equal(bound.size, 2);
  now += 30 * 60 * 1000;
  assert.equal(bound.take("c", { capacity: 1, perSecond: 1 }), null);
  assert.equal(bound.size, 1);
});

test("receipt failure rolls back settlement; validation, stale actions and SQL-like names cannot modify authority", async t => {
  const game = await http(t);
  game.store.db.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'fixture receipt failure'); END");
  const messages: unknown[][] = [];
  const original = console.error;
  console.error = (...args) => messages.push(args);
  const request = action();
  try { const failed = await game.post(request); assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /fixture|SQLITE|session_hash/); }
  finally { console.error = original; }
  assert.deepEqual(messages, [["Sixfold request failed internally."]]);
  assert.equal(game.store.get(game.state.id).revision, "0");
  assert.equal(game.store.get(game.state.id).rollsUsed, 0);
  assert.equal(game.store.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 0);
  game.store.db.exec("DROP TRIGGER fail_receipt");
  const result = await (await game.post(request)).json();
  assert.deepEqual(await (await game.post(request)).json(), result);
  assert.equal((await game.post(action())).status, 409);
  const rename = await game.post(action("1", { kind: "nickname", nickname: "';DELETE FROM players;--" }));
  assert.equal(rename.status, 200);
  assert.equal(game.store.db.prepare("SELECT count(*) AS n FROM players").get()!.n, 1);
});

test("static serving allows only build files, revalidates HTML, caches hashes and serves precompression safely", async t => {
  const dir = temporary(t);
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><p>Sixfold</p>");
  writeFileSync(join(dir, "secret.sqlite"), "PRIVATE DATABASE");
  writeFileSync(join(dir, ".env"), "PRIVATE SECRET");
  const asset = join(dir, "assets/index-12345678.js");
  const code = Buffer.from("console.log('Sixfold');".repeat(200));
  writeFileSync(asset, code); writeFileSync(asset + ".gz", gzipSync(code)); writeFileSync(asset + ".br", brotliCompressSync(code));
  writeFileSync(join(dir, "assets/secrets.json"), "PRIVATE ASSET");
  const fallback = await createStaticHandler(dir);
  const game = await http(t, { production: true }, undefined, fallback);
  const html = await fetch(game.origin + "/");
  assert.equal(html.headers.get("cache-control"), "no-cache");
  assert.equal((await fetch(game.origin + "/", { headers: { "If-None-Match": html.headers.get("etag")! } })).status, 304);
  for (const path of ["/.env", "/secret.sqlite", "/assets/secrets.json", "/server/store.ts", "/assets/index-12345678.js.gz", "/%2e%2e/README.md", "/assets/../../secret.sqlite", "/%2fassets/index-12345678.js", "/assets/%ZZ"]) assert.equal((await fetch(game.origin + path)).status, 404, path);
  const compressed = await raw(game.origin, "/assets/index-12345678.js", { method: "GET", headers: { "Accept-Encoding": "br;q=1,gzip;q=0.5" } });
  assert.equal(compressed.headers["content-encoding"], "br");
  assert.match(String(compressed.headers["cache-control"]), /31536000, immutable/);
  assert.equal((await raw(game.origin, "/assets/index-12345678.js", { method: "HEAD", headers: { "Accept-Encoding": "br;q=0,gzip;q=0" } })).headers["content-encoding"], undefined);
  symlinkSync(join(dir, "secret.sqlite"), join(dir, "assets/evil-12345678.js"));
  await assert.rejects(createStaticHandler(dir), /symlink/);
});

test("configuration fails before unsafe startup and resolves nested storage symlinks", async t => {
  assert.equal(readConfig(false, {}).port, 5173);
  assert.equal(readConfig(true, { PUBLIC_ORIGIN: "https://sixfold.example" }).host, "127.0.0.1");
  for (const env of [{ PORT: "0" }, { PORT: "65536" }, { PORT: "1.5" }, { PORT: "NaN" }, { DB_PATH: "dist/game.sqlite" }, { DB_PATH: "public/game.sqlite" }, { DB_PATH: ":memory:" }, { HOST: "" }, { TRUST_PROXY_IPS: "*" }, { TRUST_PROXY_IPS: "127.0.0.1,bad" }, { STATIC_COMPRESSION: "yes" }]) assert.throws(() => readConfig(false, env));
  assert.throws(() => readConfig(true, {}), /PUBLIC_ORIGIN/);
  assert.throws(() => readConfig(true, { PUBLIC_ORIGIN: "http://localhost" }), /HTTPS/);
  assert.equal(readConfig(true, { PUBLIC_ORIGIN: "http://localhost:5173", ALLOW_INSECURE_HTTP: "true" }).publicOrigin, "http://localhost:5173");
  const dir = temporary(t);
  mkdirSync(join(dir, "public")); symlinkSync(join(dir, "public"), join(dir, "link"));
  assert.equal(inside(await storageLocation(join(dir, "link/nested/game.sqlite")), await storageLocation(join(dir, "public"))), true);
});

test("local hide/show, lossless receipt batches and live WAL backup preserve sessions and replays after restore", async t => {
  const dir = temporary(t), path = join(dir, "game.sqlite"), destination = join(dir, "backup.sqlite");
  const store = new Store(path, () => .1);
  t.after(() => store.close());
  const player = store.create();
  const request = action();
  const receipt = store.act(player.state.id, request);
  store.db.prepare("UPDATE players SET has_completed_run=1,best_gold='100' WHERE id=?").run(player.state.id);
  const run = (...args: string[]) => exec(process.execPath, ["--import", "tsx", "scripts/admin.ts", ...args], { env: { ...process.env, DB_PATH: path } });
  await run("hide", player.state.id);
  assert.deepEqual(store.leaderboard(), []);
  assert.equal(store.get(player.state.id).gold, "100");
  await run("show", player.state.id);
  assert.equal(store.leaderboard()[0].id, player.state.id);
  const compact = JSON.parse((await run("compact", "1", "0")).stdout);
  assert.equal(compact.compacted, 1); assert.ok(compact.savedBytes > 0); assert.equal(compact.examined, 1);
  assert.deepEqual(store.act(player.state.id, request), receipt);
  assert.throws(() => store.act(player.state.id, { ...request, action: { kind: "nickname", nickname: "Different" } }), /different action/);
  await run("backup", destination); // Store remains open with WAL transactions.
  assert.equal(statSync(destination).mode & 0o777, 0o600);
  await assert.rejects(run("backup", destination), /EEXIST/);
  const backupBytes = readFileSync(destination);
  const restoredPath = join(dir, "restore/private/game.sqlite");
  mkdirSync(join(dir, "restore/private"), { recursive: true, mode: 0o700 });
  copyFileSync(destination, restoredPath);
  let restored = new Store(restoredPath, () => .99);
  try {
    assert.deepEqual(restored.session(player.token), store.session(player.token));
    assert.deepEqual(restored.act(player.state.id, request), receipt);
    assert.equal(restored.db.prepare("PRAGMA quick_check").get()!.quick_check, "ok");
    assert.equal(restored.db.prepare("PRAGMA synchronous").get()!.synchronous, 2);
    assert.equal(restored.db.prepare("PRAGMA journal_mode").get()!.journal_mode, "wal");
    const nextRequest = action(restored.get(player.state.id).revision);
    const nextReceipt = restored.act(player.state.id, nextRequest);
    assert.equal(nextReceipt.state.rollsUsed, 2);
    assert.equal(restored.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 2);
    restored.close();
    restored = new Store(restoredPath, () => .5);
    assert.deepEqual(restored.session(player.token), nextReceipt.state);
    assert.deepEqual(restored.act(player.state.id, request), receipt);
    assert.deepEqual(restored.act(player.state.id, nextRequest), nextReceipt);
    assert.equal(restored.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 2);
    assert.equal(store.get(player.state.id).rollsUsed, 1);
    assert.deepEqual(readFileSync(destination), backupBytes);
  } finally { restored.close(); }
  await assert.rejects(run("compact", "1001"), /batch size/);
});

test("two independent SQLite processes settle a racing duplicate only once", async t => {
  const dir = temporary(t), path = join(dir, "game.sqlite");
  const store = new Store(path, () => .1);
  t.after(() => store.close());
  const player = store.create().state;
  const request = action();
  const code = `import { Store } from './server/store.ts';
    const store = new Store(process.argv[1], () => Number(process.argv[2]));
    process.send({ready:true});
    process.once('message', ({id,request}) => { const result=store.act(id,request); store.close(); process.send(result); process.disconnect(); });`;
  const children = [.1, .99].map(value => spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code, path, String(value)], { stdio: ["ignore", "ignore", "pipe", "ipc"] }));
  t.after(() => children.forEach(child => { if (child.exitCode === null) child.kill(); }));
  await Promise.all(children.map(child => once(child, "message")));
  const responses = children.map(child => once(child, "message"));
  children.forEach(child => child.send({ id: player.id, request }));
  const result = (await Promise.all(responses)).map(([message]) => message);
  assert.deepEqual(result[0], result[1]);
  assert.equal(store.get(player.id).rollsUsed, 1);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 1);
});

test("ranked index preserves full-ranking semantics across varied score lengths, ties, zeros and hidden entries", () => {
  const store = new Store(":memory:");
  try {
    const ids: string[] = [];
    for (let i = 0; i < 125; i++) {
      const player = store.create().state;
      ids.push(player.id);
      const score = i % 5 === 0 ? "0" : (10n ** BigInt(i % 35) + BigInt(i % 9)).toString();
      store.db.prepare("UPDATE players SET best_gold=?,has_completed_run=?,leaderboard_hidden=? WHERE id=?").run(score, i % 11 === 0 ? 0 : 1, i % 17 === 0 ? 1 : 0, player.id);
    }
    const ranked = store.db.prepare("SELECT id,nickname,best_gold,ROW_NUMBER() OVER (ORDER BY length(best_gold) DESC,best_gold DESC,id ASC) AS rank FROM players WHERE has_completed_run=1 AND leaderboard_hidden=0").all() as { id: string; nickname: string; best_gold: string; rank: number }[];
    for (const id of ids) {
      const own = ranked.find(row => row.id === id)?.rank;
      const expected = ranked.filter(row => row.rank <= 10 || (own !== undefined && row.rank >= own - 2 && row.rank <= own)).map(row => ({ id: row.id, nickname: row.nickname, bestGold: row.best_gold, rank: row.rank }));
      assert.deepEqual(store.leaderboard(id), expected);
    }
    const plan = store.db.prepare("EXPLAIN QUERY PLAN SELECT id,nickname,best_gold FROM players WHERE has_completed_run=1 AND leaderboard_hidden=0 ORDER BY length(best_gold) DESC,best_gold DESC,id ASC LIMIT 10").all();
    assert.ok(plan.some(row => String(row.detail).includes("ranked_gold_order")));
    assert.ok(plan.every(row => !String(row.detail).includes("TEMP B-TREE")));
  } finally { store.close(); }
});

test("pre-upgrade backup, competition migration and future-schema refusal preserve saves and receipts", async t => {
  const dir = temporary(t), path = join(dir, "game.sqlite");
  let store = new Store(path, () => .1);
  const player = store.create();
  const request = action();
  const response = store.act(player.state.id, request);
  store.db.exec("DROP INDEX ranked_gold_order; ALTER TABLE players DROP COLUMN leaderboard_hidden; PRAGMA user_version=2");
  store.close();
  const snapshot = join(dir, "before-upgrade.sqlite");
  await exec(process.execPath, ["--import", "tsx", "scripts/admin.ts", "backup", snapshot], { env: { ...process.env, DB_PATH: path } });
  const original = new DatabaseSync(snapshot, { readOnly: true });
  try {
    assert.equal(original.prepare("PRAGMA user_version").get()!.user_version, 2);
    assert.deepEqual(JSON.parse(original.prepare("SELECT response FROM receipts WHERE player_id=? AND request_id=?").get(player.state.id, request.requestId)!.response as string), response);
  } finally { original.close(); }
  store = new Store(path);
  assert.deepEqual(store.session(player.token), response.state);
  assert.deepEqual(store.act(player.state.id, request), response);
  store.db.exec("PRAGMA user_version=5");
  store.close();
  assert.throws(() => new Store(path), /newer than this build/);
  const database = new DatabaseSync(path, { readOnly: true });
  try { assert.equal(database.prepare("SELECT count(*) AS n FROM receipts").get()!.n, 1); assert.equal(database.prepare("PRAGMA user_version").get()!.user_version, 5); }
  finally { database.close(); }
});

test("production startup, health, SIGTERM and restart retain a real HTTP action in temporary storage", async t => {
  const dir = temporary(t);
  mkdirSync(join(dir, "dist/assets"), { recursive: true });
  writeFileSync(join(dir, "dist/index.html"), "<!doctype html><title>Isolated startup check</title>");
  const portProbe = (await import("node:net")).createServer();
  await new Promise<void>(resolve => portProbe.listen(0, "127.0.0.1", resolve));
  const port = (portProbe.address() as { port: number }).port;
  await new Promise<void>(resolve => portProbe.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, HOST: "127.0.0.1", PORT: String(port), DB_PATH: join(dir, "game.sqlite"), PUBLIC_ORIGIN: origin, ALLOW_INSECURE_HTTP: "true", TRUST_PROXY_IPS: undefined };
  const children: ReturnType<typeof spawn>[] = [];
  t.after(() => children.forEach(child => { if (child.exitCode === null) child.kill("SIGKILL"); }));
  const start = async () => {
    const child = spawn(process.execPath, ["--import", import.meta.resolve("tsx"), resolve("server/index.ts"), "--production"], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Startup timed out")), 5000);
      child.stdout!.on("data", data => { if (String(data).includes("Listening:")) { clearTimeout(timer); resolve(); } });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Startup exited ${code}`)); });
      child.once("error", error => { clearTimeout(timer); reject(error); });
    });
    return child;
  };
  const stop = async (child: ReturnType<typeof spawn>) => {
    const exit = once(child, "exit");
    child.kill("SIGTERM");
    const [code, signal] = await exit;
    assert.equal(code, 0); assert.equal(signal, null);
  };
  let child = await start();
  const health = await fetch(origin + "/healthz");
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("set-cookie"), null);
  const initial = await fetch(origin + "/api/state");
  const cookie = initial.headers.get("set-cookie")!.split(";")[0];
  const request = action();
  const receipt = await (await fetch(origin + "/api/action", { method: "POST", headers: { cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(request) })).json();
  await stop(child);
  child = await start();
  const restored = await (await fetch(origin + "/api/state", { headers: { cookie } })).json();
  assert.deepEqual(restored, receipt.state);
  const replay = await (await fetch(origin + "/api/action", { method: "POST", headers: { cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(request) })).json();
  assert.deepEqual(replay, receipt);
  await stop(child);
  const invalid = await exec(process.execPath, ["--import", import.meta.resolve("tsx"), resolve("server/index.ts"), "--production"], { cwd: dir, env: { ...env, PORT: "invalid" } }).then(() => null, error => error);
  assert.equal(invalid.code, 1); assert.match(invalid.stderr, /PORT must be an integer/);
});
