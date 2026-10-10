import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { listen } from "../server/listen.ts";

const host = "127.0.0.1";
function fixture(t: TestContext, body = "Sixfold") {
  const server = createServer((_req, res) => res.end(body));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return server;
}

test("startup returns the actual bound port and serves requests", async (t) => {
  const server = fixture(t);
  const port = await listen(server, { port: 0, host, strictPort: true });
  assert.ok(port > 0);
  assert.equal(await (await fetch(`http://${host}:${port}`)).text(), "Sixfold");
});

test("development startup skips occupied ports without disturbing their servers", async (t) => {
  const existing = fixture(t, "Existing server");
  const busyPort = await listen(existing, { port: 0, host, strictPort: true });
  const server = fixture(t);
  const originalListeners = server.listeners("listening");
  const retried: number[] = [];
  const port = await listen(server, {
    port: busyPort,
    host,
    strictPort: false,
    onPortInUse: (port) => retried.push(port),
  });
  assert.ok(port > busyPort);
  assert.deepEqual(retried, Array.from({ length: port - busyPort }, (_, i) => busyPort + i));
  assert.equal(await (await fetch(`http://${host}:${busyPort}`)).text(), "Existing server");
  assert.equal(await (await fetch(`http://${host}:${port}`)).text(), "Sixfold");
  assert.equal(server.listenerCount("error"), 0);
  assert.deepEqual(server.listeners("listening"), originalListeners);
});

test("strict startup rejects a busy port without trying another port", async (t) => {
  const existing = fixture(t);
  const port = await listen(existing, { port: 0, host, strictPort: true });
  const server = fixture(t);
  const originalListeners = server.listeners("listening");
  await assert.rejects(
    listen(server, { port, host, strictPort: true, onPortInUse: () => assert.fail("Must not retry") }),
    { code: "EADDRINUSE" },
  );
  assert.equal(server.listening, false);
  assert.equal(existing.listening, true);
  assert.equal(server.listenerCount("error"), 0);
  assert.deepEqual(server.listeners("listening"), originalListeners);
});

test("other startup errors are propagated without retries or leaked listeners", async (t) => {
  const server = fixture(t);
  const originalListeners = server.listeners("listening");
  await assert.rejects(
    listen(server, { port: -1, host, strictPort: false, onPortInUse: () => assert.fail("Must not retry") }),
    { code: "ERR_SOCKET_BAD_PORT" },
  );
  assert.equal(server.listening, false);
  assert.equal(server.listenerCount("error"), 0);
  assert.deepEqual(server.listeners("listening"), originalListeners);
});
