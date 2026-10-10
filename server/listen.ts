import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

/** Retry busy development ports while keeping explicit/production ports strict. */
export async function listen(
  server: Server,
  options: {
    port: number;
    host: string;
    strictPort: boolean;
    onPortInUse?: (port: number) => void;
  },
): Promise<number> {
  let port = options.port;
  const maxRetries = options.strictPort ? 0 : 20;
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          server.off("error", onError);
          server.off("listening", onListening);
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onListening = () => {
          cleanup();
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        try {
          server.listen(port, options.host);
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
      return (server.address() as AddressInfo).port;
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EADDRINUSE" ||
        attempt >= maxRetries || port >= 65535
      ) throw error;
      options.onPortInUse?.(port);
      port++;
    }
  }
}
