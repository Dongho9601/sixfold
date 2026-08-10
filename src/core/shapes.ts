/**
 * Canonical tetromino geometry for all seven Shapes.
 */

import { Position, ShapeType } from './types.ts';
export type { ShapeType };

export const BASE_SHAPE_OFFSETS: Record<ShapeType, Position[]> = {
  I: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  O: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  T: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  L: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  J: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
};

export function rotateAndNormalizeOffsets(baseOffsets: Position[], rotation: number): Position[] {
  const r = ((rotation % 4) + 4) % 4;
  const rotated = baseOffsets.map(pt => {
    switch (r) {
      case 0: return { x: pt.x, y: pt.y };
      case 1: return { x: -pt.y, y: pt.x };
      case 2: return { x: -pt.x, y: -pt.y };
      case 3: return { x: pt.y, y: -pt.x };
      default: return { x: pt.x, y: pt.y };
    }
  });

  const minX = Math.min(...rotated.map(p => p.x));
  const minY = Math.min(...rotated.map(p => p.y));

  return rotated.map(p => ({
    x: p.x - minX,
    y: p.y - minY,
  }));
}

export function getBlockOccupiedCells(shape: ShapeType, origin: Position, rotation: number): Position[] {
  const base = BASE_SHAPE_OFFSETS[shape];
  if (!base) {
    throw new Error(`Unsupported shape type: ${shape}`);
  }
  const relOffsets = rotateAndNormalizeOffsets(base, rotation);
  return relOffsets.map(off => ({
    x: origin.x + off.x,
    y: origin.y + off.y,
  }));
}

export function getBlockBounds(cells: Position[]): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  const xs = cells.map(c => c.x);
  const ys = cells.map(c => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}
