/** Pure deterministic state transitions for placement, Patterns, Engines, and progression. */

import {
  advanceEngineShape,
  analyzeFrontierSeal,
  FrontierSealGeometryResult,
  FrontierTargetValidation,
  Block,
  calculateBoundValue,
  calculateEngineSubmissionShards,
  createProductionBag,
  derivePoweredEngineIds,
  DEFAULT_BASE_PRODUCTION_RATE,
  EngineState,
  evaluatePattern,
  findConnectedComponents,
  getBlockOccupiedCells,
  getProductionIntervalSec,
  getShapeGradeUpgradeCost,
  isCradleCell,
  getAdjacentLockedChunkIds,
  OPENING_UNLOCKED_CHUNK_IDS,
  Position,
  ShapeType,
  STOCK_CAPACITY,
  stableEngineSeed,
  isStockFull,
  normalizeEngineProduction,
  validateTetrominoPlacement,
  validateFrontierTarget,
  validateFrontierSeal,
} from '../core/index.ts';
import { advanceDirectiveProgress } from './directives.ts';
import { GameState } from './state.ts';

export function getActiveBlocksList(state: GameState): Block[] {
  return Object.values(state.blocks).filter(block => block.state === 'Loose' || block.state === 'Bound');
}

export function getLooseBlocksList(state: GameState): Block[] {
  return Object.values(state.blocks).filter(block => block.state === 'Loose' && block.position !== null);
}

const MAX_FIELD_CANDIDATE_BLOCKS = 12;
const MAX_NEARBY_COMPONENT_DISTANCE = 8;
const BINDABLE_RECIPE_IDS = new Set(['compression_press', 'twin_stars']);

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

/** Select a small, explainable local candidate without exhaustive subset search. */
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
      .map(component => ({ component, distance: distanceBetween(focusCenter, componentCenter(component)) }))
      .filter(entry => entry.distance <= MAX_NEARBY_COMPONENT_DISTANCE)
      .sort((left, right) => left.distance - right.distance || left.component.id - right.component.id)[0];
    if (nearby) for (const blockId of nearby.component.blockIds) candidateIds.add(blockId);
    return looseBlocks.filter(block => candidateIds.has(block.id)).slice(0, MAX_FIELD_CANDIDATE_BLOCKS);
  }

  if (focusBlock) return [focusBlock];
  return looseBlocks.slice(0, MAX_FIELD_CANDIDATE_BLOCKS);
}

export function refreshFieldPattern(state: GameState, focusBlockId?: string | null): GameState {
  const candidate = getFieldPatternCandidate(state, focusBlockId);
  state.fieldCandidateBlockIds = candidate.map(block => block.id);
  if (focusBlockId) state.recentFieldBlockId = focusBlockId;
  state.fieldAnalysis = candidate.length > 0 ? evaluatePattern(candidate) : null;
  const patternId = state.fieldAnalysis?.patternId;
  if (state.fieldAnalysis?.isValid && patternId && patternId !== 'none' && !state.discoveredPatterns.includes(patternId)) {
    state.discoveredPatterns.push(patternId);
  }
  return state;
}

export function getAllOccupiedCells(state: GameState, ignoreBlockId?: string): Map<string, { blockId: string; isEngine: boolean }> {
  const cellMap = new Map<string, { blockId: string; isEngine: boolean }>();
  for (const block of getActiveBlocksList(state)) {
    if (block.id === ignoreBlockId || !block.position) continue;
    for (const cell of getBlockOccupiedCells(block.shape, block.position, block.rotation)) {
      cellMap.set(`${cell.x},${cell.y}`, { blockId: block.id, isEngine: block.state === 'Bound' });
    }
  }
  return cellMap;
}

function getStateUnlockedChunks(state: GameState): readonly string[] {
  return state.unlockedChunks?.length ? state.unlockedChunks : OPENING_UNLOCKED_CHUNK_IDS;
}

function validateStatePlacement(
  state: GameState,
  cells: Position[],
  ignoreBlockId?: string,
): ReturnType<typeof validateTetrominoPlacement> {
  return validateTetrominoPlacement(cells, getAllOccupiedCells(state, ignoreBlockId), getStateUnlockedChunks(state));
}

function placementError(violation: ReturnType<typeof validateTetrominoPlacement>['violation']): string {
  return violation === 'locked'
    ? 'Placement crosses locked Field cells.'
    : 'Position overlaps existing Field cells.';
}

function isPatternFieldLegal(state: GameState, blocks: Block[]): boolean {
  const selectedIds = new Set(blocks.map(block => block.id));
  const externalOccupancy = new Map<string, { blockId: string; isEngine: boolean }>();
  for (const block of getActiveBlocksList(state)) {
    if (selectedIds.has(block.id)) continue;
    for (const cell of blockCells(block)) {
      externalOccupancy.set(`${cell.x},${cell.y}`, { blockId: block.id, isEngine: block.state === 'Bound' });
    }
  }

  const selectedCells = new Set<string>();
  for (const block of blocks) {
    const cells = blockCells(block);
    const validation = validateTetrominoPlacement(
      cells,
      externalOccupancy,
      getStateUnlockedChunks(state),
    );
    if (!validation.valid) return false;
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      if (selectedCells.has(key)) return false;
      selectedCells.add(key);
    }
  }
  return true;
}

export function hasCollisionAt(state: GameState, cells: Position[], ignoreBlockId?: string): boolean {
  const occupied = getAllOccupiedCells(state, ignoreBlockId);
  return cells.some(cell => occupied.has(`${cell.x},${cell.y}`));
}

export function placeBlockFromBuffer(
  state: GameState,
  shape: ShapeType,
  position: Position,
  rotation: number = 0,
): { success: boolean; blockId?: string; error?: string } {
  if ((state.buffers[shape] || 0) <= 0) return { success: false, error: `No ${shape} Blocks in inventory.` };
  const cells = getBlockOccupiedCells(shape, position, rotation);
  const validation = validateStatePlacement(state, cells);
  if (!validation.valid) {
    return { success: false, error: placementError(validation.violation) };
  }

  const blockId = `block-${state.nextBlockSeq}`;
  state.blocks[blockId] = {
    id: blockId,
    shape,
    state: 'Loose',
    grade: state.shapeGrades[shape],
    position: { ...position },
    rotation: ((rotation % 4) + 4) % 4,
  };
  state.buffers[shape] -= 1;
  state.nextBlockSeq += 1;
  state.recentFieldBlockId = blockId;
  state.selectedEngineId = null;
  refreshFieldPattern(state, blockId);
  return { success: true, blockId };
}

export function moveBlock(state: GameState, blockId: string, newPosition: Position): { success: boolean; error?: string } {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose') return { success: false, error: 'Block is not Loose.' };
  const validation = validateStatePlacement(
    state,
    getBlockOccupiedCells(block.shape, newPosition, block.rotation),
    blockId,
  );
  if (!validation.valid) {
    return { success: false, error: placementError(validation.violation) };
  }
  block.position = { ...newPosition };
  state.selectedBlockIds.includes(blockId) ? analyzeSelection(state) : refreshFieldPattern(state, blockId);
  return { success: true };
}

export function rotateBlock(state: GameState, blockId: string): { success: boolean; newRotation?: number; error?: string } {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose' || !block.position) return { success: false, error: 'Block is not editable.' };
  const nextRotation = (block.rotation + 1) % 4;
  const validation = validateStatePlacement(
    state,
    getBlockOccupiedCells(block.shape, block.position, nextRotation),
    blockId,
  );
  if (!validation.valid) {
    return { success: false, error: placementError(validation.violation) };
  }
  block.rotation = nextRotation;
  state.selectedBlockIds.includes(blockId) ? analyzeSelection(state) : refreshFieldPattern(state, blockId);
  return { success: true, newRotation: nextRotation };
}

export function returnBlockToBuffer(state: GameState, blockId: string): { success: boolean; error?: string } {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose') return { success: false, error: 'Only Loose Blocks can Return.' };
  if (isStockFull(state.buffers, STOCK_CAPACITY)) {
    return { success: false, error: 'STOCK FULL — RETURN FAILED.' };
  }

  delete state.blocks[blockId];
  state.buffers[block.shape] += 1;
  state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== blockId);
  if (state.recentFieldBlockId === blockId) state.recentFieldBlockId = null;
  state.selectedBlockIds.length > 0 ? analyzeSelection(state) : refreshFieldPattern(state);
  return { success: true };
}

export function selectBlock(state: GameState, blockId: string, toggle: boolean = false): void {
  const block = state.blocks[blockId];
  if (!block || block.state !== 'Loose') return;
  state.selectedEngineId = null;
  if (toggle) {
    state.selectedBlockIds = state.selectedBlockIds.includes(blockId)
      ? state.selectedBlockIds.filter(id => id !== blockId)
      : [...state.selectedBlockIds, blockId];
  } else {
    state.selectedBlockIds = [blockId];
  }
  analyzeSelection(state);
}

export function selectLooseBlocks(state: GameState, blockIds: readonly string[], additive: boolean = false): void {
  const validIds = blockIds.filter(id => state.blocks[id]?.state === 'Loose');
  state.selectedEngineId = null;
  state.selectedBlockIds = additive
    ? [...new Set([...state.selectedBlockIds, ...validIds])]
    : [...new Set(validIds)];
  analyzeSelection(state);
}

export interface GridSelectionRect { minX: number; maxX: number; minY: number; maxY: number }

export function getLooseBlockIdsIntersectingRect(state: GameState, rect: GridSelectionRect): string[] {
  return getLooseBlocksList(state)
    .filter(block => blockCells(block).some(cell =>
      cell.x >= rect.minX && cell.x <= rect.maxX && cell.y >= rect.minY && cell.y <= rect.maxY,
    ))
    .map(block => block.id);
}

export function selectAllLooseBlocks(state: GameState): void {
  selectLooseBlocks(state, getLooseBlocksList(state).map(block => block.id));
}

export function clearSelection(state: GameState): void {
  state.selectedBlockIds = [];
  state.lastAnalysis = null;
  refreshFieldPattern(state);
}

export function selectEngine(state: GameState, engineId: string | null): void {
  state.selectedEngineId = engineId && state.engines[engineId] ? engineId : null;
  state.selectedBlockIds = [];
  state.lastAnalysis = null;
  refreshFieldPattern(state);
}

export function getEngineIdForBlock(state: GameState, blockId: string): string | null {
  return Object.values(state.engines).find(engine => engine.constituentBlockIds.includes(blockId))?.id ?? null;
}

export function analyzeSelection(state: GameState): GameState {
  const selectedBlocks = state.selectedBlockIds
    .map(id => state.blocks[id])
    .filter((block): block is Block => Boolean(block) && block.state === 'Loose');
  if (selectedBlocks.length === 0) {
    state.lastAnalysis = null;
    refreshFieldPattern(state);
    return state;
  }
  const analysis = evaluatePattern(selectedBlocks);
  state.lastAnalysis = analysis;
  state.fieldAnalysis = analysis;
  state.fieldCandidateBlockIds = selectedBlocks.map(block => block.id);
  if (analysis.isValid && analysis.patternId !== 'none' && !state.discoveredPatterns.includes(analysis.patternId)) {
    state.discoveredPatterns.push(analysis.patternId);
  }
  return state;
}

export interface PatternActionPreview {
  blockIds: string[];
  blocks: Block[];
  analysis: ReturnType<typeof evaluatePattern> | null;
  source: 'explicit' | 'field' | 'none';
  canBind: boolean;
}

export interface FrontierSealPreview {
  blockIds: string[];
  blocks: Block[];
  geometry: FrontierSealGeometryResult;
  target: FrontierTargetValidation;
  targetChunkId: string | null;
  targetOptions: string[];
  validGeometry: boolean;
  hasCore: boolean;
  hasShards: boolean;
  canActivate: boolean;
  error?: string;
}

function exactLooseBlocks(state: GameState, blockIds: readonly string[]): Block[] | null {
  if (blockIds.length === 0 || new Set(blockIds).size !== blockIds.length) return null;
  const blocks = blockIds.map(id => state.blocks[id]);
  return blocks.some(block => !block || block.state !== 'Loose' || block.position === null) ? null : blocks as Block[];
}

function previewForIds(state: GameState, blockIds: readonly string[], source: PatternActionPreview['source']): PatternActionPreview {
  const blocks = exactLooseBlocks(state, blockIds) || [];
  if (blocks.length === 0) {
    return { blockIds: [], blocks, analysis: null, source, canBind: false };
  }
  const analysis = evaluatePattern(blocks);
  const isOrdinaryRecipe = analysis.isValid && BINDABLE_RECIPE_IDS.has(analysis.patternId);
  const isHeart = analysis.isValid && analysis.patternId === 'heart_seal' && !state.isHeartEngineBound;
  const fieldLegal = isPatternFieldLegal(state, blocks);
  return {
    blockIds: blocks.map(block => block.id),
    blocks,
    analysis,
    source,
    canBind: fieldLegal && (isHeart || (state.isHeartEngineBound && isOrdinaryRecipe)),
  };
}

export function getPatternActionPreview(state: GameState, blockIds?: readonly string[]): PatternActionPreview {
  if (blockIds) return previewForIds(state, blockIds, 'explicit');
  if (state.selectedBlockIds.length > 0) return previewForIds(state, state.selectedBlockIds, 'explicit');
  if (state.fieldCandidateBlockIds.length > 0) return previewForIds(state, state.fieldCandidateBlockIds, 'field');
  return previewForIds(state, [], 'none');
}

function frontierCandidateBlocks(state: GameState, blockIds?: readonly string[]): Block[] {
  const ids = blockIds
    ? [...blockIds]
    : state.selectedBlockIds.length > 0
      ? [...state.selectedBlockIds]
      : [...state.fieldCandidateBlockIds];
  return exactLooseBlocks(state, ids) || [];
}

/** Read-only Frontier Seal and target preview used by both UI and activation. */
export function getFrontierSealPreview(
  state: GameState,
  blockIds?: readonly string[],
  targetChunkId?: string | null,
): FrontierSealPreview {
  const blocks = frontierCandidateBlocks(state, blockIds);
  const geometry = analyzeFrontierSeal(blocks);
  const unlockedChunks = getStateUnlockedChunks(state);
  const selectedTarget = targetChunkId === undefined ? state.selectedFrontierChunkId : targetChunkId;
  const target = validateFrontierSeal(blocks, unlockedChunks, selectedTarget).target;
  const fieldLegal = blocks.length > 0 && isPatternFieldLegal(state, blocks);
  const validGeometry = geometry.valid && fieldLegal;
  const adjacentTargets = getAdjacentLockedChunkIds(unlockedChunks);
  const targetOptions = validGeometry
    ? adjacentTargets.filter(chunkId => validateFrontierTarget(geometry.cells, unlockedChunks, chunkId).valid)
    : adjacentTargets;
  const hasCore = state.currencies.cores >= 1;
  const hasShards = state.currencies.shards >= 12;
  const canActivate = validGeometry && target.valid && hasCore && hasShards;

  let error: string | undefined;
  if (!geometry.valid) error = geometry.reason;
  else if (!fieldLegal) error = 'Frontier Seal overlaps another Block or crosses locked Field cells.';
  else if (!target.valid) error = target.reason;
  else if (!hasCore) error = 'Need 1 Core to activate the Frontier Seal.';
  else if (!hasShards) error = 'Need 12 Shards to activate the Frontier Seal.';

  return {
    blockIds: blocks.map(block => block.id),
    blocks,
    geometry,
    target,
    targetChunkId: selectedTarget,
    targetOptions,
    validGeometry,
    hasCore,
    hasShards,
    canActivate,
    error,
  };
}

export function selectFrontierTarget(
  state: GameState,
  targetChunkId: string | null,
): { success: boolean; targetChunkId?: string | null; error?: string } {
  if (targetChunkId === null) {
    state.selectedFrontierChunkId = null;
    return { success: true, targetChunkId: null };
  }
  if (!getAdjacentLockedChunkIds(getStateUnlockedChunks(state)).includes(targetChunkId)) {
    return { success: false, error: 'Target must be a locked chunk sharing a full side with the Field.' };
  }
  const preview = getFrontierSealPreview(state, undefined, targetChunkId);
  if (preview.validGeometry && !preview.target.valid) {
    return { success: false, error: preview.target.reason || 'Target does not contact the current Frontier Seal.' };
  }
  state.selectedFrontierChunkId = targetChunkId;
  state.selectedEngineId = null;
  return { success: true, targetChunkId };
}

export interface FrontierSealActivationResult {
  success: boolean;
  targetChunkId?: string;
  blockIds?: string[];
  error?: string;
}

/**
 * Atomic Frontier Seal transaction. Every read-only check happens before the
 * first mutation so failed activation cannot spend a resource or consume a
 * contributing Block.
 */
export function activateFrontierSeal(
  state: GameState,
  targetChunkId?: string | null,
): FrontierSealActivationResult {
  const initial = getFrontierSealPreview(state, undefined, targetChunkId);
  if (!initial.geometry.valid) return { success: false, error: initial.geometry.reason };

  const frozenIds = [...initial.blockIds];
  const frozenTarget = initial.targetChunkId;
  const blocks = exactLooseBlocks(state, frozenIds);
  if (!blocks) return { success: false, error: 'Frontier Seal changed before activation.' };

  // Re-run the exact checks against the frozen IDs and selected target. The
  // ordinary field legality check includes external Loose and Bound cells.
  const geometry = analyzeFrontierSeal(blocks);
  if (!geometry.valid) return { success: false, error: geometry.reason };
  if (!isPatternFieldLegal(state, blocks)) {
    return { success: false, error: 'Frontier Seal crosses locked or occupied Field cells.' };
  }
  const validation = validateFrontierSeal(blocks, getStateUnlockedChunks(state), frozenTarget);
  if (!validation.target.valid) return { success: false, error: validation.target.reason };
  if (state.currencies.cores < 1) return { success: false, error: 'Need 1 Core to activate the Frontier Seal.' };
  if (state.currencies.shards < 12) return { success: false, error: 'Need 12 Shards to activate the Frontier Seal.' };
  if (!frozenTarget || state.unlockedChunks.includes(frozenTarget)) {
    return { success: false, error: 'Selected frontier target is no longer locked.' };
  }

  // Commit only after all exact checks pass.
  for (const blockId of frozenIds) delete state.blocks[blockId];
  state.currencies.cores -= 1;
  state.currencies.shards -= 12;
  state.unlockedChunks = [...state.unlockedChunks, frozenTarget];
  state.selectedBlockIds = state.selectedBlockIds.filter(id => !frozenIds.includes(id));
  state.selectedFrontierChunkId = null;
  state.selectedEngineId = null;
  state.fieldAnalysis = null;
  state.fieldCandidateBlockIds = [];
  state.recentFieldBlockId = null;
  refreshFieldPattern(state);
  advanceDirectiveProgress(state, { frontierChunkId: frozenTarget });

  return { success: true, targetChunkId: frozenTarget, blockIds: frozenIds };
}

function createBoundEngine(
  state: GameState,
  preview: PatternActionPreview,
  foundational: boolean,
): EngineState {
  const id = foundational ? 'engine-heart' : `engine-${state.nextEngineSeq++}`;
  return {
    id,
    name: foundational ? 'Heart Engine' : `${preview.analysis!.patternName} Engine`,
    sourcePatternId: preview.analysis!.patternId,
    sourcePatternName: preview.analysis!.patternName,
    foundational,
    submittable: !foundational,
    quality: preview.analysis!.quality,
    boundValue: calculateBoundValue(preview.blocks),
    accumulatedTimeSec: 0,
    constituentBlockIds: [...preview.blockIds],
    ...createProductionBag(stableEngineSeed(id)),
  };
}

export function bindPattern(state: GameState): { success: boolean; engine?: EngineState; error?: string } {
  const initial = getPatternActionPreview(state);
  if (!initial.canBind || !initial.analysis) return { success: false, error: 'Current Pattern cannot be Bound.' };
  const frozenIds = [...initial.blockIds];
  const preview = getPatternActionPreview(state, frozenIds);
  if (!preview.canBind || !preview.analysis) return { success: false, error: 'Pattern changed before Bind.' };
  if (!isPatternFieldLegal(state, preview.blocks)) return { success: false, error: 'Pattern crosses locked or occupied Field cells.' };

  const foundational = preview.analysis.patternId === 'heart_seal';
  if (foundational && state.isHeartEngineBound) return { success: false, error: 'Heart Engine already exists.' };
  for (const block of preview.blocks) block.state = 'Bound';
  const engine = createBoundEngine(state, preview, foundational);
  state.engines[engine.id] = engine;
  if (foundational) {
    state.heartEngineId = engine.id;
    state.isHeartEngineBound = true;
  }
  state.learnedActions.bind = true;
  state.selectedEngineId = engine.id;
  clearSelection(state);
  state.fieldAnalysis = null;
  state.fieldCandidateBlockIds = [];
  state.recentFieldBlockId = null;
  advanceDirectiveProgress(state, { boundEngineId: engine.id });
  return { success: true, engine };
}

export function bindHeartSeal(state: GameState): { success: boolean; engine?: EngineState; error?: string } {
  const preview = getPatternActionPreview(state);
  if (preview.analysis?.patternId !== 'heart_seal') return { success: false, error: 'Heart Seal is incomplete.' };
  return bindPattern(state);
}

export interface EngineSubmissionPreview {
  engine: EngineState;
  blocks: Block[];
  shards: number;
  canSubmit: boolean;
  error?: string;
}

export function getEngineSubmissionPreview(state: GameState, engineId: string): EngineSubmissionPreview | null {
  const engine = state.engines[engineId];
  if (!engine) return null;
  const blocks = engine.constituentBlockIds.map(id => state.blocks[id]).filter((block): block is Block => Boolean(block));
  const intact = blocks.length === engine.constituentBlockIds.length && blocks.every(block => block.state === 'Bound');
  return {
    engine,
    blocks,
    shards: intact ? calculateEngineSubmissionShards(blocks, engine.quality) : 0,
    canSubmit: engine.submittable && intact,
    error: !engine.submittable ? 'Heart Engine is foundational.' : !intact ? 'Engine constituents are no longer intact.' : undefined,
  };
}

export function submitEngine(state: GameState, engineId: string): { success: boolean; shards?: number; error?: string } {
  const initial = getEngineSubmissionPreview(state, engineId);
  if (!initial?.canSubmit) return { success: false, error: initial?.error || 'Engine not found.' };
  const frozenEngineId = initial.engine.id;
  const frozenIds = [...initial.engine.constituentBlockIds];
  const engine = state.engines[frozenEngineId];
  const exactIdsMatch = Boolean(engine)
    && engine.constituentBlockIds.length === frozenIds.length
    && frozenIds.every((id, index) => engine.constituentBlockIds[index] === id);
  const blocks = frozenIds.map(id => state.blocks[id]);
  const intact = exactIdsMatch && blocks.every((block): block is Block => Boolean(block) && block.state === 'Bound');
  if (!engine || !engine.submittable || !intact) {
    return { success: false, error: 'Engine changed before Submit.' };
  }
  const shards = calculateEngineSubmissionShards(blocks as Block[], engine.quality);
  for (const blockId of frozenIds) delete state.blocks[blockId];
  delete state.engines[frozenEngineId];
  state.currencies.shards += shards;
  state.learnedActions.submit = true;
  if (state.selectedEngineId === frozenEngineId) state.selectedEngineId = null;
  refreshFieldPattern(state);
  advanceDirectiveProgress(state);
  return { success: true, shards };
}

export function upgradeShapeGrade(state: GameState, shape: ShapeType): { success: boolean; grade?: number; cost?: number; error?: string } {
  const currentGrade = state.shapeGrades[shape];
  const cost = getShapeGradeUpgradeCost(currentGrade);
  if (state.currencies.shards < cost) return { success: false, cost, error: `Need ${cost} Shards.` };
  const grade = currentGrade + 1;
  state.currencies.shards -= cost;
  state.shapeGrades[shape] = grade;
  for (const block of Object.values(state.blocks)) {
    if (block.state === 'Loose' && block.shape === shape) block.grade = grade;
  }
  state.learnedActions.upgrade = true;
  advanceDirectiveProgress(state);
  return { success: true, grade, cost };
}

export interface EngineProductionOutput { engineId: string; shape: ShapeType }

export function advanceProductionTime(
  state: GameState,
  deltaSeconds: number,
): {
  generatedShapes: ShapeType[];
  outputs: EngineProductionOutput[];
  /** True when subscribers need a current-state/UI update. */
  changed: boolean;
  /** True only when the update should write through the persistence boundary. */
  requiresPersistence: boolean;
} {
  const outputs: EngineProductionOutput[] = [];
  const poweredEngineIds = derivePoweredEngineIds(state.engines, state.blocks, state.heartEngineId);
  const engineIds = Object.keys(state.engines).sort();
  const poweredIds = engineIds.filter(engineId => poweredEngineIds.has(engineId));
  const intervals = new Map<string, number>();
  let buffers = { ...state.buffers };
  let remainingSeconds = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  let changed = false;
  let requiresPersistence = false;

  // Normalize persisted bag pairs before the synchronized clock walk. Power
  // is already derived above, so an unpowered Engine remains completely idle.
  for (const engineId of poweredIds) {
    const sourceEngine = state.engines[engineId];
    const normalized = normalizeEngineProduction(sourceEngine);
    const productionPairChanged = sourceEngine.nextShape !== normalized.nextShape
      || sourceEngine.productionBag.length !== normalized.productionBag.length
      || sourceEngine.productionBag.some((shape, index) => shape !== normalized.productionBag[index]);
    if (productionPairChanged) {
      state.engines[engineId] = normalized;
      changed = true;
      requiresPersistence = true;
    }
    intervals.set(engineId, getProductionIntervalSec(normalized, DEFAULT_BASE_PRODUCTION_RATE));
  }

  // At full Stock, no elapsed time is applied. Preserve an existing partial or
  // single ready interval, but discard any malformed multi-interval backlog.
  if (isStockFull(buffers, STOCK_CAPACITY)) {
    for (const engineId of poweredIds) {
      const engine = state.engines[engineId];
      const interval = intervals.get(engineId)!;
      const preserved = Math.min(Math.max(0, engine.accumulatedTimeSec), interval);
      if (preserved !== engine.accumulatedTimeSec) {
        state.engines[engineId] = { ...engine, accumulatedTimeSec: preserved };
        changed = true;
      }
    }
    state.buffers = buffers;
    return { generatedShapes: [], outputs, changed, requiresPersistence };
  }

  // All powered clocks advance together until the next completion event. At
  // that event, ready outputs are committed in stable Engine-ID order. This
  // makes a large tick equivalent to its smaller subdivisions while retaining
  // deterministic capacity contention.
  while (!isStockFull(buffers, STOCK_CAPACITY)) {
    const readyIds = poweredIds.filter(engineId => {
      const engine = state.engines[engineId];
      return engine.accumulatedTimeSec + 1e-9 >= intervals.get(engineId)!;
    });

    if (readyIds.length === 0) {
      if (remainingSeconds <= 1e-9 || poweredIds.length === 0) break;
      let stepSeconds = remainingSeconds;
      for (const engineId of poweredIds) {
        const engine = state.engines[engineId];
        const interval = intervals.get(engineId)!;
        stepSeconds = Math.min(stepSeconds, Math.max(0, interval - engine.accumulatedTimeSec));
      }
      if (stepSeconds <= 1e-9) continue;
      for (const engineId of poweredIds) {
        const engine = state.engines[engineId];
        state.engines[engineId] = {
          ...engine,
          accumulatedTimeSec: engine.accumulatedTimeSec + stepSeconds,
        };
      }
      changed = true;
      remainingSeconds = Math.max(0, remainingSeconds - stepSeconds);
      continue;
    }

    for (const engineId of readyIds) {
      let engine = state.engines[engineId];
      const interval = intervals.get(engineId)!;
      while (engine.accumulatedTimeSec + 1e-9 >= interval && !isStockFull(buffers, STOCK_CAPACITY)) {
        const output = advanceEngineShape(engine);
        buffers[output.shape] += 1;
        outputs.push({ engineId, shape: output.shape });
        engine = {
          ...output.engine,
          accumulatedTimeSec: Math.max(0, engine.accumulatedTimeSec - interval),
        };
        changed = true;
        requiresPersistence = true;
      }

      if (isStockFull(buffers, STOCK_CAPACITY)) {
        // Any remainder after the output that filled Stock belongs to blocked
        // time. Preserve only progress that existed at that exact event.
        engine = {
          ...engine,
          accumulatedTimeSec: Math.min(Math.max(0, engine.accumulatedTimeSec), interval),
        };
        state.engines[engineId] = engine;
        break;
      }
      state.engines[engineId] = engine;
    }
  }

  state.buffers = buffers;
  if (outputs.length > 0) {
    const directiveResult = advanceDirectiveProgress(state, { productionOutputs: outputs });
    if (directiveResult.changed) {
      changed = true;
      requiresPersistence = true;
    }
  }
  return {
    generatedShapes: outputs.map(output => output.shape),
    outputs,
    changed,
    requiresPersistence,
  };
}
