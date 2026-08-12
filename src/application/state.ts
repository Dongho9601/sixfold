/** Persisted application state and backwards-compatible save normalization. */

import {
  Block,
  BufferCounts,
  calculateBoundValue,
  createProductionBag,
  Currencies,
  EngineState,
  ENGINE_MATERIAL_BASELINE_VALUE,
  getBlockOccupiedCells,
  getOpeningUnlockedChunkIds,
  getPreservationChunkIdForCell,
  isCellUnlocked,
  LearnedActions,
  PatternAnalysisResult,
  SHAPE_TYPES,
  ShapeGrades,
  stableEngineSeed,
} from '../core/index.ts';
import {
  advanceDirectiveProgress,
  DirectiveState,
  inferDirectiveState,
  normalizeDirectiveState,
} from './directives.ts';

// Pass 3C changes production behavior but persists no capacity field: Stock
// remains a fixed global rule, so existing buffer counts can migrate verbatim.
export const SAVE_VERSION = 7;
const DIRECTIVE_STATE_VERSION = 6;

export interface GameState {
  version: number;
  /** Persisted set of authored 4x4 chunk IDs currently unlocked for play. */
  unlockedChunks: string[];
  currencies: Currencies;
  buffers: BufferCounts;
  shapeGrades: ShapeGrades;
  blocks: Record<string, Block>;
  engines: Record<string, EngineState>;
  heartEngineId: string | null;
  isHeartEngineBound: boolean;
  directive: DirectiveState;
  selectedEngineId: string | null;
  /** Explicit, transient target selection used by the Frontier Seal preview/action. */
  selectedFrontierChunkId: string | null;
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
    unlockedChunks: getOpeningUnlockedChunkIds(),
    currencies: { shards: 0, cores: 0 },
    buffers: { ...emptyShapeNumbers(0), I: 1, O: 1, L: 1, J: 1 },
    shapeGrades: emptyShapeNumbers(1),
    blocks: {},
    engines: {},
    heartEngineId: null,
    isHeartEngineBound: false,
    directive: {
      currentId: 'bind_heart_seal',
      completedIds: [],
      stabilizeLineCoreAwarded: false,
    },
    selectedEngineId: null,
    selectedFrontierChunkId: null,
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

/**
 * Migrates legacy saves while intentionally discarding the retired Ash field.
 *
 * Saves written before the limited field existed receive the canonical
 * opening chunks. Active legacy Blocks outside that opening are preserved by
 * adding stable globally aligned 4x4 preservation chunks for their occupied
 * cells; nothing is deleted or silently relocated.
 */
export function normalizeGameState(state: GameState): GameState {
  const sourceVersion = state.version || 1;
  const legacy = state as GameState & { heartEngine?: {
    id: string; name: string; quality: number; accumulatedTimeSec: number; constituentBlockIds: string[];
  } | null; currencies?: Currencies & { ash?: number }; learnedActions?: LearnedActions & { extract?: boolean };
    directive?: unknown; directiveState?: unknown;
    unlockedChunkIds?: string[] };

  state.version = SAVE_VERSION;
  state.currencies ??= { shards: 0, cores: 0 };
  state.currencies.shards ??= 0;
  const coreValue = Number(state.currencies.cores);
  state.currencies.cores = Number.isFinite(coreValue) && coreValue >= 0 ? Math.floor(coreValue) : 0;
  delete legacy.currencies?.ash;
  state.buffers ??= emptyShapeNumbers(0);
  state.shapeGrades ??= emptyShapeNumbers(1);
  state.blocks ??= {};

  const persistedChunks = Array.isArray(state.unlockedChunks)
    ? state.unlockedChunks
    : Array.isArray(legacy.unlockedChunkIds) ? legacy.unlockedChunkIds : null;
  if (persistedChunks === null) {
    const openingChunks = getOpeningUnlockedChunkIds();
    const migratedChunks = new Set(openingChunks);
    for (const block of Object.values(state.blocks)) {
      if (!block.position || (block.state !== 'Loose' && block.state !== 'Bound')) continue;
      for (const cell of getBlockOccupiedCells(block.shape, block.position, block.rotation)) {
        if (!isCellUnlocked(cell.x, cell.y, migratedChunks)) {
          migratedChunks.add(getPreservationChunkIdForCell(cell.x, cell.y));
        }
      }
    }
    const preservationChunks = [...migratedChunks]
      .filter(chunkId => !openingChunks.includes(chunkId))
      .sort((left, right) => left.localeCompare(right));
    state.unlockedChunks = [...openingChunks, ...preservationChunks];
  } else {
    state.unlockedChunks = [...new Set(persistedChunks)];
    if (state.unlockedChunks.length === 0) state.unlockedChunks = getOpeningUnlockedChunkIds();
  }
  delete legacy.unlockedChunkIds;

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
    delete (legacyEngine as EngineState & { powered?: boolean }).powered;
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
    submit: (sourceVersion >= 3 ? oldLearned?.submit : oldLearned?.extract) ?? state.currencies.shards > 0,
    upgrade: oldLearned?.upgrade ?? Object.values(state.shapeGrades).some(grade => grade > 1),
  };

  // Directive data did not exist before this pass. Ignore a stale field on a
  // hand-carried/fixture object with an older version and infer from the
  // authoritative legacy state instead.
  const rawDirective = sourceVersion >= DIRECTIVE_STATE_VERSION
    ? legacy.directive ?? legacy.directiveState
    : undefined;
  if (rawDirective !== undefined) {
    state.directive = normalizeDirectiveState(rawDirective);
    delete legacy.directiveState;
    // Existing authored state may have been saved just before a consequential
    // action flushed. Catch up on reliable early conditions, but never treat a
    // load as Stabilize's real production output.
    advanceDirectiveProgress(state, { legacyMigration: sourceVersion < SAVE_VERSION });
  } else {
    inferDirectiveState(state);
  }
  state.fieldAnalysis ??= null;
  state.fieldCandidateBlockIds ??= [];
  state.recentFieldBlockId ??= null;
  state.selectedBlockIds ??= [];
  state.selectedFrontierChunkId = typeof state.selectedFrontierChunkId === 'string'
    ? state.selectedFrontierChunkId
    : null;
  state.discoveredPatterns ??= [];
  state.nextBlockSeq ??= 1;
  state.nextEngineSeq ??= Math.max(1, Object.keys(state.engines).filter(id => id !== 'engine-heart').length + 1);
  delete legacy.heartEngine;
  return state;
}
