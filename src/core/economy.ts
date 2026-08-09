/**
 * Economy formulas and reward calculations for HL;BM — Rune Foundry.
 * Centralized pure functions derived directly from spec.md.
 */

import { Block, RecipeReward } from './types.ts';

export function getBlockValue(grade: number = 1): number {
  return 4 * Math.pow(2, grade - 1);
}

export function calculateSubmissionPower(blocks: Block[], quality: number): number {
  const n = blocks.length;
  if (n === 0) return 0;

  const sumValue = blocks.reduce((acc, b) => acc + getBlockValue(b.grade), 0);
  const nFactor = Math.pow(n, 0.30);
  const qFactor = 1 + 1.75 * Math.pow(quality, 2);

  return sumValue * nFactor * qFactor;
}

export function calculateAshReward(submissionPower: number): number {
  return Math.round(60 * submissionPower);
}

export function calculateShardsReward(blockCount: number, quality: number): number {
  return Math.round(blockCount * (1 + quality));
}

export function calculateEngineXpReward(submissionPower: number): number {
  return Math.round(submissionPower * 5);
}

export function getQualityTier(quality: number): 'Valid' | 'Strong' | 'Masterwork' | 'Perfect' {
  if (quality >= 0.95) return 'Perfect';
  if (quality >= 0.80) return 'Masterwork';
  if (quality >= 0.60) return 'Strong';
  return 'Valid';
}

export function calculateRecipeReward(blocks: Block[], quality: number): RecipeReward {
  const power = calculateSubmissionPower(blocks, quality);
  return {
    submissionPower: power,
    ash: calculateAshReward(power),
    shards: calculateShardsReward(blocks.length, quality),
    engineXp: calculateEngineXpReward(power),
    qualityTier: getQualityTier(quality),
  };
}

export function calculateBlocksPerMinute(baseRate: number, qBind: number, level: number): number {
  return baseRate * (0.75 + 0.50 * qBind) * Math.pow(1.28, level - 1);
}

export function getEngineXpThreshold(level: number): number {
  return Math.round(100 * Math.pow(1.5, level - 1));
}
