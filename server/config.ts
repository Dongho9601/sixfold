import { isIP } from "node:net";
import { resolve, relative, isAbsolute } from "node:path";
import { CONFIG } from "../src/config.ts";
import { realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface ServerConfig {
  production: boolean;
  host: string;
  port: number;
  databasePath: string;
  publicOrigin?: string;
  trustedProxyIps: string[];
  staticCompression: boolean;
}
export function inside(path: string, directory: string) {
  const rel = relative(directory, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
/** Resolve existing symlinks even when a new database's parent does not exist. */
export async function storageLocation(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return join(await storageLocation(parent), basename(path));
  }
}
export function canonicalOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new Error("PUBLIC_ORIGIN must be a single http(s) origin without credentials, path, query, or fragment."); }
}
export function readConfig(production: boolean, env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawPort = env.PORT ?? String(CONFIG.port);
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
  const host = env.HOST ?? (production ? "127.0.0.1" : "0.0.0.0");
  if (!host || /[\s/\\]/.test(host)) throw new Error("HOST must be a bind address or hostname.");
  if (env.ALLOW_INSECURE_HTTP !== undefined && !["true", "false"].includes(env.ALLOW_INSECURE_HTTP)) throw new Error("ALLOW_INSECURE_HTTP must be true or false.");
  const publicOrigin = env.PUBLIC_ORIGIN === undefined ? undefined : canonicalOrigin(env.PUBLIC_ORIGIN);
  if (production && !publicOrigin) throw new Error("PUBLIC_ORIGIN is required for production (for example https://your-domain.example).");
  if (production && publicOrigin?.startsWith("http:") && env.ALLOW_INSECURE_HTTP !== "true") throw new Error("Production requires an HTTPS PUBLIC_ORIGIN. For an isolated local HTTP check only, set ALLOW_INSECURE_HTTP=true.");
  const trustedProxyIps = env.TRUST_PROXY_IPS === undefined ? [] : env.TRUST_PROXY_IPS.split(",").map(ip => ip.trim());
  if (trustedProxyIps.some(ip => !isIP(ip))) throw new Error("TRUST_PROXY_IPS must contain exact comma-separated IP addresses; wildcards and hop counts are not supported.");
  if (env.STATIC_COMPRESSION !== undefined && !["true", "false"].includes(env.STATIC_COMPRESSION)) throw new Error("STATIC_COMPRESSION must be true or false.");
  if (env.DB_PATH === "" || env.DB_PATH === ":memory:") throw new Error("DB_PATH must name a persistent SQLite file.");
  const databasePath = resolve(env.DB_PATH ?? "data/one-of-six.sqlite");
  if (["dist", "public"].some(directory => inside(databasePath, resolve(directory)))) throw new Error("DB_PATH must be outside dist/ and public/.");
  return { production, host, port: Number(rawPort), databasePath, publicOrigin, trustedProxyIps, staticCompression: env.STATIC_COMPRESSION !== "false" };
}
