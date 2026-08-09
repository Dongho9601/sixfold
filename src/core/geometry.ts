/**
 * Pure geometry resolver for HL;BM — Rune Foundry.
 * Evaluates spatial arrangements of selected Loose Blocks.
 */

import { Block, PatternAnalysisResult, Position } from './types.ts';
import { getBlockOccupiedCells } from './shapes.ts';
import { coordKey, isCradleCell } from './field.ts';

export interface ConnectedComponent {
  id: number;
  blockIds: string[];
  cells: Position[];
}

export function findConnectedComponents(selectedBlocks: Block[]): ConnectedComponent[] {
  if (selectedBlocks.length === 0) return [];

  // Map cell key to { cell, blockId }
  const cellMap = new Map<string, { pos: Position; blockId: string }>();
  for (const block of selectedBlocks) {
    if (block.state !== 'Loose' || !block.position) continue;
    const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
    for (const cell of cells) {
      cellMap.set(coordKey(cell.x, cell.y), { pos: cell, blockId: block.id });
    }
  }

  const visited = new Set<string>();
  const components: ConnectedComponent[] = [];
  let componentId = 0;

  for (const key of cellMap.keys()) {
    if (visited.has(key)) continue;

    componentId++;
    const componentCells: Position[] = [];
    const componentBlockIds = new Set<string>();
    const queue: string[] = [key];
    visited.add(key);

    while (queue.length > 0) {
      const currKey = queue.shift()!;
      const curr = cellMap.get(currKey)!;
      componentCells.push(curr.pos);
      componentBlockIds.add(curr.blockId);

      const neighbors = [
        coordKey(curr.pos.x + 1, curr.pos.y),
        coordKey(curr.pos.x - 1, curr.pos.y),
        coordKey(curr.pos.x, curr.pos.y + 1),
        coordKey(curr.pos.x, curr.pos.y - 1),
      ];

      for (const nKey of neighbors) {
        if (cellMap.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          queue.push(nKey);
        }
      }
    }

    components.push({
      id: componentId,
      blockIds: Array.from(componentBlockIds),
      cells: componentCells,
    });
  }

  return components;
}

export function calculateInterBlockSharedEdges(selectedBlocks: Block[]): number {
  const cellMap = new Map<string, string>(); // key -> blockId
  for (const block of selectedBlocks) {
    if (block.state !== 'Loose' || !block.position) continue;
    const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
    for (const cell of cells) {
      cellMap.set(coordKey(cell.x, cell.y), block.id);
    }
  }

  let edgeCount = 0;
  for (const [key, blockId] of cellMap.entries()) {
    const parts = key.split(',').map(Number);
    const x = parts[0];
    const y = parts[1];

    const neighbors = [
      coordKey(x + 1, y),
      coordKey(x - 1, y),
      coordKey(x, y + 1),
      coordKey(x, y - 1),
    ];

    for (const nKey of neighbors) {
      const neighborBlockId = cellMap.get(nKey);
      if (neighborBlockId && neighborBlockId !== blockId) {
        edgeCount++;
      }
    }
  }

  // Each edge counted twice
  return edgeCount / 2;
}

export function evaluatePattern(selectedBlocks: Block[]): PatternAnalysisResult {
  const looseBlocks = selectedBlocks.filter(b => b.state === 'Loose' && b.position !== null);

  if (looseBlocks.length === 0) {
    return {
      patternId: 'none',
      patternName: 'No Selection',
      isValid: false,
      quality: 0,
      metrics: { blockCount: 0, cellCount: 0, componentCount: 0 },
      nearMatchReason: 'Select Loose Blocks on the Field to Analyze.',
    };
  }

  // Calculate cell count & positions
  const allCells: Position[] = [];
  for (const b of looseBlocks) {
    allCells.push(...getBlockOccupiedCells(b.shape, b.position!, b.rotation));
  }

  const components = findConnectedComponents(looseBlocks);
  const blockCount = looseBlocks.length;
  const cellCount = allCells.length;
  const componentCount = components.length;

  // 1. Test Heart Seal: All 16 Cradle cells filled, 0 outside
  const cradleCellsCount = allCells.filter(c => isCradleCell(c.x, c.y)).length;
  const outsideCradleCount = cellCount - cradleCellsCount;

  if (cradleCellsCount > 0) {
    const isExactCradleFill = cradleCellsCount === 16 && cellCount === 16 && outsideCradleCount === 0;
    if (isExactCradleFill) {
      return {
        patternId: 'heart_seal',
        patternName: 'Heart Seal',
        isValid: true,
        quality: 1.0,
        metrics: { blockCount, cellCount, componentCount, isCradleFilled: true },
      };
    }
    // Partial cradle near-match clue
    if (cradleCellsCount < 16 && outsideCradleCount === 0) {
      return {
        patternId: 'heart_seal',
        patternName: 'Heart Seal',
        isValid: false,
        quality: cradleCellsCount / 16,
        metrics: { blockCount, cellCount, componentCount },
        nearMatchReason: `Heart Seal requires all 16 cells of the 4x4 Cradle filled (currently ${cradleCellsCount}/16).`,
      };
    }
  }

  // 2. Test Twin Stars: Exactly 2 disconnected components with equal block count
  if (componentCount === 2) {
    const comp1 = components[0];
    const comp2 = components[1];
    if (comp1.blockIds.length === comp2.blockIds.length) {
      // Calculate centroid distance
      const c1x = comp1.cells.reduce((s, c) => s + c.x, 0) / comp1.cells.length;
      const c1y = comp1.cells.reduce((s, c) => s + c.y, 0) / comp1.cells.length;
      const c2x = comp2.cells.reduce((s, c) => s + c.x, 0) / comp2.cells.length;
      const c2y = comp2.cells.reduce((s, c) => s + c.y, 0) / comp2.cells.length;

      const sep = Math.sqrt(Math.pow(c1x - c2x, 2) + Math.pow(c1y - c2y, 2));
      const targetSep = 4.0;
      const quality = Math.min(1.0, Math.max(0.5, 1.0 - Math.abs(sep - targetSep) / 8.0));

      return {
        patternId: 'twin_stars',
        patternName: 'Twin Stars',
        isValid: true,
        quality,
        metrics: { blockCount, cellCount, componentCount, separation: sep },
      };
    } else {
      return {
        patternId: 'twin_stars',
        patternName: 'Twin Stars',
        isValid: false,
        quality: 0.5,
        metrics: { blockCount, cellCount, componentCount },
        nearMatchReason: `Both stars must contain the same number of Blocks (${comp1.blockIds.length} vs ${comp2.blockIds.length}).`,
      };
    }
  } else if (componentCount > 2) {
    return {
      patternId: 'twin_stars',
      patternName: 'Twin Stars',
      isValid: false,
      quality: 0.3,
      metrics: { blockCount, cellCount, componentCount },
      nearMatchReason: `Twin Stars requires exactly two components (found ${componentCount}).`,
    };
  }

  // 3. Test Compression Press: Single connected component, at least 2 blocks
  if (componentCount === 1) {
    if (blockCount < 2) {
      return {
        patternId: 'compression_press',
        patternName: 'Compression Press',
        isValid: false,
        quality: 0.4,
        metrics: { blockCount, cellCount, componentCount },
        nearMatchReason: 'Compression Press requires at least 2 connected Loose Blocks.',
      };
    }

    const sharedEdges = calculateInterBlockSharedEdges(looseBlocks);
    const maxSharedEdges = blockCount * 2;
    const cohesion = Math.min(1.0, sharedEdges / maxSharedEdges);
    const quality = Math.min(1.0, Math.max(0.5, 0.5 + cohesion * 0.5));

    return {
      patternId: 'compression_press',
      patternName: 'Compression Press',
      isValid: true,
      quality,
      metrics: { blockCount, cellCount, componentCount, cohesion },
    };
  }

  return {
    patternId: 'none',
    patternName: 'Unknown Pattern',
    isValid: false,
    quality: 0,
    metrics: { blockCount, cellCount, componentCount },
    nearMatchReason: 'Requires one connected component or two equal twin components.',
  };
}
