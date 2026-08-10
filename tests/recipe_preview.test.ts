import { describe, expect, it } from 'vitest';
import { STARTER_RECIPES, materializeRecipePreviewBlocks } from '../src/content/starter.ts';
import { evaluatePattern, getBlockOccupiedCells, SHAPE_TYPES, ShapeType } from '../src/core/index.ts';

describe('Recipe Sidebar Previews Validation', () => {
  it('1. Compression preview exists', () => {
    const compression = STARTER_RECIPES['compression_press'];
    expect(compression).toBeDefined();
    expect(compression.previewKind).toBe('example');
    expect(compression.previewBlocks).toBeDefined();
    expect(compression.previewBlocks!.length).toBeGreaterThan(0);
  });

  it('2. Compression preview materializes to a valid compression_press', () => {
    const compression = STARTER_RECIPES['compression_press'];
    const blocks = materializeRecipePreviewBlocks(compression.previewBlocks!);
    const analysis = evaluatePattern(blocks);
    expect(analysis.isValid).toBe(true);
    expect(analysis.patternId).toBe('compression_press');
  });

  it('3. Twin Stars preview exists', () => {
    const twins = STARTER_RECIPES['twin_stars'];
    expect(twins).toBeDefined();
    expect(twins.previewKind).toBe('example');
    expect(twins.previewBlocks).toBeDefined();
    expect(twins.previewBlocks!.length).toBeGreaterThan(0);
  });

  it('4. Twin Stars preview materializes to a valid twin_stars', () => {
    const twins = STARTER_RECIPES['twin_stars'];
    const blocks = materializeRecipePreviewBlocks(twins.previewBlocks!);
    const analysis = evaluatePattern(blocks);
    expect(analysis.isValid).toBe(true);
    expect(analysis.patternId).toBe('twin_stars');
  });

  it('5. Preview cells contain no overlaps', () => {
    for (const recipe of Object.values(STARTER_RECIPES)) {
      if (recipe.previewBlocks) {
        const occupiedKeys = new Set<string>();
        for (const block of recipe.previewBlocks) {
          const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
          for (const cell of cells) {
            const key = `${cell.x},${cell.y}`;
            expect(occupiedKeys.has(key)).toBe(false);
            occupiedKeys.add(key);
          }
        }
      }
    }
  });

  it('6. Preview geometry uses only canonical Shapes', () => {
    const canonicalSet = new Set<ShapeType>(SHAPE_TYPES);
    for (const recipe of Object.values(STARTER_RECIPES)) {
      if (recipe.previewBlocks) {
        for (const block of recipe.previewBlocks) {
          expect(canonicalSet.has(block.shape)).toBe(true);
        }
      }
    }
  });

  it('7. Non-exact Recipe previews are marked example', () => {
    expect(STARTER_RECIPES['compression_press'].previewKind).toBe('example');
    expect(STARTER_RECIPES['twin_stars'].previewKind).toBe('example');
  });

  it('8. Heart Seal remains represented as an exact target, not an example topology', () => {
    const heart = STARTER_RECIPES['heart_seal'];
    expect(heart.previewKind).toBe('exact');
    expect(heart.previewBlocks).toBeUndefined();
  });

  it('9. Removing/changing Recipe rules would cause stale invalid previews to fail validation', () => {
    // 3 blocks is below the 4-block minimum for Compression Press
    const invalidCompressionBlocks = materializeRecipePreviewBlocks([
      { shape: 'O', position: { x: 0, y: 10 }, rotation: 0 },
      { shape: 'I', position: { x: 2, y: 10 }, rotation: 1 },
      { shape: 'L', position: { x: 0, y: 12 }, rotation: 0 },
    ]);
    const analysis = evaluatePattern(invalidCompressionBlocks);
    expect(analysis.isValid).toBe(false);
  });
});
