import { describe, expect, it } from 'vitest';
import {
  BASE_SHAPE_OFFSETS,
  getBlockOccupiedCells,
  rotateAndNormalizeOffsets,
  ShapeType,
} from '../src/core/shapes.ts';
import { FieldGrid } from '../src/core/field.ts';

describe('Tetromino Shapes & Collision Math', () => {
  it('should support rotations for I, O, L, J', () => {
    const shapes: ShapeType[] = ['I', 'O', 'L', 'J'];
    for (const shape of shapes) {
      for (let r = 0; r < 4; r++) {
        const cells = getBlockOccupiedCells(shape, { x: 5, y: 5 }, r);
        expect(cells).toHaveLength(4);
        // All cell offsets should be non-negative relative to origin
        for (const c of cells) {
          expect(c.x).toBeGreaterThanOrEqual(5);
          expect(c.y).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  it('should rotate and normalize offset boxes deterministically', () => {
    const baseI = BASE_SHAPE_OFFSETS['I'];
    const rot0 = rotateAndNormalizeOffsets(baseI, 0);
    const rot1 = rotateAndNormalizeOffsets(baseI, 1);

    expect(rot0).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
    expect(rot1).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }]);
  });

  it('should detect grid cell collisions accurately', () => {
    const grid = new FieldGrid();
    grid.set(1, 1, { blockId: 'block-1', shape: 'O', isEngine: false });

    const cellsOverlap = getBlockOccupiedCells('O', { x: 0, y: 0 }, 0); // (0,0), (1,0), (0,1), (1,1)
    const cellsFree = getBlockOccupiedCells('O', { x: 5, y: 5 }, 0);

    expect(grid.hasCollision(cellsOverlap)).toBe(true);
    expect(grid.hasCollision(cellsFree)).toBe(false);
  });
});
