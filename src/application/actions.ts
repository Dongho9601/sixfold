/**
 * Consequential state transition dispatchers for HL;BM — Rune Foundry.
 * Pure deterministic state transformations for all player actions.
 */

import {
  advanceEngineProduction,
  Block,
  calculateRecipeReward,
  evaluatePattern,
  findConnectedComponents,
  getBlockOccupiedCells,
  getEngineXpThreshold,
  isCradleCell,
  Position,
  RecipeReward,
  ShapeType,
} from '../core/index.ts';
import { GameState } from './state.ts';

export function getActiveBlocksList(state: GameState): Block[] {
  return Object.values(state.blocks).filter(b => b.state === 'Loose' || b.state === 'Bound');
}

export function getLooseBlocksList(state: GameState): Block[] {
  return Object.values(state.blocks).filter(b => b.state === 'Loose' && b.position !== null);
}

const MAX_FIELD_CANDIDATE_BLOCKS = 12;
const MAX_NEARBY_COMPONENT_DISTANCE = 8;

function blockCells(block: Block): Position[] {
  return block.position ? getBlockOccupiedCells(block.shape, block.position, block.rotation) : [];
}

function blockTouchesCradle(block: Block): boolean {
  return blockCells(block).some(cell => isCradleCell(cell.x, cell.y));
}

function componentCenter(component: { cells: Position[] }): Position {
  return {
    x: component.cells.reduce((sum, cell) => sum + cell.x, 0) / component.cells.length,
    y: component.cells.reduce((sum, cell) => sum + cell.y, 0) / component.cells.length,
  };
}

function distanceBetween(left: Position, right: Position): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/**
 * Selects a small, explainable candidate for Field-first Pattern feedback.
 * This deliberately avoids searching every subset of every Loose Block.
 */
export function getFieldPatternCandidate(state: GameState, focusBlockId?: string | null): Block[] {
  const looseBlocks = getLooseBlocksList(state);
  if (looseBlocks.length === 0) return [];

  const selectedBlocks = state.selectedBlockIds
    .map(id => state.blocks[id])
    .filter((block): block is Block => Boolean(block) && block.state === 'Loose' && block.position !== null);
  if (selectedBlocks.length > 0) return selectedBlocks;

  const focusId = focusBlockId || state.recentFieldBlockId;
  const focusBlock = focusId ? state.blocks[focusId] : undefined;
  const cradleBlocks = looseBlocks.filter(blockTouchesCradle);
  if (focusBlock && blockTouchesCradle(focusBlock) && cradleBlocks.length > 0) {
    return cradleBlocks.slice(0, MAX_FIELD_CANDIDATE_BLOCKS);
  }

  const components = findConnectedComponents(looseBlocks);
  const focusComponent = focusId
    ? components.find(component => component.blockIds.includes(focusId))
    : undefined;

  if (focusComponent) {
    const candidateIds = new Set(focusComponent.blockIds);
    const focusCenter = componentCenter(focusComponent);
    const nearby = components
      .filter(component => component.id !== focusComponent.id)
      .map(component => ({
        component,
        distance: distanceBetween(focusCenter, componentCenter(component)),
      }))
      .filter(entry => entry.distance <= MAX_NEARBY_COMPONENT_DISTANCE)
      .sort((left, right) => left.distance - right.distance)[0];

    if (nearby) {
      for (const blockId of nearby.component.blockIds) candidateIds.add(blockId);
    }

    return looseBlocks
      .filter(block => candidateIds.has(block.id))
      .slice(0, MAX_FIELD_CANDIDATE_BLOCKS);
  }

  if (focusBlock) return [focusBlock];
  return looseBlocks.slice(0, MAX_FIELD_CANDIDATE_BLOCKS);
}

export function refreshFieldPattern(state: GameState, focusBlockId?: string | null): GameState {
  const candidate = getFieldPatternCandidate(state, focusBlockId);
  state.fieldCandidateBlockIds = candidate.map(block => block.id);
  if (focusBlockId) state.recentFieldBlockId = focusBlockId;

  if (candidate.length === 0) {
    state.fieldAnalysis = null;
    return state;
  }

  const analysis = evaluatePattern(candidate);
  state.fieldAnalysis = analysis;
  if (analysis.isValid && analysis.patternId !== 'none' && !state.discoveredPatterns.includes(analysis.patternId)) {
    state.discoveredPatterns.push(analysis.patternId);
  }
  return state;
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
  state.recentFieldBlockId = blockId;
  refreshFieldPattern(state, blockId);

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
  } else {
    refreshFieldPattern(state, blockId);
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
  } else {
    refreshFieldPattern(state, blockId);
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
  if (state.recentFieldBlockId === blockId) state.recentFieldBlockId = null;
  if (state.selectedBlockIds.length > 0) analyzeSelection(state);
  else refreshFieldPattern(state);

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
  refreshFieldPattern(state);
}

export function analyzeSelection(state: GameState): GameState {
  const selectedBlocks = state.selectedBlockIds
    .map(id => state.blocks[id])
    .filter((b): b is Block => Boolean(b) && b.state === 'Loose');

  if (selectedBlocks.length === 0) {
    state.lastAnalysis = null;
    refreshFieldPattern(state);
    return state;
  }

  const analysis = evaluatePattern(selectedBlocks);
  state.lastAnalysis = analysis;
  state.fieldAnalysis = analysis;
  state.fieldCandidateBlockIds = selectedBlocks.map(block => block.id);

  if (analysis.isValid && analysis.patternId !== 'none') {
    if (!state.discoveredPatterns.includes(analysis.patternId)) {
      state.discoveredPatterns.push(analysis.patternId);
    }
  }

  return state;
}

export interface SubmissionPreview {
  blocks: Block[];
  analysis: ReturnType<typeof evaluatePattern> | null;
  reward: RecipeReward | null;
}

export function getSubmissionPreview(state: GameState): SubmissionPreview {
  const blocks = state.selectedBlockIds
    .map(id => state.blocks[id])
    .filter((block): block is Block => Boolean(block) && block.state === 'Loose' && block.position !== null);
  if (blocks.length === 0) return { blocks, analysis: null, reward: null };

  const analysis = evaluatePattern(blocks);
  const isRecipe = analysis.isValid && (analysis.patternId === 'compression_press' || analysis.patternId === 'twin_stars');
  return {
    blocks,
    analysis,
    reward: isRecipe ? calculateRecipeReward(blocks, analysis.quality) : null,
  };
}

export function bindHeartSeal(state: GameState): { success: boolean; error?: string } {
  if (state.isHeartEngineBound) {
    return { success: false, error: 'Heart Engine is already bound.' };
  }

  let analysis = state.fieldAnalysis;
  let candidateIds = state.fieldCandidateBlockIds;

  if (!analysis?.isValid || analysis.patternId !== 'heart_seal' || candidateIds.length === 0) {
    analyzeSelection(state);
    analysis = state.lastAnalysis;
    candidateIds = state.selectedBlockIds;
  }

  if (!analysis || !analysis.isValid || analysis.patternId !== 'heart_seal') {
    return { success: false, error: 'Selection does not satisfy Heart Seal.' };
  }

  // Crystallize selected blocks into persistent Engine cells
  const boundBlockIds: string[] = [];
  for (const blockId of candidateIds) {
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
  state.fieldAnalysis = null;
  state.fieldCandidateBlockIds = [];
  state.recentFieldBlockId = null;
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

  if (state.recentFieldBlockId && selectedBlocks.some(block => block.id === state.recentFieldBlockId)) {
    state.recentFieldBlockId = null;
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
