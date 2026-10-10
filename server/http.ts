import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Store } from "./store.ts";
import { GameError } from "./rules.ts";
import { canonicalOrigin } from "./config.ts";
import { DEFAULT_LIMITS, RateLimiter, type Limit } from "./limits.ts";
import type { ActionRequest } from "../src/types.ts";

export const MAX_BODY_BYTES = 16 * 1024;
export interface HttpOptions {
  publicOrigin?: string;
  trustedProxyIps?: string[];
  production?: boolean;
  limits?: Partial<Record<keyof typeof DEFAULT_LIMITS, Limit>>;
  limiter?: RateLimiter;
}
const normalizedIp = (ip: string) => ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
export function clientIp(req: IncomingMessage, trusted: Set<string>): string {
  const peer = normalizedIp(req.socket.remoteAddress || "unknown");
  if (!trusted.has(peer)) return peer;
  const forwarded = req.headers["x-forwarded-for"];
  // Trust exactly one overwriting proxy, never an arbitrary client-provided chain.
  if (typeof forwarded !== "string" || !isIP(forwarded.trim()))
    throw new GameError("The trusted proxy must supply one client IP address.", 400);
  return normalizedIp(forwarded.trim());
}
function json(res: ServerResponse, status: number, body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!res.hasHeader("Cache-Control")) res.setHeader("Cache-Control", "no-store");
  res.writeHead(status).end(JSON.stringify(body));
}
function revalidate(req: IncomingMessage, res: ServerResponse, serialized: string) {
  const tag = `"${createHash("sha256").update(serialized).digest("base64url")}"`;
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("Vary", "Cookie");
  res.setHeader("ETag", tag);
  if (req.headers["if-none-match"]?.split(",").map(value => value.trim()).includes(tag)) { res.writeHead(304).end(); return true; }
  return false;
}
function body(req: IncomingMessage): Promise<ActionRequest> {
  const length = req.headers["content-length"];
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new GameError("Request too large.", 413);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      clearTimeout(timer);
      req.off("data", data); req.off("end", end); req.off("aborted", aborted); req.off("error", aborted);
    };
    const fail = (error: GameError) => { cleanup(); req.pause(); reject(error); };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) fail(new GameError("Request too large.", 413));
      else chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      try { resolve(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))) as ActionRequest); }
      catch { reject(new GameError("Invalid JSON.", 400)); }
    };
    const aborted = () => fail(new GameError("Incomplete request.", 400));
    const timer = setTimeout(() => fail(new GameError("Request body timed out.", 408)), 10000);
    timer.unref();
    req.on("data", data); req.once("end", end); req.once("aborted", aborted); req.once("error", aborted);
  });
}
function requestOrigin(req: IncomingMessage, configured?: string) {
  if (configured) return configured;
  try { return canonicalOrigin(`http://${req.headers.host}`); }
  catch { throw new GameError("Invalid Host header.", 400); }
}
function checkOrigin(req: IncomingMessage, configured?: string, required = false) {
  const origin = req.headers.origin;
  if (req.headers["sec-fetch-site"] === "cross-site") throw new GameError("Cross-origin requests are not allowed.", 403);
  if (!origin) { if (required) throw new GameError("A same-origin Origin header is required.", 403); return; }
  let parsed: string;
  try { parsed = canonicalOrigin(origin); }
  catch { throw new GameError("Invalid Origin header.", 403); }
  if (parsed !== requestOrigin(req, configured)) throw new GameError("Cross-origin requests are not allowed.", 403);
}
export function createGameServer(store: Store, fallback?: (req: IncomingMessage, res: ServerResponse) => void, options: HttpOptions = {}) {
  const configuredOrigin = options.publicOrigin && canonicalOrigin(options.publicOrigin);
  const trusted = new Set((options.trustedProxyIps || []).map(normalizedIp));
  const limiter = options.limiter || new RateLimiter();
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const health = store.db.prepare("SELECT 1");
  let active = 0;
  const server = createServer({ maxHeaderSize: 8192, headersTimeout: 10000, requestTimeout: 15000, connectionsCheckingInterval: 1000, keepAliveTimeout: 5000 }, async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (options.production) res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (active >= 64) { req.resume(); res.setHeader("Retry-After", "1"); json(res, 503, { error: "Server busy. Retry shortly.", retryAfter: 1 }); return; }
    active++;
    let released = false;
    const release = () => { if (!released) { active--; released = true; } };
    res.once("finish", release); res.once("close", release);
    try {
      if (!req.url?.startsWith("/") || req.url.startsWith("//")) throw new GameError("Invalid request path.");
      const path = req.url.split("?")[0];
      const api = path.startsWith("/api/");
      const methods = path === "/api/action" ? ["POST"] : ["GET", "HEAD"];
      if ((api || path === "/healthz") && !["/api/state", "/api/leaderboard", "/api/action", "/healthz"].includes(path)) { req.resume(); json(res, 404, { error: "Not found." }); return; }
      if (!methods.includes(req.method || "")) { req.resume(); res.setHeader("Allow", methods.join(", ")); json(res, 405, { error: "Method not allowed." }); return; }
      if (!api && path !== "/healthz") {
        req.resume();
        if (fallback) fallback(req, res); else json(res, 404, { error: "Not found." });
        return;
      }
      if (path === "/healthz") { health.get(); json(res, 200, { status: "ok" }); return; }
      if (req.method !== "POST" && (Number(req.headers["content-length"] || 0) > 0 || req.headers["transfer-encoding"]))
        throw new GameError("Read requests must not contain a body.");
      checkOrigin(req, configuredOrigin, path === "/api/action");
      const address = clientIp(req, trusted);
      const take = (key: string, limit: Limit) => {
        const retry = limiter.take(key, limit);
        if (retry) { res.setHeader("Retry-After", retry.seconds); throw new GameError(retry.full ? "Server busy. Retry shortly." : "Too many requests. Retry after the indicated delay.", retry.full ? 503 : 429); }
      };
      take(`network:${address}`, limits.network);
      const token = req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("one_of_six="))?.slice(11);
      const identity = store.identify(token);
      if (req.method === "HEAD" && path === "/api/state") { res.setHeader("Cache-Control", "no-store"); res.writeHead(200).end(); return; }
      if (path === "/api/state") {
        if (!identity) {
          take(`sessions:${address}`, limits.sessions);
          const created = store.create();
          res.setHeader("X-Sixfold-Session-Created", "1");
          res.setHeader("Set-Cookie", `one_of_six=${created.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${configuredOrigin?.startsWith("https:") ? "; Secure" : ""}`);
          res.setHeader("Cache-Control", "no-store");
          json(res, 200, created.state);
        } else {
          take(`reads:${identity.id}`, limits.reads);
          if (revalidate(req, res, `${identity.id}:${identity.revision}`)) return;
          json(res, 200, store.get(identity.id));
        }
      } else if (path === "/api/leaderboard") {
        if (identity) take(`reads:${identity.id}`, limits.reads);
        const leaders = store.leaderboard(identity?.id);
        if (!revalidate(req, res, JSON.stringify(leaders))) json(res, 200, leaders);
      } else {
        if (!identity) throw new GameError("Session expired. Reload to begin a new session.", 401);
        take(`actions:${identity.id}`, limits.actions);
        if (!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(req.headers["content-type"] || "")) throw new GameError("JSON content type required.", 415);
        if (req.headers["content-encoding"] && req.headers["content-encoding"] !== "identity") throw new GameError("Compressed request bodies are not supported.", 415);
        const request = await body(req);
        try {
          const response = store.act(identity.id, request);
          // Keep the full durable receipt. New clients can avoid transmitting its
          // identical settlement twice; existing open clients retain their format.
          const compact = req.headers["x-sixfold-response"] === "compact-v1" && response.result && response.state.lastRoll;
          json(res, 200, compact ? { state: response.state, result: "lastRoll" } : response);
        }
        catch (error) {
          if (error instanceof GameError) json(res, error.status, { error: error.message, state: store.get(identity.id) });
          else throw error;
        }
      }
    } catch (error) {
      if (!req.complete) res.setHeader("Connection", "close");
      if (res.destroyed || res.headersSent) return;
      res.setHeader("Cache-Control", "no-store");
      if (error instanceof GameError) json(res, error.status, { error: error.message, ...(res.hasHeader("Retry-After") ? { retryAfter: Number(res.getHeader("Retry-After")) } : {}) });
      else {
        // Errors can embed SQL parameters or user input; log only a constant category.
        console.error("Sixfold request failed internally.");
        json(res, 500, { error: "The action could not complete. Retry the same request safely." });
      }
    }
  });
  server.maxConnections = 256;
  server.maxRequestsPerSocket = 1000;
  server.setTimeout(15000, socket => socket.destroy());
  return server;
}
