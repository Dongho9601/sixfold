/**
 * Sparse coordinate grid model for HL;BM — Rune Foundry.
 * Maps string coordinate keys ("x,y") to cell occupancy.
 */

import { CellOccupancy, Position } from './types.ts';

export const CHUNK_SIZE = 4;

/**
 * Authored chunk origins for the opening field.
 *
 * The four core chunks cover x:-2..5, y:-2..5. The staging chunk is the
 * documented south-side 4x4 tile at x:0..3, y:6..9. Chunk origins are stored
 * as IDs so the field can remain non-rectangular when expansion is added.
 */
export const OPENING_CHUNK_ORIGINS: readonly Position[] = [
  { x: -2, y: -2 },
  { x: 2, y: -2 },
  { x: -2, y: 2 },
  { x: 2, y: 2 },
  { x: 0, y: 6 },
];

export const OPENING_UNLOCKED_CHUNK_IDS: readonly string[] = Object.freeze(
  OPENING_CHUNK_ORIGINS.map(origin => coordKey(origin.x, origin.y)),
);

export const CRADLE_BOUNDS = {
  minX: 0,
  maxX: 3,
  minY: 0,
  maxY: 3,
};

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCoordKey(key: string): Position {
  const parts = key.split(',');
  return {
    x: parseInt(parts[0], 10),
    y: parseInt(parts[1], 10),
  };
}

/** Returns whether a value is a well-formed integer coordinate/chunk ID. */
export function isCoordKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.split(',');
  if (parts.length !== 2 || parts.some(part => part.trim() === '')) return false;
  const position = parseCoordKey(value);
  return Number.isInteger(position.x) && Number.isInteger(position.y)
    && `${position.x},${position.y}` === value;
}

export function isCradleCell(x: number, y: number): boolean {
  return x >= CRADLE_BOUNDS.minX && x <= CRADLE_BOUNDS.maxX &&
         y >= CRADLE_BOUNDS.minY && y <= CRADLE_BOUNDS.maxY;
}

export function getOpeningUnlockedChunkIds(): string[] {
  return [...OPENING_UNLOCKED_CHUNK_IDS];
}

export function getOpeningUnlockedCells(): Position[] {
  return getUnlockedCells(OPENING_UNLOCKED_CHUNK_IDS);
}

export function getChunkCells(chunkId: string): Position[] {
  const origin = parseCoordKey(chunkId);
  const cells: Position[] = [];
  for (let y = origin.y; y < origin.y + CHUNK_SIZE; y += 1) {
    for (let x = origin.x; x < origin.x + CHUNK_SIZE; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

export function isCellInChunk(x: number, y: number, chunkId: string): boolean {
  const origin = parseCoordKey(chunkId);
  return x >= origin.x && x < origin.x + CHUNK_SIZE
    && y >= origin.y && y < origin.y + CHUNK_SIZE;
}

/** A locked chunk is a candidate only when its ID is not already unlocked. */
export function isChunkUnlocked(chunkId: string, unlockedChunkIds: Iterable<string>): boolean {
  return new Set(unlockedChunkIds).has(chunkId);
}

/** Two authored chunks are side-adjacent only when they share a full 4-cell side. */
export function areChunksSideAdjacent(leftChunkId: string, rightChunkId: string): boolean {
  const left = parseCoordKey(leftChunkId);
  const right = parseCoordKey(rightChunkId);
  return (Math.abs(left.x - right.x) === CHUNK_SIZE && left.y === right.y)
    || (Math.abs(left.y - right.y) === CHUNK_SIZE && left.x === right.x);
}

/** Returns the locked 4x4 chunks that share a complete side with the field. */
export function getAdjacentLockedChunkIds(unlockedChunkIds: Iterable<string>): string[] {
  const unlockedIds = [...new Set(unlockedChunkIds)];
  const unlocked = new Set(unlockedIds);
  const unlockedCells = getUnlockedCellKeys(unlockedIds);
  const candidates = new Set<string>();

  for (const chunkId of unlockedIds) {
    const origin = parseCoordKey(chunkId);
    const adjacentOrigins = [
      { x: origin.x - CHUNK_SIZE, y: origin.y },
      { x: origin.x + CHUNK_SIZE, y: origin.y },
      { x: origin.x, y: origin.y - CHUNK_SIZE },
      { x: origin.x, y: origin.y + CHUNK_SIZE },
    ];
    for (const adjacent of adjacentOrigins) {
      const candidateId = coordKey(adjacent.x, adjacent.y);
      if (unlocked.has(candidateId)) continue;
      // A malformed/hand-edited save may contain overlapping chunk IDs. Such a
      // target is not fully locked and must not become an expansion option.
      if (getChunkCells(candidateId).some(cell => unlockedCells.has(coordKey(cell.x, cell.y)))) continue;
      candidates.add(candidateId);
    }
  }

  return [...candidates]
    .sort((left, right) => {
      const a = parseCoordKey(left);
      const b = parseCoordKey(right);
      return a.y - b.y || a.x - b.x;
    });
}

export function getUnlockedCellKeys(unlockedChunkIds: Iterable<string>): Set<string> {
  const keys = new Set<string>();
  for (const chunkId of unlockedChunkIds) {
    for (const cell of getChunkCells(chunkId)) keys.add(coordKey(cell.x, cell.y));
  }
  return keys;
}

export function getUnlockedCells(unlockedChunkIds: Iterable<string>): Position[] {
  return [...getUnlockedCellKeys(unlockedChunkIds)].map(parseCoordKey);
}

export function isCellUnlocked(x: number, y: number, unlockedChunkIds: Iterable<string>): boolean {
  for (const chunkId of unlockedChunkIds) {
    const origin = parseCoordKey(chunkId);
    if (x >= origin.x && x < origin.x + CHUNK_SIZE &&
        y >= origin.y && y < origin.y + CHUNK_SIZE) {
      return true;
    }
  }
  return false;
}

export function areCellsUnlocked(cells: Iterable<Position>, unlockedChunkIds: Iterable<string>): boolean {
  const chunkIds = [...unlockedChunkIds];
  return [...cells].every(cell => isCellUnlocked(cell.x, cell.y, chunkIds));
}

/** Returns a stable 4x4 chunk ID that contains a legacy cell. */
export function getPreservationChunkIdForCell(x: number, y: number): string {
  const originX = Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
  const originY = Math.floor(y / CHUNK_SIZE) * CHUNK_SIZE;
  return coordKey(originX, originY);
}

/**
 * Returns only the one-cell locked ring around the current field. This keeps
 * frontier rendering finite even though the camera and world are unbounded.
 */
export function getAdjacentLockedFrontierCells(unlockedChunkIds: Iterable<string>): Position[] {
  const unlocked = getUnlockedCellKeys(unlockedChunkIds);
  const frontier = new Set<string>();
  for (const key of unlocked) {
    const cell = parseCoordKey(key);
    const neighbors = [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ];
    for (const neighbor of neighbors) {
      const neighborKey = coordKey(neighbor.x, neighbor.y);
      if (!unlocked.has(neighborKey)) frontier.add(neighborKey);
    }
  }
  return [...frontier]
    .map(parseCoordKey)
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

export class FieldGrid {
  private cells = new Map<string, CellOccupancy>();

  get(x: number, y: number): CellOccupancy | undefined {
    return this.cells.get(coordKey(x, y));
  }

  set(x: number, y: number, occupancy: CellOccupancy): void {
    this.cells.set(coordKey(x, y), occupancy);
  }

  delete(x: number, y: number): boolean {
    return this.cells.delete(coordKey(x, y));
  }

  clear(): void {
    this.cells.clear();
  }

  entries(): [string, CellOccupancy][] {
    return Array.from(this.cells.entries());
  }

  hasCollision(cells: Position[], ignoreBlockId?: string): boolean {
    for (const c of cells) {
      const existing = this.get(c.x, c.y);
      if (existing && existing.blockId !== ignoreBlockId) {
        return true;
      }
    }
    return false;
  }
}
