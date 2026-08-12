import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import {
  getDirectivePresentation,
  getDirectHeartPoweredEngineIds,
  getStabilizeLinePairs,
  hasDirectHeartPoweredEngine,
  isStabilizeLineConfigured,
} from '../src/application/directives.ts';
import { createInitialState, emptyShapeNumbers, normalizeGameState, SAVE_VERSION } from '../src/application/state.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';
import {
  createProductionBag,
  EngineState,
  getProductionIntervalSec,
  stableEngineSeed,
} from '../src/core/index.ts';

function makeEngine(
  id: string,
  constituentBlockIds: string[],
  foundational: boolean,
): EngineState {
  return {
    id,
    name: foundational ? 'Heart Engine' : `${id} Engine`,
    sourcePatternId: foundational ? 'heart_seal' : 'compression_press',
    sourcePatternName: foundational ? 'Heart Seal' : 'Compression Press',
    foundational,
    submittable: !foundational,
    quality: 1,
    boundValue: 16,
    accumulatedTimeSec: 0,
    constituentBlockIds,
    ...createProductionBag(stableEngineSeed(id)),
  };
}

function addBoundBlocks(
  state: ReturnType<typeof createInitialState>,
  engineId: string,
  positions: Array<{ x: number; y: number }>,
  shape: 'I' | 'O',
  rotation: number,
  foundational: boolean,
): void {
  const blockIds = positions.map((_, index) => `${engineId}-block-${index}`);
  for (const [index, position] of positions.entries()) {
    const id = blockIds[index];
    state.blocks[id] = {
      id,
      shape,
      state: 'Bound',
      grade: 1,
      position: { ...position },
      rotation,
    };
  }
  state.engines[engineId] = makeEngine(engineId, blockIds, foundational);
}

function relayState() {
  const state = createInitialState();
  state.buffers = emptyShapeNumbers(0);
  state.blocks = {};
  state.engines = {};
  state.heartEngineId = 'heart';
  state.isHeartEngineBound = true;
  state.directive = {
    currentId: 'stabilize_line',
    completedIds: [
      'bind_heart_seal',
      'bind_compression_engine',
      'submit_ordinary_engine',
      'upgrade_shape_grade_2',
      'rebuild_powered_engine',
    ],
    stabilizeLineCoreAwarded: false,
  };

  addBoundBlocks(state, 'heart', [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
  ], 'I', 1, true);
  // A touches Heart along its east edge, while all of A stays in the opening.
  addBoundBlocks(state, 'engine-a', [
    { x: -2, y: -2 }, { x: -2, y: 0 }, { x: -2, y: 2 }, { x: -2, y: 4 },
  ], 'O', 0, false);
  // B touches A at row 5, but begins below the Heart and is not direct-rooted.
  addBoundBlocks(state, 'engine-b', [
    { x: 0, y: 5 }, { x: 0, y: 7 }, { x: 2, y: 5 }, { x: 2, y: 7 },
  ], 'O', 0, false);
  return state;
}

function mockStorage(): void {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
    length: 0,
    key: () => null,
  } as Storage;
}

describe('Pass 3D Foundry Directives and Core', () => {
  it('starts at Bind Heart Seal and exposes the next authored objective', () => {
    const store = new AppStore();
    expect(store.getState().directive).toEqual({
      currentId: 'bind_heart_seal',
      completedIds: [],
      stabilizeLineCoreAwarded: false,
    });
    expect(getDirectivePresentation(store.getState())).toMatchObject({
      now: 'BIND HEART SEAL',
      next: 'BIND A COMPRESSION ENGINE',
    });
    expect(store.getState().currencies.cores).toBe(0);
  });

  it('advances automatically through Heart, Compression, Submit, and Grade 2', () => {
    const store = new AppStore();
    const state = store.getState();
    state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [
      `heart-${index}`,
      { id: `heart-${index}`, shape: 'I' as const, state: 'Loose' as const, grade: 1, position: { x, y: 0 }, rotation: 1 },
    ]));
    store.selectAllLooseBlocks();
    expect(store.bindEngine().success).toBe(true);
    expect(state.directive.currentId).toBe('bind_compression_engine');

    const compressionIds = [0, 1, 2, 3].map(index => `compression-${index}`);
    Object.assign(state.blocks, Object.fromEntries(compressionIds.map((id, index) => [id, {
      id, shape: 'O' as const, state: 'Loose' as const, grade: 1,
      position: { x: -2 + index * 2, y: 4 }, rotation: 0,
    }])));
    store.selectBlocks(compressionIds);
    expect(store.bindEngine().success).toBe(true);
    expect(state.directive.currentId).toBe('submit_ordinary_engine');

    expect(store.submitEngine('engine-1').success).toBe(true);
    expect(state.directive.currentId).toBe('upgrade_shape_grade_2');

    expect(store.upgradeShape('O').success).toBe(true);
    expect(state.shapeGrades.O).toBe(2);
    expect(state.directive.currentId).toBe('rebuild_powered_engine');
  });

  it('recognizes a direct-powered Engine A and only a relay-powered Engine B', () => {
    const state = relayState();
    expect(hasDirectHeartPoweredEngine(state)).toBe(true);
    expect(getDirectHeartPoweredEngineIds(state)).toEqual(['engine-a']);
    expect(getStabilizeLinePairs(state)).toEqual([{ engineAId: 'engine-a', engineBId: 'engine-b' }]);
    expect(isStabilizeLineConfigured(state)).toBe(true);
  });

  it('rejects direct-Heart B and unpowered B as Stabilize configurations', () => {
    const directB = relayState();
    for (const block of Object.values(directB.blocks)) {
      if (block.id.startsWith('engine-b')) block.position = { x: 4, y: 0 };
    }
    expect(isStabilizeLineConfigured(directB)).toBe(false);

    const unpoweredB = relayState();
    for (const block of Object.values(unpoweredB.blocks)) {
      if (block.id.startsWith('engine-b')) block.position = { x: 10, y: 10 };
    }
    expect(isStabilizeLineConfigured(unpoweredB)).toBe(false);
  });

  it('awards exactly one Core when relay B emits a real Block', () => {
    const state = relayState();
    const interval = getProductionIntervalSec(state.engines['engine-b']);
    state.engines['engine-b'].accumulatedTimeSec = interval;
    const store = new AppStore(state);

    store.tick(0);
    expect(store.getState().currencies.cores).toBe(1);
    expect(store.getState().directive.currentId).toBe('frontier_seal');
    expect(store.getState().directive.stabilizeLineCoreAwarded).toBe(true);

    // Disconnecting and reconnecting B cannot re-run an authored reward.
    const bBlocks = Object.values(store.getState().blocks)
      .filter(block => block.id.startsWith('engine-b'));
    const bPositions = bBlocks.map(block => ({ id: block.id, position: { ...block.position! } }));
    for (const block of bBlocks) block.position = { x: 10, y: 10 };
    store.getState().engines['engine-b'].accumulatedTimeSec = interval;
    store.tick(0);
    for (const saved of bPositions) store.getState().blocks[saved.id].position = saved.position;

    // More production after reconnection also cannot re-run the reward.
    store.getState().engines['engine-b'].accumulatedTimeSec = interval;
    store.tick(0);
    expect(store.getState().currencies.cores).toBe(1);
    expect(store.getState().directive.completedIds).toContain('stabilize_line');
  });

  it('persists Core and does not award it while migrating an advanced legacy save', () => {
    mockStorage();
    const completed = relayState();
    completed.engines['engine-b'].accumulatedTimeSec = getProductionIntervalSec(completed.engines['engine-b']);
    const rewarded = new AppStore(completed);
    rewarded.tick(0);
    expect(saveGameState(rewarded.getState())).toBe(true);
    expect(new AppStore(loadGameState()!).getState().currencies.cores).toBe(1);

    const legacy = relayState() as unknown as Record<string, unknown>;
    legacy.version = SAVE_VERSION - 1;
    delete legacy.directive;
    (legacy.learnedActions as Record<string, unknown>).submit = true;
    (legacy.shapeGrades as Record<string, unknown>).O = 2;
    const legacyCurrencies = legacy.currencies as Record<string, unknown>;
    delete legacyCurrencies.cores;
    const migrated = normalizeGameState(legacy as never);
    expect(migrated.directive.currentId).toBe('stabilize_line');
    expect(migrated.directive.completedIds).toEqual([
      'bind_heart_seal',
      'bind_compression_engine',
      'submit_ordinary_engine',
      'upgrade_shape_grade_2',
      'rebuild_powered_engine',
    ]);
    expect(migrated.directive.stabilizeLineCoreAwarded).toBe(false);
    expect(migrated.currencies.cores).toBe(0);
  });

  it('updates NOW/NEXT after Stabilize without implementing Frontier Seal actions', () => {
    const state = relayState();
    const store = new AppStore(state);
    expect(getDirectivePresentation(store.getState())).toMatchObject({
      now: 'STABILIZE THE LINE',
      next: 'FRONTIER SEAL',
    });

    state.engines['engine-b'].accumulatedTimeSec = getProductionIntervalSec(state.engines['engine-b']);
    store.tick(0);
    expect(getDirectivePresentation(store.getState())).toMatchObject({
      now: 'BUILD A FRONTIER SEAL',
      next: 'ACTIVATE IT AT THE FRONTIER',
    });
  });
});
