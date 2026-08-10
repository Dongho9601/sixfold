/**
 * Core domain type definitions for HL;BM — Rune Foundry.
 * Pure deterministic types with no DOM or UI dependencies.
 */

export const SHAPE_TYPES = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'] as const;
export type ShapeType = typeof SHAPE_TYPES[number];

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

export interface EngineState {
  id: string;
  name: string;
  sourcePatternId: string;
  sourcePatternName: string;
  foundational: boolean;
  extractable: boolean;
  quality: number;
  accumulatedTimeSec: number;
  constituentBlockIds: string[];
  rngState: number;
  productionBag: ShapeType[];
  nextShape: ShapeType;
}

export interface Currencies {
  ash: number;
  shards: number;
}

export type ShapeNumbers = Record<ShapeType, number>;
export type BufferCounts = ShapeNumbers;
export type ShapeGrades = ShapeNumbers;

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
  /** The bounded field candidate that produced this result, when available. */
  involvedBlockIds?: string[];
  /** Spatial cells that would complete a near-match, such as the Heart Seal Cradle. */
  missingCells?: Position[];
}

export interface RecipeReward {
  ash: number;
  submissionPower: number;
  qualityTier: 'Valid' | 'Strong' | 'Masterwork' | 'Perfect';
}

export interface LearnedActions {
  bind: boolean;
  submit: boolean;
  extract: boolean;
  upgrade: boolean;
}
