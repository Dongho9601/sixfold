/**
 * Authored Content Definitions for Pass 1.
 * Declarative definitions for Cradle, Starter Patterns, and Recipes.
 */

export interface RecipeDefinition {
  id: string;
  name: string;
  type: 'Bind' | 'Consumptive';
  description: string;
}

export const STARTER_RECIPES: Record<string, RecipeDefinition> = {
  heart_seal: {
    id: 'heart_seal',
    name: 'Heart Seal',
    type: 'Bind',
    description: 'Exact 4x4 fill of the opening Cradle. Freezes starter blocks into a permanent Heart Engine.',
  },
  compression_press: {
    id: 'compression_press',
    name: 'Compression Press',
    type: 'Consumptive',
    description: 'Dense connected block component with maximum shared edges. Consumes blocks for Ash, Shards, and Engine XP.',
  },
  twin_stars: {
    id: 'twin_stars',
    name: 'Twin Stars',
    type: 'Consumptive',
    description: 'Two equal-sized disconnected components separated in space. Consumes blocks for Ash, Shards, and Engine XP.',
  },
};

export const INITIAL_CRADLE_BOUNDS = {
  minX: 0,
  maxX: 3,
  minY: 0,
  maxY: 3,
};
