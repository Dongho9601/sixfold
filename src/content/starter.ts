/**
 * Authored Content Definitions for Pass 1.
 * Declarative definitions for Cradle, Starter Patterns, and Recipes.
 */

export interface RecipeDefinition {
  id: string;
  name: string;
  type: 'Foundational' | 'Bind';
  description: string;
}

export const STARTER_RECIPES: Record<string, RecipeDefinition> = {
  heart_seal: {
    id: 'heart_seal',
    name: 'Heart Seal',
    type: 'Foundational',
    description: 'Exact 4x4 fill of the opening Cradle. Freezes starter blocks into a permanent Heart Engine.',
  },
  compression_press: {
    id: 'compression_press',
    name: 'Compression Press',
    type: 'Bind',
    description: 'Four to ten connected Blocks. Bind as an Engine.',
  },
  twin_stars: {
    id: 'twin_stars',
    name: 'Twin Stars',
    type: 'Bind',
    description: 'Two equal separated groups with at least two Blocks each. Bind as an Engine.',
  },
};

export const INITIAL_CRADLE_BOUNDS = {
  minX: 0,
  maxX: 3,
  minY: 0,
  maxY: 3,
};
