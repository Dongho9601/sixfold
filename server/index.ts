import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { Store } from "./store.ts";
import { createGameServer } from "./http.ts";
import { CONFIG } from "../src/config.ts";
import type { IncomingMessage, ServerResponse } from "node:http";

const production = process.argv.includes("--production");
const port = Number(process.env.PORT || CONFIG.port);
const store = new Store(
  process.env.DB_PATH || resolve("data/one-of-six.sqlite"),
);
let fallback: (req: IncomingMessage, res: ServerResponse) => void;
let vite:
  | Awaited<ReturnType<(typeof import("vite"))["createServer"]>>
  | undefined;
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
    server: { middlewareMode: true },
    appType: "spa",
  });
  fallback = (req, res) => vite!.middlewares(req, res);
}
const server = createGameServer(store, fallback);
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`${CONFIG.title} is ready: http://localhost:${port}`),
);
async function stop() {
  await vite?.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
