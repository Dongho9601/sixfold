/**
 * GameState interface and factory for HL;BM — Rune Foundry.
 */

import { Block, BufferCounts, Currencies, HeartEngineState, PatternAnalysisResult } from '../core/types.ts';

export interface GameState {
  version: number;
  currencies: Currencies;
  buffers: BufferCounts;
  blocks: Record<string, Block>;
  isHeartEngineBound: boolean;
  heartEngine: HeartEngineState | null;
  discoveredPatterns: string[];
  selectedBlockIds: string[];
  lastAnalysis: PatternAnalysisResult | null;
  /** The latest bounded local Field candidate, independent of explicit Submit selection. */
  fieldAnalysis: PatternAnalysisResult | null;
  fieldCandidateBlockIds: string[];
  recentFieldBlockId: string | null;
  nextBlockSeq: number;
}

export function createInitialState(): GameState {
  return {
    version: 1,
    currencies: {
      ash: 0,
      shards: 0,
    },
    buffers: {
      I: 1,
      O: 1,
      L: 1,
      J: 1,
    },
    blocks: {},
    isHeartEngineBound: false,
    heartEngine: null,
    discoveredPatterns: [],
    selectedBlockIds: [],
    lastAnalysis: null,
    fieldAnalysis: null,
    fieldCandidateBlockIds: [],
    recentFieldBlockId: null,
    nextBlockSeq: 1,
  };
}

/** Adds Pass 2 view-facing fields to a saved Pass 1 state without changing rules. */
export function normalizeGameState(state: GameState): GameState {
  state.fieldAnalysis ??= null;
  state.fieldCandidateBlockIds ??= [];
  state.recentFieldBlockId ??= null;
  state.selectedBlockIds ??= [];
  state.discoveredPatterns ??= [];
  return state;
}
