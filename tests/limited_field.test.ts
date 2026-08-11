import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { createInitialState, normalizeGameState, SAVE_VERSION } from '../src/application/state.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';
import {
  findNearestValidPlacement,
  getBlockOccupiedCells,
  getOpeningUnlockedCells,
  getPreservationChunkIdForCell,
  getUnlockedCellKeys,
  isCellUnlocked,
  OPENING_UNLOCKED_CHUNK_IDS,
} from '../src/core/index.ts';

function mockStorage(): void {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(), length: 0, key: () => null,
  } as Storage;
}

describe('Pass 3A limited field', () => {
  it('creates the canonical 80-cell opening layout', () => {
    const state = createInitialState();
    const cells = getUnlockedCellKeys(state.unlockedChunks);

    expect(state.unlockedChunks).toEqual([...OPENING_UNLOCKED_CHUNK_IDS]);
    expect(getOpeningUnlockedCells()).toHaveLength(80);
    expect(cells).toHaveLength(80);
    expect(isCellUnlocked(0, 0, state.unlockedChunks)).toBe(true);
    expect(isCellUnlocked(5, 5, state.unlockedChunks)).toBe(true);
    expect(isCellUnlocked(3, 9, state.unlockedChunks)).toBe(true);
    expect(isCellUnlocked(6, 0, state.unlockedChunks)).toBe(false);
    expect(isCellUnlocked(4, 6, state.unlockedChunks)).toBe(false);
  });

  it('accepts a tetromino fully inside the unlocked field', () => {
    const store = new AppStore();
    const result = store.placeBlock('I', { x: 4, y: 2 }, 1);

    expect(result.success).toBe(true);
    expect(getBlockOccupiedCells('I', { x: 4, y: 2 }, 1)
      .every(cell => isCellUnlocked(cell.x, cell.y, store.getState().unlockedChunks))).toBe(true);
  });

  it('rejects a placement when one tetromino cell crosses into locked space', () => {
    const store = new AppStore();
    const result = store.placeBlock('I', { x: 5, y: 4 }, 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain('locked');
    expect(Object.keys(store.getState().blocks)).toHaveLength(0);
  });

  it('keeps nearest-valid ghost search inside the unlocked field', () => {
    const state = createInitialState();
    const desired = { x: 5, y: 4 };
    const ghost = findNearestValidPlacement(
      'I',
      1,
      desired,
      new Set<string>(),
      3,
      state.unlockedChunks,
    );

    expect(ghost).not.toBeNull();
    expect(getBlockOccupiedCells('I', ghost!, 1)
      .every(cell => isCellUnlocked(cell.x, cell.y, state.unlockedChunks))).toBe(true);
    expect(ghost).not.toEqual(desired);
  });

  it('applies field legality to movement and rotation', () => {
    const store = new AppStore();
    const placed = store.placeBlock('O', { x: -2, y: 4 });
    expect(placed.success).toBe(true);

    expect(store.moveBlock(placed.blockId!, { x: 4, y: 4 }).success).toBe(true);
    expect(store.moveBlock(placed.blockId!, { x: 4, y: 5 }).success).toBe(false);
    expect(store.getState().blocks[placed.blockId!].position).toEqual({ x: 4, y: 4 });

    const vertical = store.placeBlock('I', { x: 4, y: 0 }, 1);
    expect(vertical.success).toBe(true);
    expect(store.rotateBlock(vertical.blockId!).success).toBe(false);
    expect(store.getState().blocks[vertical.blockId!].rotation).toBe(1);
  });

  it('round-trips unlocked chunks through local persistence', () => {
    mockStorage();
    const store = new AppStore();
    store.getState().unlockedChunks.push('6,-2');
    expect(saveGameState(store.getState())).toBe(true);

    const reloaded = loadGameState()!;
    expect(reloaded.unlockedChunks).toContain('6,-2');
    expect(reloaded.unlockedChunks).toEqual(store.getState().unlockedChunks);
  });

  it('migrates legacy off-opening Blocks into deterministic preservation chunks', () => {
    const legacy = createInitialState() as GameStateLike;
    delete legacy.unlockedChunks;
    legacy.version = SAVE_VERSION - 1;
    legacy.blocks.legacy = {
      id: 'legacy', shape: 'I', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0,
    };

    const migrated = normalizeGameState(legacy as never);
    const preservationChunk = getPreservationChunkIdForCell(10, 10);

    expect(migrated.blocks.legacy).toBeDefined();
    expect(migrated.unlockedChunks).toEqual(expect.arrayContaining([...OPENING_UNLOCKED_CHUNK_IDS, preservationChunk]));
    expect(getBlockOccupiedCells('I', { x: 10, y: 10 }, 0)
      .every(cell => isCellUnlocked(cell.x, cell.y, migrated.unlockedChunks))).toBe(true);
    expect(migrated.version).toBe(SAVE_VERSION);
  });
});

type GameStateLike = Partial<ReturnType<typeof createInitialState>> & {
  version: number;
  blocks: ReturnType<typeof createInitialState>['blocks'];
};
