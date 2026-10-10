import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { networkInterfaces } from "node:os";
import { Store } from "./store.ts";
import { createGameServer } from "./http.ts";
import { listen } from "./listen.ts";
import { CONFIG } from "../src/config.ts";
import type { IncomingMessage, ServerResponse } from "node:http";

const production = process.argv.includes("--production");
const port = Number(process.env.PORT || CONFIG.port);
const host = process.env.HOST || (production ? "127.0.0.1" : "0.0.0.0");
const store = new Store(
  process.env.DB_PATH || resolve("data/one-of-six.sqlite"),
);
let fallback: (req: IncomingMessage, res: ServerResponse) => void;
const server = createGameServer(store, (req, res) => fallback(req, res));
let vite:
  | Awaited<ReturnType<(typeof import("vite"))["createServer"]>>
  | undefined;
async function start() {
  if (production) {
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    };
    fallback = (req, res) => {
      const urlPath = new URL(req.url || "/", "http://localhost").pathname;
      const file = resolve(
        "dist",
        "." + (urlPath === "/" ? "/index.html" : urlPath),
      );
      if (!file.startsWith(resolve("dist") + "/")) {
        res.writeHead(403).end();
        return;
      }
      readFile(file)
        .then((bytes) => {
          res.writeHead(200, {
            "Content-Type": types[extname(file)] || "application/octet-stream",
          });
          res.end(bytes);
        })
        .catch(() => {
          res
            .writeHead(404)
            .end("Not found. Run npm run build before npm start.");
        });
    };
  } else {
    const { createServer } = await import("vite");
    vite = await createServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    fallback = (req, res) => vite!.middlewares(req, res);
  }
  const listeningPort = await listen(server, {
    port,
    host,
    strictPort: production || Boolean(process.env.PORT),
    onPortInUse: (busyPort) =>
      console.warn(`Port ${busyPort} is in use; trying ${busyPort + 1}...`),
  });
  console.log(`${CONFIG.title} is ready:`);
  if (host === "0.0.0.0" || host === "::") {
    console.log(`  Local:   http://localhost:${listeningPort}`);
    const addresses = new Set(
      Object.values(networkInterfaces())
        .flatMap((entries) => entries || [])
        .filter((entry) => entry.family === "IPv4" && !entry.internal)
        .map((entry) => entry.address),
    );
    for (const address of addresses)
      console.log(`  Network: http://${address}:${listeningPort}`);
  } else {
    const address = host.includes(":") ? `[${host}]` : host;
    console.log(`  http://${address}:${listeningPort}`);
  }
}
try {
  await start();
} catch (error) {
  await vite?.close();
  store.close();
  const startupError = error as NodeJS.ErrnoException & { port?: number };
  const busyPort = startupError.port ?? port;
  const suggestedPort = busyPort < 65535 ? busyPort + 1 : CONFIG.port;
  const message = startupError.code === "EADDRINUSE"
    ? `Port ${busyPort} is already in use on ${host}. Stop the existing server or choose another port, for example: PORT=${suggestedPort} npm run ${production ? "start" : "dev"}`
    : error instanceof Error ? error.message : String(error);
  console.error(`${CONFIG.title} could not start: ${message}`);
  process.exitCode = 1;
}
async function stop() {
  await vite?.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
