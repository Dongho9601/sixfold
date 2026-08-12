/**
 * Pure Frontier Seal geometry and target-chunk validation.
 *
 * The recipe is intentionally expressed in terms of occupied cells rather
 * than authored world coordinates. The normalized vertical form is a filled
 * 2x8 rectangle made from four real vertical I Blocks; the horizontal form is
 * its 90-degree rotation.
 */

import {
  areCellsUnlocked,
  coordKey,
  getAdjacentLockedChunkIds,
  getChunkCells,
  getUnlockedCellKeys,
  isCellInChunk,
  isCoordKey,
  parseCoordKey,
} from './field.ts';
import { getBlockBounds, getBlockOccupiedCells } from './shapes.ts';
import { Block, Position } from './types.ts';

export interface FrontierSealGeometryResult {
  valid: boolean;
  blockIds: string[];
  cells: Position[];
  orientation: 'vertical' | 'horizontal' | null;
  reason?: string;
}

export interface FrontierContact {
  sealCell: Position;
  targetCell: Position;
}

export interface FrontierTargetValidation {
  valid: boolean;
  targetChunkId: string | null;
  contactCount: number;
  contacts: FrontierContact[];
  reason?: string;
}

export interface FrontierSealValidation extends FrontierSealGeometryResult {
  target: FrontierTargetValidation;
  validTarget: boolean;
}

function sortCells(cells: Iterable<Position>): Position[] {
  return [...cells].sort((left, right) => left.y - right.y || left.x - right.x);
}

function invalidGeometry(blockIds: string[], cells: Position[], reason: string): FrontierSealGeometryResult {
  return { valid: false, blockIds, cells: sortCells(cells), orientation: null, reason };
}

/** Validates only the exact four-I 2x8 footprint, independent of the Field. */
export function analyzeFrontierSeal(blocks: readonly Block[]): FrontierSealGeometryResult {
  const blockIds = blocks.map(block => block.id);
  if (blocks.length !== 4) {
    return invalidGeometry(blockIds, [], `Frontier Seal requires exactly four I Blocks (found ${blocks.length}).`);
  }
  if (new Set(blockIds).size !== blockIds.length) {
    return invalidGeometry(blockIds, [], 'Frontier Seal requires four distinct Block IDs.');
  }

  if (blocks.some(block => block.state !== 'Loose' || !block.position)) {
    return invalidGeometry(blockIds, [], 'Frontier Seal requires four placed Loose I Blocks.');
  }
  if (blocks.some(block => block.shape !== 'I')) {
    return invalidGeometry(blockIds, [], 'Frontier Seal requires exactly four Loose I Blocks.');
  }

  const cells = blocks.flatMap(block => getBlockOccupiedCells(block.shape, block.position!, block.rotation));
  const uniqueCells = new Map<string, Position>();
  for (const cell of cells) uniqueCells.set(coordKey(cell.x, cell.y), cell);
  if (uniqueCells.size !== cells.length) {
    return invalidGeometry(blockIds, cells, 'Frontier Seal Blocks overlap; the 2×8 rectangle must be complete.');
  }

  const bounds = getBlockBounds(cells);
  const isVertical = bounds.width === 2 && bounds.height === 8;
  const isHorizontal = bounds.width === 8 && bounds.height === 2;
  if (!isVertical && !isHorizontal) {
    return invalidGeometry(blockIds, cells, 'Frontier Seal must be a complete 2×8 rectangle or its 90° rotation.');
  }

  const expectedCellCount = bounds.width * bounds.height;
  if (uniqueCells.size !== expectedCellCount) {
    return invalidGeometry(blockIds, cells, 'Frontier Seal has a gap; all cells of the 2×8 rectangle are required.');
  }

  const sortedCells = sortCells(uniqueCells.values());
  return {
    valid: true,
    blockIds,
    cells: sortedCells,
    orientation: isVertical ? 'vertical' : 'horizontal',
  };
}

function invalidTarget(targetChunkId: string | null, reason: string): FrontierTargetValidation {
  return { valid: false, targetChunkId, contactCount: 0, contacts: [], reason };
}

/** Validates a selected locked chunk and its direct contact with the Seal. */
export function validateFrontierTarget(
  sealCells: readonly Position[],
  unlockedChunkIds: Iterable<string>,
  targetChunkId: string | null | undefined,
): FrontierTargetValidation {
  const selectedTarget = typeof targetChunkId === 'string' ? targetChunkId : null;
  if (!selectedTarget) return invalidTarget(null, 'Select one adjacent locked 4×4 target chunk.');
  if (!isCoordKey(selectedTarget)) return invalidTarget(selectedTarget, 'Selected frontier target is not a valid chunk ID.');

  const unlockedIds = [...new Set(unlockedChunkIds)];
  const unlocked = new Set(unlockedIds);
  if (unlocked.has(selectedTarget)) return invalidTarget(selectedTarget, 'Selected frontier target is already unlocked.');

  const targetCells = getChunkCells(selectedTarget);
  const unlockedCellKeys = getUnlockedCellKeys(unlockedIds);
  if (targetCells.some(cell => unlockedCellKeys.has(coordKey(cell.x, cell.y)))) {
    return invalidTarget(selectedTarget, 'Selected frontier target overlaps unlocked Field cells.');
  }

  if (!getAdjacentLockedChunkIds(unlockedIds).includes(selectedTarget)) {
    return invalidTarget(selectedTarget, 'Target must share a full side with currently unlocked territory.');
  }

  if (!areCellsUnlocked(sealCells, unlockedIds)) {
    return invalidTarget(selectedTarget, 'Frontier Seal must be entirely inside unlocked Field cells.');
  }

  const targetKeys = new Set(targetCells.map(cell => coordKey(cell.x, cell.y)));
  const contacts: FrontierContact[] = [];
  for (const sealCell of sealCells) {
    const neighbors = [
      { x: sealCell.x + 1, y: sealCell.y },
      { x: sealCell.x - 1, y: sealCell.y },
      { x: sealCell.x, y: sealCell.y + 1 },
      { x: sealCell.x, y: sealCell.y - 1 },
    ];
    for (const targetCell of neighbors) {
      if (targetKeys.has(coordKey(targetCell.x, targetCell.y))) {
        contacts.push({ sealCell: { ...sealCell }, targetCell });
      }
    }
  }

  if (contacts.length < 4) {
    return {
      valid: false,
      targetChunkId: selectedTarget,
      contactCount: contacts.length,
      contacts,
      reason: `Frontier Seal needs at least four orthogonal contacts with ${selectedTarget} (found ${contacts.length}).`,
    };
  }

  return {
    valid: true,
    targetChunkId: selectedTarget,
    contactCount: contacts.length,
    contacts,
  };
}

/** Full geometry, unlocked-cell, selected-target, and contact validation. */
export function validateFrontierSeal(
  blocks: readonly Block[],
  unlockedChunkIds: Iterable<string>,
  targetChunkId: string | null | undefined,
): FrontierSealValidation {
  const geometry = analyzeFrontierSeal(blocks);
  const target = validateFrontierTarget(geometry.cells, unlockedChunkIds, targetChunkId);
  return {
    ...geometry,
    target,
    validTarget: target.valid,
    valid: geometry.valid && target.valid,
    reason: geometry.valid ? target.reason : geometry.reason,
  };
}

/** Small helper used by expanded-space Directive checks. */
export function areCellsInChunk(cells: readonly Position[], chunkId: string): boolean {
  return cells.every(cell => isCellInChunk(cell.x, cell.y, chunkId));
}

/** Returns the normalized origin of a chunk ID for callers that need stable display. */
export function getChunkOrigin(chunkId: string): Position {
  return parseCoordKey(chunkId);
}
