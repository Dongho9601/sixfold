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
    nextBlockSeq: 1,
  };
}
