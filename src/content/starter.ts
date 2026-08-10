/**
 * Authored Content Definitions for Pass 1.
 * Declarative definitions for Cradle, Starter Patterns, and Recipes.
 */

export interface RecipeDefinition {
  id: string;
  name: string;
  type: 'Foundational' | 'BindOrSubmit';
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
    type: 'BindOrSubmit',
    description: 'Four to ten connected Blocks. Bind as an Engine or Submit for Ash.',
  },
  twin_stars: {
    id: 'twin_stars',
    name: 'Twin Stars',
    type: 'BindOrSubmit',
    description: 'Two equal-sized separated components. Bind as an Engine or Submit for Ash.',
  },
};

export const INITIAL_CRADLE_BOUNDS = {
  minX: 0,
  maxX: 3,
  minY: 0,
  maxY: 3,
};
