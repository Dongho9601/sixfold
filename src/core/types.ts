/**
 * Core domain type definitions for HL;BM — Rune Foundry.
 * Pure deterministic types with no DOM or UI dependencies.
 */

export type ShapeType = 'I' | 'O' | 'L' | 'J';

export interface Position {
  x: number;
  y: number;
}

export type BlockState = 'Buffered' | 'Loose' | 'Bound' | 'Consumed';

export interface Block {
  id: string;
  shape: ShapeType;
  state: BlockState;
  grade: number;
  position: Position | null; // Top-left anchor or origin position on field
  rotation: number; // 0, 1, 2, 3 (0, 90, 180, 270 degrees)
}

export interface CellOccupancy {
  blockId: string;
  shape: ShapeType;
  isEngine: boolean; // true if Bound engine cell, false if Loose block cell
}

export interface HeartEngineState {
  id: string;
  name: string;
  level: number;
  xp: number;
  quality: number;
  accumulatedTimeSec: number;
  constituentBlockIds: string[];
}

export interface Currencies {
  ash: number;
  shards: number;
}

export interface BufferCounts {
  I: number;
  O: number;
  L: number;
  J: number;
}

export interface PatternMetrics {
  blockCount: number;
  cellCount: number;
  componentCount: number;
  cohesion?: number;
  separation?: number;
  isCradleFilled?: boolean;
}

export interface PatternAnalysisResult {
  patternId: string;
  patternName: string;
  isValid: boolean;
  quality: number; // 0.0 to 1.0
  metrics: PatternMetrics;
  nearMatchReason?: string;
}

export interface RecipeReward {
  ash: number;
  shards: number;
  engineXp: number;
  submissionPower: number;
  qualityTier: 'Valid' | 'Strong' | 'Masterwork' | 'Perfect';
}
