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
    state.currencies = { shards: 18 };
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
    expect(reloaded.currencies).toEqual({ shards: 18 });
    expect(reloaded.version).toBe(3);
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

  it('migrates a version-2 save intact while discarding retired Ash', () => {
    mockStorage();
    const original = new AppStore();
    const state = original.getState();
    state.currencies.shards = 12;
    state.shapeGrades.J = 4;
    state.buffers.Z = 7;
    state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [`heart-${index}`, {
      id: `heart-${index}`, shape: 'I' as const, state: 'Loose' as const, grade: 1, position: { x, y: 0 }, rotation: 1,
    }]));
    original.selectAllLooseBlocks();
    original.bindEngine();
    const ordinaryIds = [0, 1, 2, 3].map(index => `ordinary-${index}`);
    Object.assign(state.blocks, Object.fromEntries(ordinaryIds.map((id, index) => [id, {
      id, shape: 'O' as const, state: 'Loose' as const, grade: 1,
      position: { x: 10 + index * 2, y: 10 }, rotation: 0,
    }])));
    original.selectBlocks(ordinaryIds);
    original.bindEngine();
    original.tick(2.5);
    const heartBefore = structuredClone(state.engines['engine-heart']);
    const ordinaryBefore = structuredClone(state.engines['engine-1']);
    const legacy = structuredClone(state) as unknown as Record<string, unknown> & {
      version: number;
      currencies: { ash: number; shards: number };
      engines: Record<string, Record<string, unknown>>;
    };
    legacy.version = 2;
    legacy.currencies = { ash: 999, shards: 12 };
    for (const [engineId, engine] of Object.entries(legacy.engines)) {
      engine.extractable = engineId !== 'engine-heart';
      delete engine.submittable;
      delete engine.boundValue;
    }
    localStorage.setItem('rune_foundry_save_v1', JSON.stringify(legacy));

    const migrated = new AppStore(loadGameState()!).getState();
    expect(migrated.version).toBe(3);
    expect(migrated.currencies).toEqual({ shards: 12 });
    expect(migrated.shapeGrades.J).toBe(4);
    expect(migrated.buffers.Z).toBe(7);
    expect(migrated.engines['engine-heart']).toMatchObject({
      id: heartBefore.id,
      constituentBlockIds: heartBefore.constituentBlockIds,
      rngState: heartBefore.rngState,
      productionBag: heartBefore.productionBag,
      accumulatedTimeSec: heartBefore.accumulatedTimeSec,
      submittable: false,
      boundValue: 16,
    });
    expect(migrated.engines['engine-1']).toMatchObject({
      id: ordinaryBefore.id,
      constituentBlockIds: ordinaryBefore.constituentBlockIds,
      rngState: ordinaryBefore.rngState,
      productionBag: ordinaryBefore.productionBag,
      accumulatedTimeSec: ordinaryBefore.accumulatedTimeSec,
      submittable: true,
      boundValue: 16,
    });
  });
});
