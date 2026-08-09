import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';

describe('Local Save & Load Persistence', () => {
  it('should round-trip save and load game state accurately', () => {
    // Mock localStorage in Node environment if needed
    const localStorageMap = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (key: string) => localStorageMap.get(key) || null,
      setItem: (key: string, value: string) => { localStorageMap.set(key, value); },
      removeItem: (key: string) => { localStorageMap.delete(key); },
      clear: () => { localStorageMap.clear(); },
      length: 0,
      key: () => null,
    } as Storage;

    const store = new AppStore();
    const state = store.getState();

    state.currencies.ash = 450;
    state.currencies.shards = 18;
    state.isHeartEngineBound = true;
    state.heartEngine = {
      id: 'engine-heart',
      name: 'Heart Engine',
      level: 3,
      xp: 45,
      quality: 1.0,
      accumulatedTimeSec: 2.5,
      constituentBlockIds: ['b1', 'b2', 'b3', 'b4'],
    };
    state.blocks = {
      b1: { id: 'b1', shape: 'I', state: 'Bound', grade: 1, position: { x: 0, y: 0 }, rotation: 1 },
      b2: { id: 'b2', shape: 'I', state: 'Bound', grade: 1, position: { x: 1, y: 0 }, rotation: 1 },
      b3: { id: 'b3', shape: 'I', state: 'Bound', grade: 1, position: { x: 2, y: 0 }, rotation: 1 },
      b4: { id: 'b4', shape: 'I', state: 'Bound', grade: 1, position: { x: 3, y: 0 }, rotation: 1 },
      l1: { id: 'l1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
    };
    state.discoveredPatterns = ['heart_seal', 'compression_press'];

    const saved = saveGameState(state);
    expect(saved).toBe(true);

    const reloaded = loadGameState();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.currencies.ash).toBe(450);
    expect(reloaded!.currencies.shards).toBe(18);
    expect(reloaded!.isHeartEngineBound).toBe(true);
    expect(reloaded!.heartEngine?.level).toBe(3);
    expect(reloaded!.blocks['b1'].state).toBe('Bound');
    expect(reloaded!.blocks['l1'].state).toBe('Loose');
    expect(reloaded!.discoveredPatterns).toContain('compression_press');
  });
});
