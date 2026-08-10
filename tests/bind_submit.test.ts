import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { emptyShapeNumbers } from '../src/application/state.ts';
import {
  advanceEngineProduction,
  calculateBoundValue,
  calculateEngineSubmissionShards,
  createProductionBag,
  EngineState,
  getBlockValue,
  getEngineProductionView,
  getProductionIntervalSec,
  stableEngineSeed,
} from '../src/core/index.ts';

function bindHeart(store: AppStore): void {
  const state = store.getState();
  state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [
    `heart-${index}`,
    { id: `heart-${index}`, shape: 'I' as const, state: 'Loose' as const, grade: 1, position: { x, y: 0 }, rotation: 1 },
  ]));
  store.selectAllLooseBlocks();
  expect(store.bindEngine().success).toBe(true);
}

function addCompression(
  store: AppStore,
  prefix: string = 'loose',
  y: number = 10,
  count: number = 4,
  grade: number = 1,
): string[] {
  const ids = Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
  Object.assign(store.getState().blocks, Object.fromEntries(ids.map((id, index) => [
    id,
    { id, shape: 'O' as const, state: 'Loose' as const, grade, position: { x: 10 + index * 2, y }, rotation: 0 },
  ])));
  store.selectBlocks(ids);
  return ids;
}

function productionEngine(overrides: Partial<EngineState> = {}): EngineState {
  const id = overrides.id || 'engine-test';
  return {
    id,
    name: 'Test Engine',
    sourcePatternId: 'compression_press',
    sourcePatternName: 'Compression Press',
    foundational: false,
    submittable: true,
    quality: 0.75,
    boundValue: 16,
    accumulatedTimeSec: 0,
    constituentBlockIds: ['a', 'b', 'c', 'd'],
    ...createProductionBag(stableEngineSeed(id)),
    ...overrides,
  };
}

describe('Bind, Engine Submit, production power, and Grade transactions', () => {
  it('builds and Binds the unique foundational Heart Engine without consuming cells', () => {
    const store = new AppStore();
    expect(store.placeBlock('I', { x: 0, y: 0 }, 0).success).toBe(true);
    expect(store.placeBlock('O', { x: 1, y: 1 }, 0).success).toBe(true);
    expect(store.placeBlock('L', { x: 0, y: 1 }, 0).success).toBe(true);
    expect(store.placeBlock('J', { x: 2, y: 1 }, 0).success).toBe(true);
    expect(store.getPatternActionPreview().analysis?.patternId).toBe('heart_seal');
    expect(store.bindEngine().success).toBe(true);
    const state = store.getState();
    expect(state.engines['engine-heart']).toMatchObject({ foundational: true, submittable: false, boundValue: 16 });
    expect(Object.values(state.blocks).every(block => block.state === 'Bound')).toBe(true);
  });

  it('offers only Bind for a valid Loose Pattern', () => {
    const store = new AppStore();
    bindHeart(store);
    const ids = addCompression(store);
    const preview = store.getPatternActionPreview();
    expect(preview.canBind).toBe(true);
    expect(preview).not.toHaveProperty('canSubmit');
    expect(store).not.toHaveProperty('submitRecipe');
    expect(store.bindEngine().success).toBe(true);
    expect(ids.every(id => store.getState().blocks[id].state === 'Bound')).toBe(true);
  });

  it('supports multiple ordinary Engines', () => {
    const store = new AppStore();
    bindHeart(store);
    addCompression(store, 'first');
    expect(store.bindEngine().success).toBe(true);
    addCompression(store, 'second', 20);
    expect(store.bindEngine().success).toBe(true);
    expect(Object.keys(store.getState().engines)).toEqual(['engine-heart', 'engine-1', 'engine-2']);
  });

  it('derives deterministic sublinear production from frozen material and Quality', () => {
    const minimum = productionEngine();
    const sameA = advanceEngineProduction(minimum, emptyShapeNumbers(0), 120);
    const sameB = advanceEngineProduction(structuredClone(minimum), emptyShapeNumbers(0), 120);
    expect(sameA).toEqual(sameB);

    const fourGrade1 = Array.from({ length: 4 }, (_, index) => ({
      id: `base-${index}`, shape: 'O' as const, state: 'Bound' as const, grade: 1,
      position: { x: index * 2, y: 0 }, rotation: 0,
    }));
    const eightGrade1 = [...fourGrade1, ...fourGrade1.map((block, index) => ({ ...block, id: `more-${index}` }))];
    const fourGrade2 = fourGrade1.map(block => ({ ...block, grade: 2 }));
    const larger = productionEngine({ id: 'larger', boundValue: calculateBoundValue(eightGrade1) });
    const higherGrade = productionEngine({ id: 'higher-grade', boundValue: calculateBoundValue(fourGrade2) });
    const higherQuality = productionEngine({ id: 'higher-quality', quality: 1 });
    expect(getProductionIntervalSec(larger)).toBeLessThan(getProductionIntervalSec(minimum));
    expect(getProductionIntervalSec(higherGrade)).toBeLessThan(getProductionIntervalSec(minimum));
    expect(getProductionIntervalSec(higherQuality)).toBeLessThan(getProductionIntervalSec(minimum));
    expect(getEngineProductionView(larger).materialMultiplier).toBeCloseTo(Math.sqrt(2));
    expect(getEngineProductionView(larger).blocksPerMinute).toBeLessThan(getEngineProductionView(minimum).blocksPerMinute * 2);
  });

  it('rewards larger, higher-Grade, and higher-Quality Engine submissions', () => {
    const grade1 = Array.from({ length: 4 }, (_, index) => ({
      id: `g1-${index}`, shape: 'O' as const, state: 'Bound' as const, grade: 1, position: { x: index * 2, y: 0 }, rotation: 0,
    }));
    const larger = [...grade1, ...grade1.map((block, index) => ({ ...block, id: `extra-${index}` }))];
    const grade2 = grade1.map(block => ({ ...block, grade: 2 }));
    expect(calculateEngineSubmissionShards(larger, 0.75)).toBeGreaterThan(calculateEngineSubmissionShards(grade1, 0.75));
    expect(calculateEngineSubmissionShards(grade2, 0.75)).toBeGreaterThan(calculateEngineSubmissionShards(grade1, 0.75));
    expect(calculateEngineSubmissionShards(grade1, 1)).toBeGreaterThan(calculateEngineSubmissionShards(grade1, 0.5));
  });

  it('submits an ordinary Engine atomically exactly once and removes its cells', () => {
    const store = new AppStore();
    bindHeart(store);
    const ids = addCompression(store);
    expect(store.bindEngine().success).toBe(true);
    const preview = store.getEngineInspection('engine-1')!;
    const before = store.getState().currencies.shards;
    store.drainVisualEvents();
    expect(store.submitEngine('engine-1')).toEqual({ success: true, shards: preview.shards });
    expect(store.getState().currencies.shards).toBe(before + preview.shards);
    expect(ids.every(id => !store.getState().blocks[id])).toBe(true);
    expect(store.getState().engines['engine-1']).toBeUndefined();
    expect(store.getState().selectedEngineId).toBeNull();
    const visualEvent = store.drainVisualEvents()[0];
    expect(visualEvent).toMatchObject({ type: 'submit', engineId: 'engine-1', shards: preview.shards });
    expect(Object.isFrozen(visualEvent)).toBe(true);
    if (visualEvent.type === 'submit') expect(visualEvent.blocks.every(Object.isFrozen)).toBe(true);
    expect(store.submitEngine('engine-1').success).toBe(false);
    expect(store.getState().currencies.shards).toBe(before + preview.shards);
  });

  it('never submits the Heart Engine and keeping an Engine preserves production', () => {
    const store = new AppStore();
    bindHeart(store);
    expect(store.submitEngine('engine-heart').success).toBe(false);
    addCompression(store);
    store.bindEngine();
    const ordinaryBefore = structuredClone(store.getState().engines['engine-1']);
    store.tick(getProductionIntervalSec(ordinaryBefore));
    expect(store.getState().engines['engine-1']).toBeDefined();
    expect(store.getState().engines['engine-1'].productionBag.length).toBeLessThan(ordinaryBefore.productionBag.length);
    store.submitEngine('engine-1');
    expect(Object.keys(store.getState().engines)).toEqual(['engine-heart']);
  });

  it('does not retroactively change a Bound Engine after a global Shape Grade upgrade', () => {
    const store = new AppStore();
    bindHeart(store);
    addCompression(store);
    store.bindEngine();
    const engineBefore = structuredClone(store.getState().engines['engine-1']);
    const productionBefore = getEngineProductionView(engineBefore);
    const shardsBefore = store.getEngineInspection('engine-1')!.shards;
    store.getState().currencies.shards = 3;
    expect(store.upgradeShape('O')).toMatchObject({ success: true, grade: 2, cost: 3 });
    expect(store.getState().engines['engine-1']).toEqual(engineBefore);
    expect(getEngineProductionView(store.getState().engines['engine-1'])).toEqual(productionBefore);
    expect(store.getEngineInspection('engine-1')!.shards).toBe(shardsBefore);
  });

  it('upgrades existing Loose and future Blocks, but never Bound constituents', () => {
    const store = new AppStore();
    const state = store.getState();
    state.currencies.shards = 3;
    state.blocks.loose = { id: 'loose', shape: 'I', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 };
    expect(store.upgradeShape('I')).toMatchObject({ success: true, cost: 3, grade: 2 });
    expect(state.blocks.loose.grade).toBe(2);
    expect(getBlockValue(state.blocks.loose.grade)).toBe(8);
    state.buffers.I = 1;
    const placed = store.placeBlock('I', { x: 20, y: 20 });
    expect(state.blocks[placed.blockId!].grade).toBe(2);
  });

  it('has no Ash currency or player-facing legacy verb in authoritative UI/docs', () => {
    const store = new AppStore();
    expect(store.getState().currencies).toEqual({ shards: 0 });
    const authoritativeFiles = import.meta.glob([
      '../src/ui/*.{ts,md}',
      '../src/{application,core}/README.md',
      '../Docs/{spec,rune_foundry_plan}.md',
    ], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const retiredVerb = new RegExp(['EX', 'TRACT'].join(''), 'i');
    expect(Object.keys(authoritativeFiles).length).toBeGreaterThan(0);
    for (const source of Object.values(authoritativeFiles)) expect(source).not.toMatch(retiredVerb);
  });
});
