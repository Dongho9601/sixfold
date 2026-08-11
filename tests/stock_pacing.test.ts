import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { createInitialState, emptyShapeNumbers, normalizeGameState } from '../src/application/state.ts';
import {
  advanceEngineProduction,
  BASE_RATE,
  createProductionBag,
  EngineState,
  getEngineProductionView,
  getProductionIntervalSec,
  getStockUsage,
  isStockFull,
  SHAPE_TYPES,
  STOCK_CAPACITY,
  stableEngineSeed,
} from '../src/core/index.ts';

function makeEngine(id: string, overrides: Partial<EngineState> = {}): EngineState {
  return {
    id,
    name: `${id} Engine`,
    sourcePatternId: 'compression_press',
    sourcePatternName: 'Compression Press',
    foundational: false,
    submittable: true,
    quality: 1,
    boundValue: 16,
    accumulatedTimeSec: 0,
    constituentBlockIds: [],
    ...createProductionBag(stableEngineSeed(id)),
    ...overrides,
  };
}

function addBoundEngine(
  state: ReturnType<typeof createInitialState>,
  id: string,
  x: number,
  foundational = false,
): EngineState {
  const blockId = `${id}-block`;
  state.blocks[blockId] = {
    id: blockId,
    shape: 'O',
    state: 'Bound',
    grade: 1,
    position: { x, y: 0 },
    rotation: 0,
  };
  const engine = makeEngine(id, {
    foundational,
    submittable: !foundational,
    sourcePatternId: foundational ? 'heart_seal' : 'compression_press',
    sourcePatternName: foundational ? 'Heart Seal' : 'Compression Press',
    constituentBlockIds: [blockId],
  });
  state.engines[id] = engine;
  return engine;
}

function poweredChainState(engineIds: string[] = ['engine-a', 'engine-b', 'engine-c']) {
  const state = createInitialState();
  state.buffers = emptyShapeNumbers(0);
  state.blocks = {};
  state.engines = {};
  const rootId = engineIds[0];
  engineIds.forEach((id, index) => addBoundEngine(state, id, index * 2, index === 0));
  state.heartEngineId = rootId;
  state.isHeartEngineBound = true;
  return state;
}

describe('Pass 3C production pacing and Stock backpressure', () => {
  it('uses BaseRate 3.5 and gives a Grade-1 Heart 4.375 Blocks/min', () => {
    const heart = makeEngine('engine-heart', { foundational: true, submittable: false });
    const view = getEngineProductionView(heart);

    expect(BASE_RATE).toBe(3.5);
    expect(view.blocksPerMinute).toBeCloseTo(4.375);
    expect(getProductionIntervalSec(heart)).toBeCloseTo(60 / 4.375);
    expect(getProductionIntervalSec(heart)).toBeCloseTo(13.7142857, 5);
  });

  it('counts all seven Shape buffers as one Stock total', () => {
    const state = createInitialState();
    expect(getStockUsage(state.buffers)).toBe(4);

    state.buffers = Object.fromEntries(SHAPE_TYPES.map((shape, index) => [shape, index + 1])) as ReturnType<typeof emptyShapeNumbers>;
    expect(getStockUsage(state.buffers)).toBe(28);
    expect(isStockFull(state.buffers)).toBe(true);

    state.buffers = emptyShapeNumbers(0);
    state.buffers.I = 11;
    expect(getStockUsage(state.buffers)).toBe(11);
    expect(isStockFull(state.buffers)).toBe(false);
    state.buffers.O = 1;
    expect(getStockUsage(state.buffers)).toBe(STOCK_CAPACITY);
    expect(isStockFull(state.buffers)).toBe(true);
  });

  it('never produces above 12 and stops a large tick at the first full output', () => {
    const source = makeEngine('engine-test');
    const buffers = emptyShapeNumbers(0);
    buffers.I = 11;
    const interval = getProductionIntervalSec(source);
    const result = advanceEngineProduction(source, buffers, interval * 100);

    expect(result.generatedShapes).toHaveLength(1);
    expect(getStockUsage(result.buffers)).toBe(STOCK_CAPACITY);
    expect(result.engine.accumulatedTimeSec).toBe(0);
    expect(Math.max(...Object.values(result.buffers))).toBeLessThanOrEqual(STOCK_CAPACITY);
  });

  it('preserves fractional progress while full and discards blocked elapsed time', () => {
    const source = makeEngine('engine-test');
    const interval = getProductionIntervalSec(source);
    const buffers = emptyShapeNumbers(0);
    buffers.I = STOCK_CAPACITY;
    source.accumulatedTimeSec = interval * 0.37;

    const blocked = advanceEngineProduction(source, buffers, interval * 100);
    expect(blocked.generatedShapes).toEqual([]);
    expect(blocked.engine.accumulatedTimeSec).toBeCloseTo(interval * 0.37);
    expect(blocked.buffers).toEqual(buffers);

    const freed = { ...blocked.buffers, I: STOCK_CAPACITY - 1 };
    const stillPartial = advanceEngineProduction(blocked.engine, freed, 0);
    expect(stillPartial.generatedShapes).toEqual([]);
    expect(stillPartial.engine.accumulatedTimeSec).toBeCloseTo(interval * 0.37);

    const resumed = advanceEngineProduction(stillPartial.engine, freed, interval * 0.63);
    expect(resumed.generatedShapes).toHaveLength(1);
    expect(getStockUsage(resumed.buffers)).toBe(STOCK_CAPACITY);
  });

  it('processes ready Engines in stable ID order at 11/12', () => {
    const state = poweredChainState();
    state.buffers.I = 11;
    const interval = getProductionIntervalSec(state.engines['engine-a']);
    for (const engine of Object.values(state.engines)) engine.accumulatedTimeSec = interval;
    const store = new AppStore(state);

    store.tick(0);
    const production = store.drainVisualEvents().find(event => event.type === 'production');
    expect(production).toMatchObject({ type: 'production', outputs: [{ engineId: 'engine-a' }] });
    expect(state.engines['engine-a'].accumulatedTimeSec).toBe(0);
    expect(state.engines['engine-b'].accumulatedTimeSec).toBe(interval);
    expect(state.engines['engine-c'].accumulatedTimeSec).toBe(interval);
    expect(getStockUsage(state.buffers)).toBe(STOCK_CAPACITY);
  });

  it('keeps synchronized multi-Engine pacing equivalent across a full-capacity event', () => {
    const largeState = poweredChainState(['engine-a', 'engine-b']);
    largeState.buffers.I = 11;
    const smallState = structuredClone(largeState);
    const interval = getProductionIntervalSec(largeState.engines['engine-a']);
    const largeStore = new AppStore(largeState);
    const smallStore = new AppStore(smallState);

    largeStore.tick(interval * 2);
    smallStore.tick(interval);
    smallStore.tick(interval);

    expect(getStockUsage(largeState.buffers)).toBe(STOCK_CAPACITY);
    expect(smallState.buffers).toEqual(largeState.buffers);
    expect(smallState.engines['engine-a'].productionBag).toEqual(largeState.engines['engine-a'].productionBag);
    expect(smallState.engines['engine-b'].accumulatedTimeSec).toBeCloseTo(largeState.engines['engine-b'].accumulatedTimeSec);
  });

  it('produces equivalent output for one large tick and equivalent small ticks when Stock stays below cap', () => {
    const source = makeEngine('engine-test');
    const interval = getProductionIntervalSec(source);
    const large = advanceEngineProduction(source, emptyShapeNumbers(0), interval * 2.5);

    let smallEngine = structuredClone(source);
    let smallBuffers = emptyShapeNumbers(0);
    for (let index = 0; index < 5; index += 1) {
      const result = advanceEngineProduction(smallEngine, smallBuffers, interval * 0.5);
      smallEngine = result.engine;
      smallBuffers = result.buffers;
    }

    expect(smallEngine).toMatchObject({
      accumulatedTimeSec: expect.closeTo(large.engine.accumulatedTimeSec, 10),
      productionBag: large.engine.productionBag,
      nextShape: large.engine.nextShape,
      rngState: large.engine.rngState,
    });
    expect(smallBuffers).toEqual(large.buffers);
  });

  it('resumes only after placement frees Stock, with no instant replacement', () => {
    const state = poweredChainState(['engine-a']);
    state.buffers = emptyShapeNumbers(0);
    state.buffers.I = STOCK_CAPACITY;
    const interval = getProductionIntervalSec(state.engines['engine-a']);
    state.engines['engine-a'].accumulatedTimeSec = interval * 0.5;
    const store = new AppStore(state);

    const placed = store.placeBlock('I', { x: 4, y: 1 }, 1);
    expect(placed.success).toBe(true);
    expect(getStockUsage(state.buffers)).toBe(STOCK_CAPACITY - 1);
    expect(store.drainVisualEvents().some(event => event.type === 'production')).toBe(false);

    store.tick(interval * 0.5);
    expect(getStockUsage(state.buffers)).toBe(STOCK_CAPACITY);
    expect(store.drainVisualEvents().some(event => event.type === 'production')).toBe(true);
  });

  it('preserves oversized legacy Stock and blocks production without deleting inventory', () => {
    const state = poweredChainState(['engine-a']);
    state.buffers = emptyShapeNumbers(0);
    state.buffers.I = 5;
    state.buffers.O = 4;
    state.buffers.T = 3;
    state.buffers.Z = 1;
    const before = structuredClone(state.buffers);
    const migrated = normalizeGameState(state);
    const store = new AppStore(migrated);

    expect(store.getState().buffers).toEqual(before);
    const oversized = structuredClone(store.getState().buffers);
    const interval = getProductionIntervalSec(store.getState().engines['engine-a']);
    store.tick(interval * 100);
    expect(store.getState().buffers).toEqual(oversized);
    expect(store.getState().engines['engine-a'].accumulatedTimeSec).toBe(0);
  });

  it('applies Power gating before Stock production gating', () => {
    const state = createInitialState();
    state.buffers = emptyShapeNumbers(0);
    state.buffers.I = 11;
    state.blocks = {};
    state.engines = {};
    const ordinary = addBoundEngine(state, 'engine-a', 0);
    const interval = getProductionIntervalSec(ordinary);
    ordinary.accumulatedTimeSec = interval * 0.4;
    const store = new AppStore(state);

    store.tick(interval * 10);
    expect(store.getState().buffers.I).toBe(11);
    expect(store.getState().engines['engine-a'].accumulatedTimeSec).toBeCloseTo(interval * 0.4);

    addBoundEngine(store.getState(), 'engine-heart', -2, true);
    store.getState().heartEngineId = 'engine-heart';
    store.getState().isHeartEngineBound = true;
    store.tick(interval * 0.6);
    expect(getStockUsage(store.getState().buffers)).toBe(STOCK_CAPACITY);
    expect(store.getState().engines['engine-a'].accumulatedTimeSec).toBe(0);
  });

  it('does not exceed Stock when a Loose Block Returns at full capacity', () => {
    const state = createInitialState();
    state.buffers = emptyShapeNumbers(0);
    state.buffers.I = STOCK_CAPACITY;
    const store = new AppStore(state);
    const looseId = 'loose';
    state.blocks[looseId] = {
      id: looseId, shape: 'O', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 0,
    };

    const result = store.returnBlock(looseId);
    expect(result).toMatchObject({ success: true, discarded: true });
    expect(state.blocks[looseId]).toBeUndefined();
    expect(getStockUsage(state.buffers)).toBe(STOCK_CAPACITY);
  });
});
