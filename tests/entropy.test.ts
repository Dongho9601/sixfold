import assert from "node:assert/strict";
import { test } from "node:test";
import { probabilityEntropy, tiltLevel, transfer } from "../src/game/rules.ts";

test("probability entropy measures concentration and normalizes stored weights", () => {
  const probabilities = [0.5, 0.1, 0.1, 0.1, 0.1, 0.1];
  const entropy = probabilityEntropy(probabilities);
  assert.ok(Math.abs(entropy - 1.4978661367769954) < 1e-14);
  assert.ok(Math.abs(probabilityEntropy(Array(6).fill(1 / 6)) - Math.log(6)) < 1e-14);
  assert.ok(Math.abs(probabilityEntropy([1, 0, 0, 0, 0, 0])) < 1e-14);
  assert.equal(probabilityEntropy([...probabilities].reverse()), entropy);
  assert.ok(Math.abs(probabilityEntropy(probabilities.map(p => p * 10)) - entropy) < 1e-14);
});

test("ordinary hits can move entropy in either direction without changing Tilt", () => {
  const rates = Array(6).fill({ min: 0.04, max: 0.08 });
  const concentrated = [0.5, 0.1, 0.1, 0.1, 0.1, 0.1];
  const rareHit = transfer(concentrated, 2, () => 0.1, rates);
  assert.ok(rareHit[0] > concentrated[0]);
  assert.ok(rareHit[1] < concentrated[1]);
  assert.ok(probabilityEntropy(rareHit) < probabilityEntropy(concentrated));
  assert.equal(tiltLevel(rareHit), tiltLevel(concentrated));

  const biased = [0.4, 0.2, 0.15, 0.1, 0.1, 0.05];
  const commonHit = transfer(biased, 1, () => 0.1, rates);
  assert.ok(probabilityEntropy(commonHit) > probabilityEntropy(biased));
  assert.equal(tiltLevel(commonHit), tiltLevel(biased));
});
