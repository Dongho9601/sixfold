/** Persisted application state and backwards-compatible save normalization. */

import {
  Block,
  BufferCounts,
  calculateBoundValue,
  createProductionBag,
  Currencies,
  EngineState,
  ENGINE_MATERIAL_BASELINE_VALUE,
  LearnedActions,
  PatternAnalysisResult,
  SHAPE_TYPES,
  ShapeGrades,
  stableEngineSeed,
} from '../core/index.ts';

export const SAVE_VERSION = 3;

export interface GameState {
  version: number;
  currencies: Currencies;
  buffers: BufferCounts;
  shapeGrades: ShapeGrades;
  blocks: Record<string, Block>;
  engines: Record<string, EngineState>;
  heartEngineId: string | null;
  isHeartEngineBound: boolean;
  selectedEngineId: string | null;
  learnedActions: LearnedActions;
  discoveredPatterns: string[];
  selectedBlockIds: string[];
  lastAnalysis: PatternAnalysisResult | null;
  fieldAnalysis: PatternAnalysisResult | null;
  fieldCandidateBlockIds: string[];
  recentFieldBlockId: string | null;
  nextBlockSeq: number;
  nextEngineSeq: number;
}

export function emptyShapeNumbers(value: number): BufferCounts {
  return Object.fromEntries(SHAPE_TYPES.map(shape => [shape, value])) as BufferCounts;
}

export function createInitialState(): GameState {
  return {
    version: SAVE_VERSION,
    currencies: { shards: 0 },
    buffers: { ...emptyShapeNumbers(0), I: 1, O: 1, L: 1, J: 1 },
    shapeGrades: emptyShapeNumbers(1),
    blocks: {},
    engines: {},
    heartEngineId: null,
    isHeartEngineBound: false,
    selectedEngineId: null,
    learnedActions: { bind: false, submit: false, upgrade: false },
    discoveredPatterns: [],
    selectedBlockIds: [],
    lastAnalysis: null,
    fieldAnalysis: null,
    fieldCandidateBlockIds: [],
    recentFieldBlockId: null,
    nextBlockSeq: 1,
    nextEngineSeq: 1,
  };
}

/** Migrates v1/v2 saves while intentionally discarding the retired Ash field. */
export function normalizeGameState(state: GameState): GameState {
  const sourceVersion = state.version || 1;
  const legacy = state as GameState & { heartEngine?: {
    id: string; name: string; quality: number; accumulatedTimeSec: number; constituentBlockIds: string[];
  } | null; currencies?: Currencies & { ash?: number }; learnedActions?: LearnedActions & { extract?: boolean } };

  state.version = SAVE_VERSION;
  state.currencies ??= { shards: 0 };
  state.currencies.shards ??= 0;
  delete legacy.currencies?.ash;
  state.buffers ??= emptyShapeNumbers(0);
  state.shapeGrades ??= emptyShapeNumbers(1);
  state.blocks ??= {};
  for (const shape of SHAPE_TYPES) {
    state.buffers[shape] ??= 0;
    state.shapeGrades[shape] ??= 1;
  }

  state.engines ??= {};
  if (legacy.heartEngine && Object.keys(state.engines).length === 0) {
    const old = legacy.heartEngine;
    state.engines[old.id] = {
      id: old.id,
      name: old.name || 'Heart Engine',
      sourcePatternId: 'heart_seal',
      sourcePatternName: 'Heart Seal',
      foundational: true,
      submittable: false,
      quality: old.quality ?? 1,
      boundValue: Math.max(
        ENGINE_MATERIAL_BASELINE_VALUE,
        calculateBoundValue((old.constituentBlockIds || []).map(id => state.blocks[id]).filter(Boolean)),
      ),
      accumulatedTimeSec: old.accumulatedTimeSec ?? 0,
      constituentBlockIds: [...(old.constituentBlockIds || [])],
      ...createProductionBag(stableEngineSeed(old.id)),
    };
  }

  for (const engine of Object.values(state.engines)) {
    const legacyEngine = engine as EngineState & { extractable?: boolean };
    engine.rngState ??= stableEngineSeed(engine.id);
    if (!engine.productionBag?.length || !engine.nextShape) Object.assign(engine, createProductionBag(engine.rngState));
    engine.sourcePatternId ??= engine.id === 'engine-heart' ? 'heart_seal' : 'compression_press';
    engine.sourcePatternName ??= engine.id === 'engine-heart' ? 'Heart Seal' : 'Compression Press';
    engine.foundational ??= engine.id === 'engine-heart';
    engine.submittable ??= legacyEngine.extractable ?? !engine.foundational;
    engine.boundValue ??= Math.max(
      ENGINE_MATERIAL_BASELINE_VALUE,
      calculateBoundValue(engine.constituentBlockIds
        .map(id => state.blocks[id])
        .filter((block): block is Block => Boolean(block))),
    );
    delete legacyEngine.extractable;
  }

  state.heartEngineId ??= state.engines['engine-heart'] ? 'engine-heart' : null;
  state.isHeartEngineBound = Boolean(state.heartEngineId && state.engines[state.heartEngineId]);
  state.selectedEngineId ??= null;
  const oldLearned = legacy.learnedActions;
  state.learnedActions = {
    bind: oldLearned?.bind ?? state.isHeartEngineBound,
    submit: (sourceVersion >= SAVE_VERSION ? oldLearned?.submit : oldLearned?.extract) ?? state.currencies.shards > 0,
    upgrade: oldLearned?.upgrade ?? Object.values(state.shapeGrades).some(grade => grade > 1),
  };
  state.fieldAnalysis ??= null;
  state.fieldCandidateBlockIds ??= [];
  state.recentFieldBlockId ??= null;
  state.selectedBlockIds ??= [];
  state.discoveredPatterns ??= [];
  state.nextBlockSeq ??= 1;
  state.nextEngineSeq ??= Math.max(1, Object.keys(state.engines).filter(id => id !== 'engine-heart').length + 1);
  delete legacy.heartEngine;
  return state;
}
