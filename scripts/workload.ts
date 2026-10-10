/** Isolated local release workload. Never connects to a supplied/public URL. */
import { fork, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import { DatabaseSync } from "node:sqlite";
import { createGameServer } from "../server/http.ts";
import type { PlayerState } from "../src/types.ts";

const args = process.argv.slice(2);
const numeric = (flag: string, fallback: number, max: number) => {
  const i = args.indexOf(flag);
  const value = i < 0 ? fallback : Number(args[i + 1]);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${flag}`);
  return value;
};
if (args.includes("--worker")) {
  const store = new Store(args[args.indexOf("--worker") + 1]);
  // Seed ranked records only in this temporary database; seed work is excluded.
  const insert = store.db.prepare("INSERT INTO players (id,session_hash,nickname,gold,best_gold,probabilities,revision,has_completed_run) VALUES (?,?,?,?,?,?,?,1)");
  store.db.exec("BEGIN IMMEDIATE");
  for (let i = 0; i < numeric("--ranked", 5000, 100000); i++)
    insert.run(`fixture-${String(i).padStart(8, "0")}`, `fixture-hash-${i}`, `Fixture ${i}`, "100", String(100000 + i), "[0.2,0.2,0.2,0.2,0.1,0.1]", "0");
  store.db.exec("COMMIT; PRAGMA wal_checkpoint(TRUNCATE)");
  let fallback: Parameters<typeof createGameServer>[1];
  try {
    const modulePath = "../server/static.ts";
    const { createStaticHandler } = await import(modulePath);
    fallback = await createStaticHandler(resolve("dist"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ERR_MODULE_NOT_FOUND") throw error;
    // Baseline production implementation, before static.ts was introduced.
    fallback = (req, res) => {
      const path = new URL(req.url || "/", "http://localhost").pathname;
      const file = resolve("dist", "." + (path === "/" ? "/index.html" : path));
      if (!file.startsWith(resolve("dist") + "/")) { res.writeHead(403).end(); return; }
      void readFile(file).then(bytes => {
        res.writeHead(200, { "Content-Type": ({ ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml" } as Record<string, string>)[extname(file)] || "application/octet-stream" });
        res.end(bytes);
      }).catch(() => res.writeHead(404).end());
    };
  }
  // Accelerated workload limits apply only to this isolated worker, never npm start.
  const server = (createGameServer as Function)(store, fallback, {
    production: true,
    limits: { actions: { capacity: 100000, perSecond: 100000 }, reads: { capacity: 100000, perSecond: 100000 }, network: { capacity: 100000, perSecond: 100000 }, sessions: { capacity: 10000, perSecond: 10000 } },
  }) as ReturnType<typeof createGameServer>;
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  let cpu = process.cpuUsage();
  let started = performance.now();
  let peakRss = process.memoryUsage().rss;
  const sample = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 20);
  process.send?.({ origin: `http://127.0.0.1:${(server.address() as { port: number }).port}` });
  process.on("message", async message => {
    if (message === "reset") { cpu = process.cpuUsage(); started = performance.now(); peakRss = process.memoryUsage().rss; process.send?.({ reset: true }); return; }
    if (message !== "finish") return;
    clearInterval(sample);
    const usage = process.cpuUsage(cpu);
    const elapsedMs = performance.now() - started;
    const plan = store.db.prepare("EXPLAIN QUERY PLAN WITH ranked AS (SELECT id,nickname,best_gold,ROW_NUMBER() OVER (ORDER BY length(best_gold) DESC,best_gold DESC,id ASC) AS rank FROM players WHERE has_completed_run=1), own AS (SELECT rank FROM ranked WHERE id=?) SELECT * FROM ranked WHERE rank<=10 OR rank BETWEEN (SELECT rank-2 FROM own) AND (SELECT rank FROM own) ORDER BY rank").all("fixture-00000000");
    const leaderboardStarted = performance.now();
    for (let i = 0; i < 100; i++) store.leaderboard("fixture-00000000");
    const leaderboard100Ms = performance.now() - leaderboardStarted;
    const hasModeration = store.db.prepare("PRAGMA table_info(players)").all().some(row => row.name === "leaderboard_hidden");
    const optimizedPlans = hasModeration ? [
      "SELECT id,nickname,best_gold FROM players WHERE has_completed_run=1 AND leaderboard_hidden=0 ORDER BY length(best_gold) DESC,best_gold DESC,id ASC LIMIT 10",
      "SELECT count(*) FROM players WHERE has_completed_run=1 AND leaderboard_hidden=0 AND length(best_gold)>6",
      "SELECT id,nickname,best_gold FROM players WHERE has_completed_run=1 AND leaderboard_hidden=0 AND length(best_gold)=6 AND best_gold>'100000' ORDER BY best_gold ASC,id DESC LIMIT 2",
    ].map(sql => ({ sql, plan: store.db.prepare("EXPLAIN QUERY PLAN " + sql).all() })) : undefined;
    const metrics = { elapsedMs, serverCpuMs: (usage.user + usage.system) / 1000, peakRssBytes: Math.max(peakRss, process.memoryUsage().rss), leaderboard100Ms, originalLeaderboardPlan: plan, optimizedPlans, players: store.db.prepare("SELECT count(*) AS n FROM players").get()!.n, receipts: store.db.prepare("SELECT count(*) AS n FROM receipts").get()!.n };
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
    process.send?.(metrics);
    process.disconnect();
  });
} else {
  const dir = mkdtempSync(join(tmpdir(), "sixfold-workload-"));
  const path = join(dir, "game.sqlite");
  const concurrency = numeric("--concurrency", 8, 50);
  const runs = numeric("--runs", 2, 50);
  const child = fork(fileURLToPath(import.meta.url), ["--worker", path, "--ranked", String(numeric("--ranked", 5000, 100000))], { execArgv: ["--import", "tsx"], stdio: ["ignore", "ignore", "inherit", "ipc"] });
  try {
    const [{ origin }] = await once(child, "message") as [{ origin: string }];
    const latencies: number[] = [];
    let responseBytes = 0, requestBytes = 0, requests = 0;
    const statuses: Record<number, number> = {};
    const request = async (endpoint: string, cookie = "", data?: unknown) => {
      const body = data === undefined ? undefined : JSON.stringify(data);
      const start = performance.now();
      const response = await fetch(origin + endpoint, { method: body ? "POST" : "GET", headers: { cookie, Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}) }, body, signal: AbortSignal.timeout(10000) });
      const bytes = await response.arrayBuffer();
      latencies.push(performance.now() - start);
      responseBytes += bytes.byteLength; requestBytes += Buffer.byteLength(body || ""); requests++;
      statuses[response.status] = (statuses[response.status] || 0) + 1;
      assert.equal(response.status, 200);
      return { data: JSON.parse(Buffer.from(bytes).toString()), cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie };
    };
    child.send("reset"); await once(child, "message");
    let browserMetrics;
    if (args.includes("--browser")) {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const pageErrors: string[] = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        const apiCounts: Record<string, number> = {};
        const statuses: Record<number, number> = {};
        const network = await page.context().newCDPSession(page);
        const endpoints = new Map<string, string>();
        let encodedResponseBytes = 0, encodedApiResponseBytes = 0, apiRequestBodyBytes = 0;
        await network.send("Network.enable");
        network.on("Network.requestWillBeSent", event => {
          endpoints.set(event.requestId, new URL(event.request.url).pathname);
          if (event.request.url.includes("/api/")) apiRequestBodyBytes += Buffer.byteLength(event.request.postData || "");
        });
        network.on("Network.loadingFinished", event => {
          encodedResponseBytes += event.encodedDataLength;
          if (endpoints.get(event.requestId)?.startsWith("/api/")) encodedApiResponseBytes += event.encodedDataLength;
          endpoints.delete(event.requestId);
        });
        let apiBytes = 0, totalBytes = 0;
        const responses: Promise<void>[] = [];
        page.on("response", response => {
          responses.push((async () => {
            // Playwright has no body for a 304 (or redirect); count it as zero.
            const size = response.status() >= 300 && response.status() < 400 ? 0 : (await response.body()).byteLength;
            totalBytes += size;
            const endpoint = new URL(response.url()).pathname;
            if (endpoint.startsWith("/api/")) { apiCounts[endpoint] = (apiCounts[endpoint] || 0) + 1; apiBytes += size; statuses[response.status()] = (statuses[response.status()] || 0) + 1; }
          })());
        });
        await page.addInitScript(() => { localStorage.setItem("one-of-six-motion", "reduce"); localStorage.setItem("one-of-six-sound", "off"); });
        await page.goto(origin);
        await page.locator("#welcome-start").click();
        await page.locator("#bet-amount").fill("1");
        for (let i = 0; i < 10; i++) {
          for (let n = 1; n <= 6; n++) await page.locator(`[data-target="n${n}"]`).click();
          await page.locator("#roll").click();
          await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[data-target="n1"]')!.disabled);
        }
        // Same visible idle interval before/after: count real production-client requests.
        await page.waitForTimeout(30000);
        await Promise.all(responses);
        assert.deepEqual(pageErrors, []);
        browserMetrics = { tenRollsAnd30SecondsIdle: { apiCounts, statuses, apiBytes, apiRequestBodyBytes, encodedApiResponseBytes, encodedResponseBytes, totalDecodedResponseBytes: totalBytes } };
      } finally { await browser.close(); }
    } else {
      await Promise.all(Array.from({ length: concurrency }, async () => {
        let { data: state, cookie } = await request("/api/state") as { data: PlayerState; cookie: string };
        for (let run = 0; run < runs; run++) {
          for (let roll = 0; roll < 100; roll++) {
            const data = { requestId: randomUUID(), revision: state.revision, action: { kind: "roll", wagers: { red: "1", black: "1" } } };
            const response = (await request("/api/action", cookie, data)).data;
            assert.equal(response.state.rollsUsed, roll + 1);
            assert.equal(response.state.gold, "100");
            if (roll % 20 === 0) assert.deepEqual((await request("/api/action", cookie, data)).data, response);
            state = response.state;
            if (roll % 10 === 0) await request("/api/leaderboard", cookie);
          }
          if (run + 1 < runs) state = (await request("/api/action", cookie, { requestId: randomUUID(), revision: state.revision, action: { kind: "restart" } })).data.state;
        }
      }));
    }
    const metricsPromise = once(child, "message");
    child.send("finish");
    const [metrics] = await metricsPromise;
    await once(child, "exit");
    let maintenance;
    if (args.includes("--compact")) {
      const receiptBytes = () => {
        const db = new DatabaseSync(path, { readOnly: true });
        try { return db.prepare("SELECT coalesce(sum(length(response)),0) AS n FROM receipts").get()!.n as number; }
        finally { db.close(); }
      };
      const before = receiptBytes();
      const beforeFile = statSync(path).size;
      const start = performance.now();
      let cursor = 0, batches = 0;
      for (;;) {
        const result = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/admin.ts", "compact", "1000", String(cursor)], { encoding: "utf8", env: { ...process.env, DB_PATH: path } }));
        cursor = result.nextAfterRowid; batches++;
        if (!result.moreMayRemain) break;
      }
      const compactElapsedMs = performance.now() - start;
      const after = receiptBytes();
      const afterFile = statSync(path).size;
      const db = new DatabaseSync(path);
      let integrity;
      try { db.exec("PRAGMA synchronous=FULL; VACUUM"); integrity = db.prepare("PRAGMA quick_check").get()!.quick_check; }
      finally { db.close(); }
      maintenance = { batches, compactElapsedMs, receiptBytesBefore: before, receiptBytesAfter: after, databaseBytesBefore: beforeFile, databaseBytesAfterCompaction: afterFile, databaseBytesAfterOfflineVacuum: statSync(path).size, integrity };
    }
    latencies.sort((a, b) => a - b);
    const report = { runtime: process.version, concurrency, runs, rankedFixtures: numeric("--ranked", 5000, 100000), requests, statuses, requestBodyBytes: requestBytes, responseBodyBytes: responseBytes, p50Ms: latencies[Math.floor(latencies.length * .5)], p95Ms: latencies[Math.floor(latencies.length * .95)], databaseBytesAfterClose: maintenance?.databaseBytesBefore ?? statSync(path).size, ...metrics, ...browserMetrics, maintenance };
    const output = args.indexOf("--output");
    if (output >= 0) writeFileSync(args[output + 1], JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
}
