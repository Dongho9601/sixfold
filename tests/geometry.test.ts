import { describe, expect, it } from 'vitest';
import { Block } from '../src/core/types.ts';
import {
  calculateInterBlockSharedEdges,
  evaluatePattern,
  findConnectedComponents,
} from '../src/core/geometry.ts';

describe('Pure Geometry Resolver', () => {
  it('should recognize valid Heart Seal 4x4 exact fill', () => {
    // 4 starter blocks placed inside 0..3, 0..3 with 0 overlap
    // I r=1 at (0,0): (0,0), (0,1), (0,2), (0,3)
    // O r=0 at (1,0): (1,0), (2,0), (1,1), (2,1)
    // J r=2 at (2,0): (2,0)... wait, let's use exact non-overlapping positions
    // Let's create 4 blocks covering all 16 cells of 0..3, 0..3:
    // Block 1 (I r=1 at 0,0): x=0, y=0..3
    // Block 2 (I r=1 at 1,0): x=1, y=0..3
    // Block 3 (I r=1 at 2,0): x=2, y=0..3
    // Block 4 (I r=1 at 3,0): x=3, y=0..3
    const blocks: Block[] = [
      { id: 'b1', shape: 'I', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 1 },
      { id: 'b2', shape: 'I', state: 'Loose', grade: 1, position: { x: 1, y: 0 }, rotation: 1 },
      { id: 'b3', shape: 'I', state: 'Loose', grade: 1, position: { x: 2, y: 0 }, rotation: 1 },
      { id: 'b4', shape: 'I', state: 'Loose', grade: 1, position: { x: 3, y: 0 }, rotation: 1 },
    ];

    const result = evaluatePattern(blocks);
    expect(result.isValid).toBe(true);
    expect(result.patternId).toBe('heart_seal');
    expect(result.quality).toBe(1.0);
  });

  it('should reject incomplete Heart Seal Cradle fill', () => {
    const blocks: Block[] = [
      { id: 'b1', shape: 'I', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 1 },
      { id: 'b2', shape: 'I', state: 'Loose', grade: 1, position: { x: 1, y: 0 }, rotation: 1 },
    ];

    const result = evaluatePattern(blocks);
    expect(result.isValid).toBe(false);
    expect(result.nearMatchReason).toContain('16 cells');
  });

  it('should evaluate Compression Press connected cohesion', () => {
    // 2 touching blocks forming 1 connected component outside cradle
    const blocks: Block[] = [
      { id: 'b1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      { id: 'b2', shape: 'O', state: 'Loose', grade: 1, position: { x: 12, y: 10 }, rotation: 0 },
    ];

    const components = findConnectedComponents(blocks);
    expect(components).toHaveLength(1);

    const sharedEdges = calculateInterBlockSharedEdges(blocks);
    expect(sharedEdges).toBeGreaterThan(0);

    const result = evaluatePattern(blocks);
    expect(result.isValid).toBe(true);
    expect(result.patternId).toBe('compression_press');
    expect(result.quality).toBeGreaterThan(0.5);
  });

  it('should evaluate Twin Stars twin component requirement & balance', () => {
    // Component 1 at (10, 10), Component 2 at (15, 10)
    const validTwin: Block[] = [
      { id: 'b1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      { id: 'b2', shape: 'O', state: 'Loose', grade: 1, position: { x: 15, y: 10 }, rotation: 0 },
    ];

    const resultValid = evaluatePattern(validTwin);
    expect(resultValid.isValid).toBe(true);
    expect(resultValid.patternId).toBe('twin_stars');

    // Unequal block count should be near-match invalid
    const invalidTwin: Block[] = [
      { id: 'b1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      { id: 'b2', shape: 'O', state: 'Loose', grade: 1, position: { x: 11, y: 10 }, rotation: 0 },
      { id: 'b3', shape: 'O', state: 'Loose', grade: 1, position: { x: 20, y: 20 }, rotation: 0 },
    ];

    const resultInvalid = evaluatePattern(invalidTwin);
    expect(resultInvalid.isValid).toBe(false);
    expect(resultInvalid.nearMatchReason).toContain('same number of Blocks');
  });

  it('should be translation invariant for recipes', () => {
    const patternA: Block[] = [
      { id: 'b1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      { id: 'b2', shape: 'O', state: 'Loose', grade: 1, position: { x: 12, y: 10 }, rotation: 0 },
    ];

    const patternB: Block[] = [
      { id: 'b1', shape: 'O', state: 'Loose', grade: 1, position: { x: 50, y: -20 }, rotation: 0 },
      { id: 'b2', shape: 'O', state: 'Loose', grade: 1, position: { x: 52, y: -20 }, rotation: 0 },
    ];

    const resA = evaluatePattern(patternA);
    const resB = evaluatePattern(patternB);

    expect(resA.patternId).toBe(resB.patternId);
    expect(resA.isValid).toBe(true);
    expect(resB.isValid).toBe(true);
    expect(resA.quality).toBe(resB.quality);
  });
});
