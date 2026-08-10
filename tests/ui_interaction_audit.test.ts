import { describe, expect, it, vi } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';
import { getEngineProductionView } from '../src/core/engine.ts';
import {
  isUnavailableShapeHotkey,
  shapeForHotkey,
  shouldCompleteLongPress,
} from '../src/ui/input.ts';

describe('Pass 1 Interactive Correctness & Persistence Audit', () => {
  it('Pass 2 shape hotkeys only activate implemented Shapes', () => {
    expect(shapeForHotkey('1')).toBe('I');
    expect(shapeForHotkey('2')).toBe('O');
    expect(shapeForHotkey('4')).toBe('L');
    expect(shapeForHotkey('5')).toBe('J');
    expect(shapeForHotkey('3')).toBeNull();
    expect(shapeForHotkey('6')).toBeNull();
    expect(shapeForHotkey('7')).toBeNull();
    expect(isUnavailableShapeHotkey('3')).toBe(true);
    expect(isUnavailableShapeHotkey('6')).toBe(true);
    expect(isUnavailableShapeHotkey('7')).toBe(true);
  });

  it('Pass 2 click placement commits a Loose Block at the ghost location', () => {
    const store = new AppStore();
    const result = store.placeBlock('I', { x: 8, y: 5 }, 1);
    expect(result.success).toBe(true);
    expect(result.blockId).toBeDefined();
    expect(store.getState().blocks[result.blockId!].position).toEqual({ x: 8, y: 5 });
    expect(store.getState().blocks[result.blockId!].state).toBe('Loose');
  });

  it('Pass 2 long-press contract completes only after 450 ms without movement', () => {
    expect(shouldCompleteLongPress(449, false)).toBe(false);
    expect(shouldCompleteLongPress(450, false)).toBe(true);
    expect(shouldCompleteLongPress(900, true)).toBe(false);

    const store = new AppStore();
    const placed = store.placeBlock('O', { x: 8, y: 8 });
    expect(placed.success).toBe(true);
    const blockId = placed.blockId!;
    expect(store.returnBlock(blockId).success).toBe(true);
    expect(store.returnBlock(blockId).success).toBe(false);
    expect(store.getState().buffers.O).toBe(1);
  });

  it('Pass 2 production UI view follows canonical Engine state and exposes blocked buffers', () => {
    const engine = {
      id: 'engine-heart',
      name: 'Heart Engine',
      level: 1,
      xp: 0,
      quality: 1,
      accumulatedTimeSec: 2.4,
      constituentBlockIds: [],
    };
    const view = getEngineProductionView(engine, { I: 0, O: 1, L: 1, J: 1 });
    expect(view.nextShape).toBe('I');
    expect(view.progress).toBeGreaterThan(0.4);
    expect(view.progress).toBeLessThan(0.6);

    const blocked = getEngineProductionView(engine, { I: 3, O: 3, L: 3, J: 3 });
    expect(blocked.nextShape).toBeNull();
    expect(blocked.isBlocked).toBe(true);
  });

  it('Pass 2 Field feedback refreshes after placement and Return', () => {
    const store = new AppStore();
    store.getState().buffers.O = 2;
    const first = store.placeBlock('O', { x: 10, y: 10 });
    const second = store.placeBlock('O', { x: 12, y: 10 });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(store.getState().fieldAnalysis?.patternId).toBe('compression_press');
    expect(store.getState().fieldAnalysis?.isValid).toBe(true);

    store.returnBlock(first.blockId!);
    expect(store.getState().fieldAnalysis?.patternId).toBe('compression_press');
    expect(store.getState().fieldAnalysis?.isValid).toBe(false);
  });

  it('Pass 2 valid Heart Seal feedback can bind the Field candidate without a selection panel', () => {
    const store = new AppStore();
    store.getState().buffers.I = 4;
    for (const x of [0, 1, 2, 3]) {
      expect(store.placeBlock('I', { x, y: 0 }, 1).success).toBe(true);
    }

    expect(store.getState().fieldAnalysis?.patternId).toBe('heart_seal');
    expect(store.getState().fieldAnalysis?.isValid).toBe(true);
    expect(store.getState().selectedBlockIds).toHaveLength(0);
    expect(store.bindEngine().success).toBe(true);
    expect(Object.values(store.getState().blocks).every(block => block.state === 'Bound')).toBe(true);
  });

  it('1. should allow switching active spawn shapes cleanly', () => {
    const store = new AppStore();

    // Initial buffer counts: I:1, O:1, L:1, J:1
    expect(store.getState().buffers['I']).toBe(1);
    expect(store.getState().buffers['O']).toBe(1);

    // Placing I from buffer
    const resI = store.placeBlock('I', { x: 0, y: 0 }, 1);
    expect(resI.success).toBe(true);
    expect(store.getState().buffers['I']).toBe(0);

    // Placing O from buffer
    const resO = store.placeBlock('O', { x: 1, y: 0 }, 0);
    expect(resO.success).toBe(true);
    expect(store.getState().buffers['O']).toBe(0);
  });

  it('2. clock ticks should not trigger unnecessary subscriber updates when no blocks are generated', () => {
    const store = new AppStore();
    const subscriber = vi.fn();
    store.subscribe(subscriber);

    // Unbound engine tick (no generation)
    store.tick(0.016);
    store.tick(0.016);
    store.tick(0.016);

    // Subscriber should not be spammed with 60 FPS update calls when state is unchanged
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('3. generated buffer state and engine progress should persist across save/load', () => {
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
    store.onSave(state => saveGameState(state));

    const state = store.getState();

    // Bind engine
    state.blocks = {
      b1: { id: 'b1', shape: 'I', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 1 },
      b2: { id: 'b2', shape: 'I', state: 'Loose', grade: 1, position: { x: 1, y: 0 }, rotation: 1 },
      b3: { id: 'b3', shape: 'I', state: 'Loose', grade: 1, position: { x: 2, y: 0 }, rotation: 1 },
      b4: { id: 'b4', shape: 'I', state: 'Loose', grade: 1, position: { x: 3, y: 0 }, rotation: 1 },
    };
    store.selectAllLooseBlocks();
    store.bindEngine();

    expect(state.isHeartEngineBound).toBe(true);
    const initialBufCount = state.buffers['I'] + state.buffers['O'] + state.buffers['L'] + state.buffers['J'];

    // Tick clock by 10 seconds (enough to generate next block in buffer)
    store.tick(10.0);

    const newBufCount = state.buffers['I'] + state.buffers['O'] + state.buffers['L'] + state.buffers['J'];
    expect(newBufCount).toBeGreaterThan(initialBufCount);

    // Reload state
    const reloaded = loadGameState();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.isHeartEngineBound).toBe(true);

    const reloadedBufCount = reloaded!.buffers['I'] + reloaded!.buffers['O'] + reloaded!.buffers['L'] + reloaded!.buffers['J'];
    expect(reloadedBufCount).toBe(newBufCount);
  });

  it('4. moveBlock and rotateBlock should immediately update pattern analysis for selected blocks', () => {
    const store = new AppStore();
    const state = store.getState();

    state.blocks = {
      b1: { id: 'b1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      b2: { id: 'b2', shape: 'O', state: 'Loose', grade: 1, position: { x: 12, y: 10 }, rotation: 0 },
    };

    store.selectAllLooseBlocks();
    expect(state.lastAnalysis?.patternId).toBe('compression_press');

    // Move b2 further away so it breaks connection into 2 components
    store.moveBlock('b2', { x: 20, y: 20 });

    // Last analysis must automatically update!
    expect(state.lastAnalysis?.patternId).toBe('twin_stars');
    expect(state.lastAnalysis?.metrics.componentCount).toBe(2);
  });

  it('5. Bind and Submit should remain usable while simulation ticks execute', () => {
    const store = new AppStore();
    const state = store.getState();

    state.isHeartEngineBound = true;
    state.heartEngine = {
      id: 'engine-heart',
      name: 'Heart Engine',
      level: 1,
      xp: 0,
      quality: 1.0,
      accumulatedTimeSec: 0,
      constituentBlockIds: [],
    };

    state.blocks = {
      l1: { id: 'l1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      l2: { id: 'l2', shape: 'O', state: 'Loose', grade: 1, position: { x: 12, y: 10 }, rotation: 0 },
    };

    store.selectAllLooseBlocks();

    // Advance clock multiple times during active selection
    store.tick(0.016);
    store.tick(0.016);
    store.tick(0.016);

    const subRes = store.submitRecipe();
    expect(subRes.success).toBe(true);
    expect(state.currencies.ash).toBeGreaterThan(0);
  });
});
