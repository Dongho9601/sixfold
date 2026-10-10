import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { Store } from "./store.ts";
import { createGameServer } from "./http.ts";
import { createStaticHandler } from "./static.ts";
import { readConfig, inside, storageLocation } from "./config.ts";
import { realpath } from "node:fs/promises";
import { listen } from "./listen.ts";
import { CONFIG } from "../src/config.ts";
import type { IncomingMessage, ServerResponse, Server } from "node:http";

const production = process.argv.includes("--production");
let store: Store | undefined;
let server: Server | undefined;
let vite: Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  // Stop acceptance first. Transactions are synchronous and already settled before
  // response completion; a forced connection close remains safe to retry.
  const deadline = setTimeout(() => server?.closeAllConnections(), 10000);
  deadline.unref();
  const closed = new Promise<void>(resolve => {
    if (!server?.listening) resolve(); else server.close(() => resolve());
  });
  await vite?.close();
  await closed;
  clearTimeout(deadline);
  store?.close();
}
try {
  const config = readConfig(production);
  const actualDatabase = await storageLocation(config.databasePath);
  for (const directory of ["dist", "public"]) {
    const actualRoot = await realpath(directory).catch(() => resolve(directory));
    if (inside(actualDatabase, actualRoot)) throw new Error("DB_PATH must be outside the static directories, including symlinked directories.");
  }
  let fallback: (req: IncomingMessage, res: ServerResponse) => void;
  // Fail a missing/unsafe build before opening or migrating persistent data.
  if (production) fallback = await createStaticHandler(resolve("dist"), config.staticCompression);
  store = new Store(config.databasePath);
  server = createGameServer(store, (req, res) => fallback(req, res), config);
  if (!production) {
    const { createServer } = await import("vite");
    vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
    fallback = (req, res) => vite!.middlewares(req, res);
  }
  const listeningPort = await listen(server, {
    port: config.port, host: config.host,
    strictPort: production || process.env.PORT !== undefined,
    onPortInUse: busyPort => console.warn(`Port ${busyPort} is in use; trying ${busyPort + 1}...`),
  });
  console.log(`${CONFIG.title} is ready:`);
  if (production) console.log(`  Public: ${config.publicOrigin}`);
  if (config.host === "0.0.0.0" || config.host === "::") {
    console.log(`  Local: http://localhost:${listeningPort}`);
    if (!production) {
      const addresses = new Set(Object.values(networkInterfaces()).flatMap(entries => entries || []).filter(entry => entry.family === "IPv4" && !entry.internal).map(entry => entry.address));
      for (const address of addresses) console.log(`  Network: http://${address}:${listeningPort}`);
    }
  } else console.log(`  Listening: http://${config.host.includes(":") ? `[${config.host}]` : config.host}:${listeningPort}`);
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
} catch (error) {
  await stop();
  const code = (error as NodeJS.ErrnoException).code;
  const message = code === "EADDRINUSE" ? "The configured port is already in use. Stop the other server or set another PORT."
    : error instanceof Error ? error.message : "Invalid startup configuration.";
  console.error(`${CONFIG.title} could not start: ${message}`);
  process.exitCode = 1;
}
