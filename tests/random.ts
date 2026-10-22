/** Repeatable draws that can generate a fresh board as well as settle rolls. */
export const seeded = (seed = 12345) => () =>
  ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

/** A concentrated board with low outcome draws for persistence fixtures. */
export function biasedRandom() {
  let draws = 0;
  return () => ++draws % 6 === 0 ? .99 : .01;
}
