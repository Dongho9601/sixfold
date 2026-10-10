import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Store } from "./store.ts";
import { GameError } from "./rules.ts";
import type { ActionRequest } from "../src/types.ts";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<ActionRequest> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (Buffer.byteLength(raw) > 256 * 1024)
      throw new GameError("Request too large.", 413);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new GameError("Invalid JSON.");
  }
}
export function createGameServer(
  store: Store,
  fallback?: (req: IncomingMessage, res: ServerResponse) => void,
) {
  return createServer(async (req, res) => {
    try {
      const path = (req.url || "/").split("?")[0];
      if (!path.startsWith("/api/")) {
        if (fallback) fallback(req, res);
        else json(res, 404, { error: "Not found." });
        return;
      }
      const token = req.headers.cookie
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("one_of_six="))
        ?.slice(11);
      let state = store.session(token);
      if (req.method === "GET" && path === "/api/state") {
        if (!state) {
          const created = store.create();
          state = created.state;
          res.setHeader(
            "Set-Cookie",
            `one_of_six=${created.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`,
          );
        }
        json(res, 200, state);
      } else if (req.method === "GET" && path === "/api/leaderboard") {
        json(res, 200, store.leaderboard());
      } else if (req.method === "POST" && path === "/api/action") {
        if (!state)
          throw new GameError(
            "Session expired. Reload to begin a new session.",
            401,
          );
        if (!req.headers["content-type"]?.startsWith("application/json"))
          throw new GameError("JSON content type required.", 415);
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host)
          throw new GameError("Cross-origin actions are not allowed.", 403);
        const request = await body(req);
        try {
          json(res, 200, store.act(state.id, request));
        } catch (error) {
          if (error instanceof GameError)
            json(res, error.status, {
              error: error.message,
              state: store.get(state.id),
            });
          else throw error;
        }
      } else json(res, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof GameError)
        json(res, error.status, { error: error.message });
      else {
        console.error(error);
        json(res, 500, {
          error:
            "The action could not complete. Retry the same request safely.",
        });
      }
    }
  });
}
