import assert from "node:assert/strict";
import { test } from "node:test";
import { distributionHint } from "../src/distribution-hint.ts";

test("distribution hint uses fixed shades for the five example shapes", () => {
  for (const [percentages, expected] of [
    [[65, 7, 7, 7, 7, 7], [1, .16, .16, .16, .16, .16]],
    [[42, 42, 4, 4, 4, 4], [1, 1, .16, .16, .16, .16]],
    [[30, 30, 30, 4, 3, 3], [1, 1, 1, .16, .16, .16]],
    [[50, 20, 20, 4, 3, 3], [1, .49, .49, .16, .16, .16]],
    [[18, 17, 17, 16, 16, 16], [.49, .49, .49, .49, .49, .49]],
  ]) {
    const probabilities = Object.freeze(percentages.map(value => value / 100));
    assert.deepEqual(distributionHint(probabilities).opacities, expected);
    assert.deepEqual(distributionHint([...probabilities].reverse()).opacities, expected);
  }
});

test("distribution hint compares unrounded boundaries without scaling or randomness", t => {
  const originalRandom = Math.random;
  Math.random = () => { throw new Error("The hint must not draw randomness"); };
  t.after(() => { Math.random = originalRandom; });
  const probabilities = Object.freeze([.099999, .25, .050002, .1, .249999, .25]);
  assert.deepEqual(distributionHint(probabilities), {
    opacities: [1, 1, .49, .49, .16, .16],
    description: "Anonymous probability distribution, highest to lowest likelihood: 2 high, 2 moderate, 2 low.",
  });
  assert.deepEqual(probabilities, [.099999, .25, .050002, .1, .249999, .25]);
});
