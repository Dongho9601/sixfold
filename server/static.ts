import { readdir, lstat, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { extname, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { inside } from "./config.ts";

const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
interface File { path: string; size: number; tag: string }
interface Asset { plain: File; br?: File; gzip?: File; type: string; immutable: boolean }
/** Inventory only build outputs; paths from requests are never opened on disk. */
export async function createStaticHandler(directory: string, compression = true) {
  const root = await realpath(directory).catch(() => { throw new Error("Built client missing. Run npm run build before npm start."); });
  const files = new Map<string, Asset>();
  const file = async (path: string): Promise<File> => {
    const stats = await lstat(path);
    if (!stats.isFile() || stats.isSymbolicLink() || !inside(await realpath(path), root)) throw new Error("Static build contains an unsafe file or symlink.");
    const digest = createHash("sha256");
    for await (const bytes of createReadStream(path)) digest.update(bytes);
    return { path, size: stats.size, tag: `"${digest.digest("base64url")}"` };
  };
  const add = async (url: string, immutable = false) => {
    const path = join(root, url);
    const plain = await file(path);
    const asset: Asset = { plain, type: types[extname(url)], immutable };
    if (compression) for (const [encoding, suffix] of [["br", ".br"], ["gzip", ".gz"]] as const) {
      try { asset[encoding] = await file(path + suffix); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    files.set(url, asset);
  };
  await add("/index.html");
  files.set("/", files.get("/index.html")!);
  for (const name of ["favicon.svg", "about.html"]) {
    try { await add(`/${name}`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const entries = await readdir(join(root, "assets"), { withFileTypes: true });
  if (entries.length > 2048) throw new Error("Static build contains too many assets.");
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error("Static build contains a symlink.");
    if (entry.isFile() && /^[\w-]+-[\w-]{8,}\.(js|css|svg|png|webp|woff2)$/.test(entry.name)) await add(`/assets/${entry.name}`, true);
  }
  return (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url || "/").split("?")[0];
    const asset = files.get(path);
    if (!asset) { res.setHeader("Cache-Control", "no-store"); res.writeHead(404).end("Not found."); return; }
    if (!["GET", "HEAD"].includes(req.method || "")) { res.setHeader("Allow", "GET, HEAD"); res.writeHead(405).end(); return; }
    const encodings = (req.headers["accept-encoding"] || "").split(",").map(value => {
      const [name, ...params] = value.trim().split(";");
      const quality = params.find(param => param.trim().startsWith("q="));
      const q = quality === undefined ? 1 : Number(quality.trim().slice(2));
      return { name: name.toLowerCase(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
    });
    const quality = (name: string) => encodings.find(item => item.name === name)?.q ?? encodings.find(item => item.name === "*")?.q ?? 0;
    const candidates = (["br", "gzip"] as const).filter(name => asset[name] && quality(name) > 0).sort((a, b) => quality(b) - quality(a));
    const encoding = candidates[0];
    const selected = encoding ? asset[encoding]! : asset.plain;
    const tag = selected.tag.slice(0, -1) + `-${encoding || "identity"}"`;
    res.setHeader("Content-Type", asset.type);
    res.setHeader("Cache-Control", asset.immutable ? "public, max-age=31536000, immutable" : "no-cache");
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("ETag", tag);
    if (encoding) res.setHeader("Content-Encoding", encoding);
    if (req.headers["if-none-match"]?.split(",").map(value => value.trim()).includes(tag)) { res.writeHead(304).end(); return; }
    res.setHeader("Content-Length", selected.size);
    res.writeHead(200);
    if (req.method === "HEAD") { res.end(); return; }
    void pipeline(createReadStream(selected.path), res).catch(() => { res.destroy(); });
  };
}
