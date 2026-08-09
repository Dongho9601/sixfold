/**
 * Consequential state transition dispatchers for HL;BM — Rune Foundry.
 * Pure deterministic state transformations for all player actions.
 */

import {
  advanceEngineProduction,
  Block,
  calculateRecipeReward,
  evaluatePattern,
  getBlockOccupiedCells,
  getEngineXpThreshold,
  Position,
  RecipeReward,
  ShapeType,
} from '../core/index.ts';
import { GameState } from './state.ts';

export function getActiveBlocksList(state: GameState): Block[] {
  return Object.values(state.blocks).filter(b => b.state === 'Loose' || b.state === 'Bound');
}

export function getAllOccupiedCells(state: GameState, ignoreBlockId?: string): Map<string, { blockId: string; isEngine: boolean }> {
  const cellMap = new Map<string, { blockId: string; isEngine: boolean }>();
  for (const block of getActiveBlocksList(state)) {
    if (block.id === ignoreBlockId || !block.position) continue;
    const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
    for (const c of cells) {
      cellMap.set(`${c.x},${c.y}`, { blockId: block.id, isEngine: block.state === 'Bound' });
    }
  }
  return cellMap;
}

export function hasCollisionAt(state: GameState, cells: Position[], ignoreBlockId?: string): boolean {
  const occupied = getAllOccupiedCells(state, ignoreBlockId);
  for (const c of cells) {
    if (occupied.has(`${c.x},${c.y}`)) {
      return true;
    }
  }
  return false;
}

export function placeBlockFromBuffer(
  state: GameState,
  shape: ShapeType,
  position: Position,
  rotation: number = 0
): { success: boolean; blockId?: string; error?: string } {
  if ((state.buffers[shape] || 0) <= 0) {
    return { success: false, error: `No ${shape} blocks in buffer.` };
  }

  const targetCells = getBlockOccupiedCells(shape, position, rotation);
  if (hasCollisionAt(state, targetCells)) {
    return { success: false, error: 'Position overlaps with existing block or Engine cell.' };
  }

  const blockId = `block-${state.nextBlockSeq}`;
  const newBlock: Block = {
    id: blockId,
    shape,
    state: 'Loose',
    grade: 1,
    position,
    rotation: ((rotation % 4) + 4) % 4,
  };

  state.blocks[blockId] = newBlock;
  state.buffers[shape] -= 1;
  state.nextBlockSeq += 1;

  return { success: true, blockId };
}

export function moveBlock(
  state: GameState,
  blockId: string,
  newPosition: Position
): { success: boolean; error?: string } {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose') {
    return { success: false, error: 'Block is not a Loose placed block.' };
  }

  const targetCells = getBlockOccupiedCells(block.shape, newPosition, block.rotation);
  if (hasCollisionAt(state, targetCells, blockId)) {
    return { success: false, error: 'Target position overlaps with existing block.' };
  }

  block.position = newPosition;
  if (state.selectedBlockIds.includes(blockId)) {
    analyzeSelection(state);
  }
  return { success: true };
}

export function rotateBlock(
  state: GameState,
  blockId: string
): { success: boolean; newRotation?: number; error?: string } {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose' || !block.position) {
    return { success: false, error: 'Block is not a editable Loose block.' };
  }

  const nextRotation = (block.rotation + 1) % 4;
  const targetCells = getBlockOccupiedCells(block.shape, block.position, nextRotation);
  if (hasCollisionAt(state, targetCells, blockId)) {
    return { success: false, error: 'Rotation overlaps with adjacent block.' };
  }

  block.rotation = nextRotation;
  if (state.selectedBlockIds.includes(blockId)) {
    analyzeSelection(state);
  }
  return { success: true, newRotation: nextRotation };
}

export function returnBlockToBuffer(
  state: GameState,
  blockId: string
): { success: boolean; error?: string } {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose') {
    return { success: false, error: 'Cannot return non-Loose block to buffer.' };
  }

  delete state.blocks[blockId];
  state.buffers[block.shape] = (state.buffers[block.shape] || 0) + 1;
  state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== blockId);
  analyzeSelection(state);

  return { success: true };
}

export function selectBlock(state: GameState, blockId: string, toggle: boolean = false): void {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose') return;

  if (toggle) {
    if (state.selectedBlockIds.includes(blockId)) {
      state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== blockId);
    } else {
      state.selectedBlockIds.push(blockId);
    }
  } else {
    state.selectedBlockIds = [blockId];
  }

  analyzeSelection(state);
}

export function selectAllLooseBlocks(state: GameState): void {
  state.selectedBlockIds = Object.values(state.blocks)
    .filter(b => b.state === 'Loose')
    .map(b => b.id);
  analyzeSelection(state);
}

export function clearSelection(state: GameState): void {
  state.selectedBlockIds = [];
  state.lastAnalysis = null;
}

export function analyzeSelection(state: GameState): GameState {
  const selectedBlocks = state.selectedBlockIds
    .map(id => state.blocks[id])
    .filter((b): b is Block => Boolean(b) && b.state === 'Loose');

  const analysis = evaluatePattern(selectedBlocks);
  state.lastAnalysis = analysis;

  if (analysis.isValid && analysis.patternId !== 'none') {
    if (!state.discoveredPatterns.includes(analysis.patternId)) {
      state.discoveredPatterns.push(analysis.patternId);
    }
  }

  return state;
}

export function bindHeartSeal(state: GameState): { success: boolean; error?: string } {
  if (state.isHeartEngineBound) {
    return { success: false, error: 'Heart Engine is already bound.' };
  }

  analyzeSelection(state);
  if (!state.lastAnalysis || !state.lastAnalysis.isValid || state.lastAnalysis.patternId !== 'heart_seal') {
    return { success: false, error: 'Selection does not satisfy Heart Seal.' };
  }

  // Crystallize selected blocks into persistent Engine cells
  const boundBlockIds: string[] = [];
  for (const blockId of state.selectedBlockIds) {
    const block = state.blocks[blockId];
    if (block && block.state === 'Loose') {
      block.state = 'Bound';
      boundBlockIds.push(blockId);
    }
  }

  state.isHeartEngineBound = true;
  state.heartEngine = {
    id: 'engine-heart',
    name: 'Heart Engine',
    level: 1,
    xp: 0,
    quality: 1.0,
    accumulatedTimeSec: 0,
    constituentBlockIds: boundBlockIds,
  };

  if (!state.discoveredPatterns.includes('heart_seal')) {
    state.discoveredPatterns.push('heart_seal');
  }

  clearSelection(state);
  return { success: true };
}

export function submitRecipe(state: GameState): { success: boolean; reward?: RecipeReward; error?: string } {
  analyzeSelection(state);
  const analysis = state.lastAnalysis;

  if (!analysis || !analysis.isValid || (analysis.patternId !== 'compression_press' && analysis.patternId !== 'twin_stars')) {
    return { success: false, error: 'Current selection is not a valid submission recipe.' };
  }

  const selectedBlocks = state.selectedBlockIds
    .map(id => state.blocks[id])
    .filter((b): b is Block => Boolean(b) && b.state === 'Loose');

  const reward = calculateRecipeReward(selectedBlocks, analysis.quality);

  // Apply Payout
  state.currencies.ash += reward.ash;
  state.currencies.shards += reward.shards;

  if (state.heartEngine) {
    state.heartEngine.xp += reward.engineXp;
    let xpReq = getEngineXpThreshold(state.heartEngine.level);
    while (state.heartEngine.xp >= xpReq) {
      state.heartEngine.xp -= xpReq;
      state.heartEngine.level += 1;
      xpReq = getEngineXpThreshold(state.heartEngine.level);
    }
  }

  // Permanently consume selected blocks
  for (const b of selectedBlocks) {
    b.state = 'Consumed';
    delete state.blocks[b.id];
  }

  if (!state.discoveredPatterns.includes(analysis.patternId)) {
    state.discoveredPatterns.push(analysis.patternId);
  }

  clearSelection(state);
  return { success: true, reward };
}

export function advanceProductionTime(
  state: GameState,
  deltaSeconds: number
): { generatedShapes: ShapeType[]; changed: boolean } {
  if (!state.isHeartEngineBound || !state.heartEngine) {
    return { generatedShapes: [], changed: false };
  }

  const result = advanceEngineProduction(state.heartEngine, state.buffers, deltaSeconds);
  state.heartEngine = result.engine;
  state.buffers = result.buffers;

  return {
    generatedShapes: result.generatedShapes,
    changed: result.generatedShapes.length > 0,
  };
}
