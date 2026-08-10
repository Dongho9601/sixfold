/**
 * Economy formulas and reward calculations for HL;BM — Rune Foundry.
 * Centralized pure functions derived directly from spec.md.
 */

import { Block } from './types.ts';

/** Four Grade-1 Blocks: the minimum material investment for an ordinary Engine. */
export const ENGINE_MATERIAL_BASELINE_VALUE = 4 * 4;

export function getBlockValue(grade: number = 1): number {
  return 4 * Math.pow(2, grade - 1);
}

export function calculateBoundValue(blocks: readonly Block[]): number {
  return blocks.reduce((sum, block) => sum + getBlockValue(block.grade), 0);
}

export function calculateEngineMaterialMultiplier(boundValue: number): number {
  return Math.sqrt(Math.max(0, boundValue) / ENGINE_MATERIAL_BASELINE_VALUE);
}

export function calculateEnginePower(boundValue: number, boundQuality: number): number {
  const materialMultiplier = calculateEngineMaterialMultiplier(boundValue);
  const qualityMultiplier = 0.75 + 0.50 * Math.min(1, Math.max(0, boundQuality));
  return materialMultiplier * qualityMultiplier;
}

/** Submission reward: total bound Grades, scaled linearly by bound Quality. */
export function calculateEngineSubmissionShards(blocks: readonly Block[], quality: number): number {
  const gradeTotal = blocks.reduce((sum, block) => sum + block.grade, 0);
  return Math.max(1, Math.round(gradeTotal * (1 + quality)));
}

/** The cost shown beside Grade N is the exact cost to reach Grade N + 1. */
export function getShapeGradeUpgradeCost(currentGrade: number): number {
  return Math.max(1, Math.floor(currentGrade)) * 3;
}

export function calculateBlocksPerMinute(baseRate: number, boundValue: number, boundQuality: number): number {
  return baseRate * calculateEnginePower(boundValue, boundQuality);
}
