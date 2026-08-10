import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { getBlockValue } from '../src/core/economy.ts';

function bindHeart(store: AppStore): void {
  const state = store.getState();
  state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [
    `heart-${index}`,
    { id: `heart-${index}`, shape: 'I' as const, state: 'Loose' as const, grade: 1, position: { x, y: 0 }, rotation: 1 },
  ]));
  store.selectAllLooseBlocks();
  expect(store.bindEngine().success).toBe(true);
}

function addCompression(store: AppStore, prefix: string = 'loose', y: number = 10): string[] {
  const ids = [0, 1, 2, 3].map(index => `${prefix}-${index}`);
  Object.assign(store.getState().blocks, Object.fromEntries(ids.map((id, index) => [
    id,
    { id, shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 10 + index * 2, y }, rotation: 0 },
  ])));
  store.selectBlocks(ids);
  return ids;
}

describe('Bind, Submit, Extract, and Grade transactions', () => {
  it('builds the opening Heart Seal from the canonical I/O/L/J inventory', () => {
    const store = new AppStore();
    expect(store.placeBlock('I', { x: 0, y: 0 }, 0).success).toBe(true);
    expect(store.placeBlock('O', { x: 1, y: 1 }, 0).success).toBe(true);
    expect(store.placeBlock('L', { x: 0, y: 1 }, 0).success).toBe(true);
    expect(store.placeBlock('J', { x: 2, y: 1 }, 0).success).toBe(true);
    expect(store.getPatternActionPreview().analysis?.patternId).toBe('heart_seal');
    expect(store.bindEngine().success).toBe(true);
  });

  it('Binds the unique Heart Engine without consuming cells', () => {
    const store = new AppStore();
    bindHeart(store);
    const state = store.getState();
    expect(state.heartEngineId).toBe('engine-heart');
    expect(state.engines['engine-heart'].extractable).toBe(false);
    expect(state.engines['engine-heart'].constituentBlockIds).toHaveLength(4);
    expect(Object.values(state.blocks).every(block => block.state === 'Bound')).toBe(true);
  });

  it('allows the same ordinary Recipe to Bind or Submit', () => {
    const bindStore = new AppStore();
    bindHeart(bindStore);
    const bindIds = addCompression(bindStore);
    const preview = bindStore.getPatternActionPreview();
    expect(preview.canBind).toBe(true);
    expect(preview.canSubmit).toBe(true);
    expect(bindStore.bindEngine().success).toBe(true);
    expect(bindIds.every(id => bindStore.getState().blocks[id].state === 'Bound')).toBe(true);
    expect(Object.keys(bindStore.getState().engines)).toHaveLength(2);

    const submitStore = new AppStore();
    bindHeart(submitStore);
    const submitIds = addCompression(submitStore);
    const result = submitStore.submitRecipe();
    expect(result.success).toBe(true);
    expect(result.reward!.ash).toBeGreaterThan(0);
    expect(submitIds.every(id => !submitStore.getState().blocks[id])).toBe(true);
    expect(submitStore.getState().currencies.shards).toBe(0);
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

  it('rejects Heart extraction and extracts an ordinary Engine exactly once', () => {
    const store = new AppStore();
    bindHeart(store);
    expect(store.extractEngine('engine-heart').success).toBe(false);
    const ids = addCompression(store);
    expect(store.bindEngine().success).toBe(true);
    const preview = store.getEngineInspection('engine-1')!;
    const before = store.getState().currencies.shards;
    const first = store.extractEngine('engine-1');
    expect(first).toEqual({ success: true, shards: preview.shards });
    expect(store.getState().currencies.shards).toBe(before + preview.shards);
    expect(ids.every(id => !store.getState().blocks[id])).toBe(true);
    expect(store.extractEngine('engine-1').success).toBe(false);
    expect(store.getState().currencies.shards).toBe(before + preview.shards);
  });

  it('spends Shards on Grade and upgrades existing/future Loose values', () => {
    const store = new AppStore();
    const state = store.getState();
    state.currencies.shards = 3;
    state.blocks.loose = { id: 'loose', shape: 'I', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 };
    const result = store.upgradeShape('I');
    expect(result).toMatchObject({ success: true, cost: 3, grade: 2 });
    expect(state.currencies.shards).toBe(0);
    expect(state.blocks.loose.grade).toBe(2);
    expect(getBlockValue(state.blocks.loose.grade)).toBe(8);
    state.buffers.I = 1;
    const placed = store.placeBlock('I', { x: 20, y: 20 });
    expect(state.blocks[placed.blockId!].grade).toBe(2);
  });

  it('never selects, Returns, or Submits Bound constituents', () => {
    const store = new AppStore();
    bindHeart(store);
    store.selectBlock('heart-0');
    expect(store.getState().selectedBlockIds).toEqual([]);
    expect(store.returnBlock('heart-0').success).toBe(false);
    expect(store.submitRecipe().success).toBe(false);
  });
});
