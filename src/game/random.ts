import type { Random } from "./rules.ts";

/** Same uniform 48-bit draw as the former server RNG, using browser Web Crypto. */
export const browserRandom: Random = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let value = 0;
  for (const byte of bytes) value = value * 256 + byte;
  return value / 2 ** 48;
};

export function runId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, "0")).join("");
}
