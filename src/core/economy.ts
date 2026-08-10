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

/** Extraction reward: total bound Grades, scaled linearly by bound Quality. */
export function calculateEngineExtractionShards(blocks: Block[], quality: number): number {
  const gradeTotal = blocks.reduce((sum, block) => sum + block.grade, 0);
  return Math.max(1, Math.round(gradeTotal * (1 + quality)));
}

/** The cost shown beside Grade N is the exact cost to reach Grade N + 1. */
export function getShapeGradeUpgradeCost(currentGrade: number): number {
  return Math.max(1, Math.floor(currentGrade)) * 3;
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
    qualityTier: getQualityTier(quality),
  };
}

export function calculateBlocksPerMinute(baseRate: number, qBind: number): number {
  return baseRate * (0.75 + 0.50 * qBind);
}
