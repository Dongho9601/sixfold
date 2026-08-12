/**
 * Authored Content Definitions for Pass 1.
 * Declarative definitions for Cradle, Starter Patterns, and Recipes.
 */

import { Block, Position, ShapeType } from '../core/types.ts';

export interface RecipePreviewBlock {
  shape: ShapeType;
  position: Position;
  rotation: number;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  type: 'Foundational' | 'Bind' | 'Frontier';
  description: string;
  previewKind: 'exact' | 'example';
  previewBlocks?: RecipePreviewBlock[];
}

export function materializeRecipePreviewBlocks(previewBlocks: RecipePreviewBlock[]): Block[] {
  return previewBlocks.map((block, index) => ({
    id: `preview_block_${index}`,
    shape: block.shape,
    state: 'Loose',
    grade: 1,
    position: block.position,
    rotation: block.rotation,
  }));
}

export const STARTER_RECIPES: Record<string, RecipeDefinition> = {
  heart_seal: {
    id: 'heart_seal',
    name: 'Heart Seal',
    type: 'Foundational',
    description: 'Exact 4x4 fill of opening Cradle.',
    previewKind: 'exact',
  },
  compression_press: {
    id: 'compression_press',
    name: 'Compression Press',
    type: 'Bind',
    description: '4–10 connected',
    previewKind: 'example',
    previewBlocks: [
      { shape: 'O', position: { x: 0, y: 10 }, rotation: 0 },
      { shape: 'I', position: { x: 2, y: 10 }, rotation: 1 },
      { shape: 'L', position: { x: 0, y: 12 }, rotation: 0 },
      { shape: 'T', position: { x: 2, y: 14 }, rotation: 0 },
    ],
  },
  twin_stars: {
    id: 'twin_stars',
    name: 'Twin Stars',
    type: 'Bind',
    description: '2+2 or more<br>equal groups · separated',
    previewKind: 'example',
    previewBlocks: [
      { shape: 'O', position: { x: 0, y: 10 }, rotation: 0 },
      { shape: 'I', position: { x: 0, y: 12 }, rotation: 0 },
      { shape: 'O', position: { x: 2, y: 14 }, rotation: 0 },
      { shape: 'J', position: { x: 2, y: 16 }, rotation: 1 },
    ],
  },
  frontier_seal: {
    id: 'frontier_seal',
    name: 'Frontier Seal',
    type: 'Frontier',
    description: 'Four I Blocks · complete 2×8 rectangle',
    previewKind: 'exact',
    previewBlocks: [
      { shape: 'I', position: { x: 0, y: 0 }, rotation: 1 },
      { shape: 'I', position: { x: 1, y: 0 }, rotation: 1 },
      { shape: 'I', position: { x: 0, y: 4 }, rotation: 1 },
      { shape: 'I', position: { x: 1, y: 4 }, rotation: 1 },
    ],
  },
};

export const INITIAL_CRADLE_BOUNDS = {
  minX: 0,
  maxX: 3,
  minY: 0,
  maxY: 3,
};
