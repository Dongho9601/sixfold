/**
 * Sparse coordinate grid model for HL;BM — Rune Foundry.
 * Maps string coordinate keys ("x,y") to cell occupancy.
 */

import { CellOccupancy, Position } from './types.ts';

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

export function isCradleCell(x: number, y: number): boolean {
  return x >= CRADLE_BOUNDS.minX && x <= CRADLE_BOUNDS.maxX &&
         y >= CRADLE_BOUNDS.minY && y <= CRADLE_BOUNDS.maxY;
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
