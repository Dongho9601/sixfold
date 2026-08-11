import { describe, expect, it, vi } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import {
  advanceEngineProduction,
  createProductionBag,
  EngineState,
  findNearestValidPlacement,
  getBlockOccupiedCells,
  getEngineProductionView,
  getProductionIntervalSec,
  SHAPE_TYPES,
  stableEngineSeed,
} from '../src/core/index.ts';
import { createInitialState, emptyShapeNumbers } from '../src/application/state.ts';
import {
  decidePointerIntent,
  decideLooseBlockRelease,
  gameplayCommandForCode,
  gameplayHotkeysEnabled,
  shapeForHotkey,
  shouldCompleteLongPress,
} from '../src/ui/input.ts';

function engine(id: string = 'engine-test'): EngineState {
  return {
    id, name: 'Test Engine', sourcePatternId: 'compression_press', sourcePatternName: 'Compression Press',
    foundational: false, submittable: true, quality: 1, boundValue: 16, accumulatedTimeSec: 0, constituentBlockIds: [],
    ...createProductionBag(stableEngineSeed(id)),
  };
}

describe('Core Loop UX interaction contracts', () => {
  it('maps all physical Digit and Numpad codes independently of characters/IME', () => {
    const expected = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];
    expected.forEach((shape, index) => {
      expect(shapeForHotkey(`Digit${index + 1}`)).toBe(shape);
      expect(shapeForHotkey(`Numpad${index + 1}`)).toBe(shape);
    });
    expect(shapeForHotkey('ㅂ')).toBeNull();
    expect(gameplayCommandForCode('KeyR')).toBe('rotate');
    expect(gameplayCommandForCode('Space')).toBe('pan');
    expect(gameplayCommandForCode('Delete')).toBe('return');
    expect(gameplayCommandForCode('Backspace')).toBe('return');
    expect(gameplayCommandForCode('Escape')).toBe('cancel');
  });

  it('ignores gameplay shortcuts with Ctrl, Meta, or Alt', () => {
    expect(gameplayHotkeysEnabled({ ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    expect(gameplayHotkeysEnabled({ ctrlKey: false, metaKey: true, altKey: false })).toBe(false);
    expect(gameplayHotkeysEnabled({ ctrlKey: false, metaKey: false, altKey: true })).toBe(false);
    expect(gameplayHotkeysEnabled({ ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
  });

  it('keeps all seven inventory slots and the I/O/L/J opening', () => {
    const state = createInitialState();
    expect(Object.keys(state.buffers)).toEqual([...SHAPE_TYPES]);
    expect(state.buffers).toEqual({ I: 1, O: 1, T: 0, L: 1, J: 1, S: 0, Z: 0 });
  });

  it('draws every Shape exactly once across a full deterministic bag', () => {
    const source = engine();
    const result = advanceEngineProduction(source, emptyShapeNumbers(0), getProductionIntervalSec(source) * 7);
    expect(result.generatedShapes).toHaveLength(7);
    expect(new Set(result.generatedShapes)).toEqual(new Set(SHAPE_TYPES));
  });

  it('is deterministic from the same persisted Engine state while Stock has room', () => {
    const source = engine();
    const seconds = getProductionIntervalSec(source) * 3;
    const low = advanceEngineProduction(source, emptyShapeNumbers(0), seconds);
    const highBuffers = emptyShapeNumbers(0); highBuffers.I = 5;
    const high = advanceEngineProduction(source, highBuffers, seconds);
    expect(low.generatedShapes).toEqual(high.generatedShapes);
    expect(low.engine).toEqual(high.engine);
  });

  it('blocks at the global Stock capacity rather than former per-buffer caps', () => {
    const source = engine();
    const buffers = emptyShapeNumbers(0);
    buffers.I = 3;
    const result = advanceEngineProduction(source, buffers, getProductionIntervalSec(source) * 20);
    expect(result.generatedShapes).toHaveLength(9);
    expect(Object.values(result.buffers).reduce((sum, count) => sum + count, 0)).toBe(12);
    expect(getEngineProductionView(result.engine).nextShape).toBeTruthy();
  });

  it('supports Shift toggling and rectangle selection while excluding Engine cells', () => {
    const store = new AppStore();
    const state = store.getState();
    state.blocks = {
      a: { id: 'a', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      b: { id: 'b', shape: 'O', state: 'Loose', grade: 1, position: { x: 14, y: 10 }, rotation: 0 },
      e: { id: 'e', shape: 'O', state: 'Bound', grade: 1, position: { x: 12, y: 10 }, rotation: 0 },
    };
    store.selectBlock('a');
    store.selectBlock('b', true);
    expect(state.selectedBlockIds).toEqual(['a', 'b']);
    store.selectBlock('a', true);
    expect(state.selectedBlockIds).toEqual(['b']);
    expect(store.selectBlocksInRect({ minX: 9, maxX: 15, minY: 9, maxY: 12 })).toEqual(['a', 'b']);
    expect(state.selectedBlockIds).toEqual(['a', 'b']);
    expect(state.selectedBlockIds).not.toContain('e');
  });

  it('prioritizes Engine inspection and Loose hold candidates over active placement', () => {
    const base = { pointerType: 'mouse', pointerCount: 1, button: 0, spaceDown: false, hasSpawnShape: true };
    expect(decidePointerIntent({ ...base, existingBlockState: 'Loose' })).toBe('existing-loose');
    expect(decidePointerIntent({ ...base, existingBlockState: 'Bound' })).toBe('existing-engine');
    expect(decidePointerIntent({ ...base, existingBlockState: null })).toBe('place');
    expect(decidePointerIntent({ ...base, hasSpawnShape: false, existingBlockState: 'Loose' })).toBe('existing-loose');
    expect(decidePointerIntent({ ...base, hasSpawnShape: false, existingBlockState: 'Bound' })).toBe('existing-engine');
    expect(decidePointerIntent({ ...base, hasSpawnShape: false, existingBlockState: null })).toBe('deselect');
    expect(decidePointerIntent({ ...base, button: 2, existingBlockState: 'Loose' })).toBe('pan');
    expect(decidePointerIntent({ ...base, pointerType: 'touch', pointerCount: 2, existingBlockState: null })).toBe('multi-touch');
  });

  it('inspects a Bound Engine click without placing the active Shape', () => {
    const store = new AppStore();
    const state = store.getState();
    state.blocks.bound = {
      id: 'bound', shape: 'O', state: 'Bound', grade: 1, position: { x: 0, y: 0 }, rotation: 0,
    };
    state.engines['engine-test'] = { ...engine(), constituentBlockIds: ['bound'] };
    const buffersBefore = structuredClone(state.buffers);
    const intent = decidePointerIntent({
      pointerType: 'mouse', pointerCount: 1, button: 0, spaceDown: false,
      existingBlockState: 'Bound', hasSpawnShape: true,
    });
    expect(intent).toBe('existing-engine');
    if (intent === 'existing-engine') store.selectEngineByBlockId('bound');
    expect(state.selectedEngineId).toBe('engine-test');
    expect(state.buffers).toEqual(buffersBefore);
    expect(Object.keys(state.blocks)).toEqual(['bound']);
  });

  it('uses a 450ms stationary long-press only', () => {
    expect(shouldCompleteLongPress(449, false)).toBe(false);
    expect(shouldCompleteLongPress(450, false)).toBe(true);
    expect(shouldCompleteLongPress(900, true)).toBe(false);
  });

  it('places at a valid snapped ghost on short Loose release and Returns on long hold', () => {
    expect(decideLooseBlockRelease({
      elapsedMs: 120, pointerMoved: false, hasSpawnShape: true, hasValidGhost: true,
    })).toBe('place');
    expect(decideLooseBlockRelease({
      elapsedMs: 120, pointerMoved: false, hasSpawnShape: true, hasValidGhost: false,
    })).toBe('select');
    expect(decideLooseBlockRelease({
      elapsedMs: 450, pointerMoved: false, hasSpawnShape: true, hasValidGhost: true,
    })).toBe('return');
  });

  it('applies an active-Shape long hold to Return the existing Loose Block only', () => {
    const store = new AppStore();
    const state = store.getState();
    state.blocks.existing = {
      id: 'existing', shape: 'O', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 0,
    };
    state.buffers.O = 0;
    const action = decideLooseBlockRelease({
      elapsedMs: 500, pointerMoved: false, hasSpawnShape: true, hasValidGhost: true,
    });
    expect(action).toBe('return');
    if (action === 'return') store.returnBlock('existing');
    expect(state.blocks.existing).toBeUndefined();
    expect(state.buffers.O).toBe(1);
    expect(Object.keys(state.blocks)).toHaveLength(0);
  });

  it('does not notify subscribers on unproductive clock frames', () => {
    const store = new AppStore();
    const subscriber = vi.fn(); store.subscribe(subscriber);
    store.tick(.016); store.tick(.016);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it('commits placement at the exact supplied ghost origin', () => {
    const store = new AppStore();
    const result = store.placeBlock('I', { x: 4, y: 1 }, 1);
    expect(store.getState().blocks[result.blockId!].position).toEqual({ x: 4, y: 1 });
  });

  it('snaps active J/L/O placement around an occupied Loose Block without overlap', () => {
    const store = new AppStore();
    const state = store.getState();
    state.blocks.existing = {
      id: 'existing', shape: 'O', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 0,
    };
    state.buffers.J = 1;
    const ghost = findNearestValidPlacement('J', 0, { x: 0, y: 0 }, new Set(['0,0', '1,0', '0,1', '1,1']), 3);
    expect(ghost).not.toBeNull();
    expect(decideLooseBlockRelease({
      elapsedMs: 100, pointerMoved: false, hasSpawnShape: true, hasValidGhost: true,
    })).toBe('place');
    const placed = store.placeBlock('J', ghost!);
    expect(placed.success).toBe(true);
    expect(state.blocks[placed.blockId!].position).toEqual(ghost);
    const occupied = new Set(getBlockOccupiedCells('O', { x: 0, y: 0 }, 0).map(cell => `${cell.x},${cell.y}`));
    expect(getBlockOccupiedCells('J', ghost!, 0).some(cell => occupied.has(`${cell.x},${cell.y}`))).toBe(false);
  });
});
