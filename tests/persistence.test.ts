import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';

function mockStorage(): void {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(), length: 0, key: () => null,
  } as Storage;
}

describe('Local persistence', () => {
  it('round-trips all Engine bag/RNG, Grade, and seven-buffer state', () => {
    mockStorage();
    const store = new AppStore();
    const state = store.getState();
    state.currencies = { ash: 450, shards: 18 };
    state.shapeGrades.T = 3;
    state.buffers.Z = 9;
    state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [`b${index}`, {
      id: `b${index}`, shape: 'I' as const, state: 'Loose' as const, grade: 1, position: { x, y: 0 }, rotation: 1,
    }]));
    store.selectAllLooseBlocks();
    expect(store.bindEngine().success).toBe(true);
    store.tick(7);
    const engineBefore = structuredClone(state.engines['engine-heart']);
    expect(saveGameState(state)).toBe(true);

    const reloaded = loadGameState()!;
    expect(reloaded.currencies).toEqual({ ash: 450, shards: 18 });
    expect(reloaded.shapeGrades.T).toBe(3);
    expect(reloaded.buffers.Z).toBe(9);
    expect(reloaded.engines['engine-heart']).toEqual(engineBefore);
  });

  it('continues with no production loss across save/reload', () => {
    mockStorage();
    const original = new AppStore();
    const state = original.getState();
    state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [`b${index}`, {
      id: `b${index}`, shape: 'I' as const, state: 'Loose' as const, grade: 1, position: { x, y: 0 }, rotation: 1,
    }]));
    original.selectAllLooseBlocks(); original.bindEngine(); original.tick(2.75);
    saveGameState(state);
    const resumed = new AppStore(loadGameState()!);
    original.tick(20); resumed.tick(20);
    expect(resumed.getState().buffers).toEqual(original.getState().buffers);
    expect(resumed.getState().engines).toEqual(original.getState().engines);
  });
});
