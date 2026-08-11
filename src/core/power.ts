/**
 * Derived Heart-rooted Power topology for Rune Foundry.
 *
 * Power is intentionally not stored on EngineState. The current Bound cell
 * geometry is the source of truth, so Bind, Submit, and save/load all use the
 * same deterministic reachability calculation.
 */

import { Block, EngineState, Position } from './types.ts';
import { coordKey } from './field.ts';
import { getBlockOccupiedCells } from './shapes.ts';

export type EnginePowerState = 'Powered' | 'Unpowered';

type EngineRecord = Readonly<Record<string, EngineState>>;
type BlockRecord = Readonly<Record<string, Block>>;

/** Returns the cells currently contributed by Bound constituent Blocks. */
export function getBoundEngineCells(
  engine: EngineState,
  blocks: BlockRecord,
): Position[] {
  const cells: Position[] = [];
  for (const blockId of engine.constituentBlockIds) {
    const block = blocks[blockId];
    if (!block || block.state !== 'Bound' || !block.position) continue;
    cells.push(...getBlockOccupiedCells(block.shape, block.position, block.rotation));
  }
  return cells;
}

function findHeartEngineId(
  engines: EngineRecord,
  heartEngineId: string | null,
): string | null {
  const explicit = heartEngineId ? engines[heartEngineId] : undefined;
  if (explicit?.foundational) return explicit.id;
  const foundational = Object.values(engines).find(engine => engine.foundational);
  return foundational?.id ?? (explicit ? explicit.id : null);
}

/**
 * Derives the Engine-level adjacency graph from orthogonal Bound-cell
 * contacts. Loose Blocks, empty cells, and diagonal contacts never enter the
 * graph. Once one cell of an Engine is reached, all of that Engine's Bound
 * cells relay Power onward as one Engine node.
 */
export function derivePowerNetwork(
  engines: EngineRecord,
  blocks: BlockRecord,
  heartEngineId: string | null = null,
): { poweredEngineIds: Set<string>; connections: Map<string, Set<string>> } {
  const cellOwners = new Map<string, Set<string>>();

  for (const engine of Object.values(engines)) {
    const cells = getBoundEngineCells(engine, blocks);
    for (const cell of cells) {
      const key = coordKey(cell.x, cell.y);
      const owners = cellOwners.get(key) || new Set<string>();
      owners.add(engine.id);
      cellOwners.set(key, owners);
    }
  }

  const connections = new Map<string, Set<string>>();
  for (const engine of Object.values(engines)) connections.set(engine.id, new Set<string>());

  for (const [key, owners] of cellOwners.entries()) {
    const [x, y] = key.split(',').map(Number);
    const neighborKeys = [
      coordKey(x + 1, y),
      coordKey(x - 1, y),
      coordKey(x, y + 1),
      coordKey(x, y - 1),
    ];

    for (const neighborKey of neighborKeys) {
      const neighborOwners = cellOwners.get(neighborKey);
      if (!neighborOwners) continue;
      for (const leftId of owners) {
        for (const rightId of neighborOwners) {
          if (leftId === rightId) continue;
          connections.get(leftId)?.add(rightId);
        }
      }
    }
  }

  const poweredEngineIds = new Set<string>();
  const rootId = findHeartEngineId(engines, heartEngineId);
  if (!rootId) return { poweredEngineIds, connections };

  // The Heart is the root even if a malformed/partial save temporarily lacks
  // its constituent geometry. It simply cannot relay until cells are present.
  poweredEngineIds.add(rootId);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const connectedId of connections.get(currentId) || []) {
      if (poweredEngineIds.has(connectedId)) continue;
      poweredEngineIds.add(connectedId);
      queue.push(connectedId);
    }
  }

  return { poweredEngineIds, connections };
}

export function derivePoweredEngineIds(
  engines: EngineRecord,
  blocks: BlockRecord,
  heartEngineId: string | null = null,
): Set<string> {
  return derivePowerNetwork(engines, blocks, heartEngineId).poweredEngineIds;
}

/** Readable alias for presentation/application callers. */
export function getPoweredEngineIds(
  engines: EngineRecord,
  blocks: BlockRecord,
  heartEngineId: string | null = null,
): Set<string> {
  return derivePoweredEngineIds(engines, blocks, heartEngineId);
}

export function isEnginePowered(
  engineId: string,
  engines: EngineRecord,
  blocks: BlockRecord,
  heartEngineId: string | null = null,
): boolean {
  return derivePoweredEngineIds(engines, blocks, heartEngineId).has(engineId);
}

export function getEnginePowerState(
  engineId: string,
  engines: EngineRecord,
  blocks: BlockRecord,
  heartEngineId: string | null = null,
): EnginePowerState {
  return isEnginePowered(engineId, engines, blocks, heartEngineId) ? 'Powered' : 'Unpowered';
}
