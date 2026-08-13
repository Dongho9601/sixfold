import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { placeBlockFromBuffer } from '../src/application/actions.ts';
import { getDirectHeartPoweredEngineIds, getStabilizeLinePairs } from '../src/application/directives.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';
import {
  coordKey,
  derivePoweredEngineIds,
  getBlockOccupiedCells,
  getChunkCells,
  getOpeningUnlockedCells,
  getProductionIntervalSec,
  getStockUsage,
  SHAPE_TYPES,
  ShapeType,
  STOCK_CAPACITY,
} from '../src/core/index.ts';
import type { Position } from '../src/core/types.ts';

type Placement = { shape: ShapeType; position: Position; rotation: number };
type CellSet = Set<string>;

interface PlanOptions {
  allowedCells?: CellSet;
  requiredAdjacentTo?: CellSet;
  forbiddenAdjacentTo?: CellSet;
  reservedCells?: CellSet;
  prefer?: Position;
  finalCheck?: (cells: CellSet) => boolean;
}

function cellsForBlock(placement: Placement): Position[] {
  return getBlockOccupiedCells(placement.shape, placement.position, placement.rotation);
}

function keysForCells(cells: readonly Position[]): CellSet {
  return new Set(cells.map(cell => coordKey(cell.x, cell.y)));
}

function cellSetForState(state: ReturnType<AppStore['getState']>): CellSet {
  const keys = new Set<string>();
  for (const block of Object.values(state.blocks)) {
    if ((block.state !== 'Loose' && block.state !== 'Bound') || !block.position) continue;
    for (const cell of getBlockOccupiedCells(block.shape, block.position, block.rotation)) {
      keys.add(coordKey(cell.x, cell.y));
    }
  }
  return keys;
}

function touches(cells: readonly Position[], target: CellSet): boolean {
  return cells.some(cell => [
    coordKey(cell.x + 1, cell.y),
    coordKey(cell.x - 1, cell.y),
    coordKey(cell.x, cell.y + 1),
    coordKey(cell.x, cell.y - 1),
  ].some(key => target.has(key)));
}

function containsAny(cells: readonly Position[], target: CellSet): boolean {
  return cells.some(cell => target.has(coordKey(cell.x, cell.y)));
}

function rectangleCells(minX: number, maxX: number, minY: number, maxY: number): CellSet {
  const cells = new Set<string>();
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) cells.add(coordKey(x, y));
  }
  return cells;
}

function sortedCandidates(shape: ShapeType, options: PlanOptions): Placement[] {
  const candidates: Placement[] = [];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    for (let y = -2; y <= 9; y += 1) {
      for (let x = -2; x <= 9; x += 1) {
        const placement = { shape, position: { x, y }, rotation };
        const cells = cellsForBlock(placement);
        if (options.allowedCells && !cells.every(cell => options.allowedCells!.has(coordKey(cell.x, cell.y)))) continue;
        if (options.reservedCells && containsAny(cells, options.reservedCells)) continue;
        if (options.requiredAdjacentTo && !touches(cells, options.requiredAdjacentTo)) continue;
        if (options.forbiddenAdjacentTo && touches(cells, options.forbiddenAdjacentTo)) continue;
        candidates.push(placement);
      }
    }
  }

  const preferred = options.prefer || { x: 0, y: 0 };
  candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.position.x - preferred.x) + Math.abs(left.position.y - preferred.y);
    const rightDistance = Math.abs(right.position.x - preferred.x) + Math.abs(right.position.y - preferred.y);
    return leftDistance - rightDistance
      || left.position.y - right.position.y
      || left.position.x - right.position.x
      || left.rotation - right.rotation;
  });
  return candidates;
}

/**
 * Plans a connected loose component without mutating the live store. The
 * returned positions are then committed through AppStore.placeBlock.
 */
function planConnectedBlocks(
  state: ReturnType<AppStore['getState']>,
  shapes: readonly ShapeType[],
  options: PlanOptions = {},
): Placement[] | null {
  const occupied = cellSetForState(state);
  const openingCells = keysForCells(getOpeningUnlockedCells());
  const allowedCells = options.allowedCells;

  function search(index: number, occupiedCells: CellSet, componentCells: CellSet, placements: Placement[]): Placement[] | null {
    if (index === shapes.length) return options.finalCheck?.(componentCells) === false ? null : placements;
    const requiredAdjacentTo = index === 0 ? options.requiredAdjacentTo : componentCells;
    const candidates = sortedCandidates(shapes[index], { ...options, requiredAdjacentTo });
    for (const candidate of candidates) {
      const cells = cellsForBlock(candidate);
      const cellKeys = keysForCells(cells);
      if (allowedCells
        ? !cells.every(cell => allowedCells.has(coordKey(cell.x, cell.y)))
        : !cells.every(cell => openingCells.has(coordKey(cell.x, cell.y)))) continue;
      if (containsAny(cells, occupiedCells)) continue;
      const nextOccupied = new Set([...occupiedCells, ...cellKeys]);
      const nextComponent = new Set([...componentCells, ...cellKeys]);
      const result = search(index + 1, nextOccupied, nextComponent, [...placements, candidate]);
      if (result) return result;
    }
    return null;
  }

  return search(0, occupied, new Set(), []);
}

function uniqueShapeSequences(
  buffers: ReturnType<AppStore['getState']>['buffers'],
  count: number,
  limit: number = 160,
): ShapeType[][] {
  const sequences: ShapeType[][] = [];
  const remaining = { ...buffers };
  function search(sequence: ShapeType[]): void {
    if (sequences.length >= limit) return;
    if (sequence.length === count) {
      sequences.push([...sequence]);
      return;
    }
    for (const shape of SHAPE_TYPES) {
      if (remaining[shape] <= 0) continue;
      remaining[shape] -= 1;
      sequence.push(shape);
      search(sequence);
      sequence.pop();
      remaining[shape] += 1;
    }
  }
  search([]);
  return sequences;
}

function planFromBuffer(
  store: AppStore,
  count: number,
  options: PlanOptions = {},
): Placement[] {
  for (const sequence of uniqueShapeSequences(store.getState().buffers, count)) {
    const plan = planConnectedBlocks(store.getState(), sequence, options);
    if (plan) return plan;
  }
  throw new Error(`No legal ${count}-Block plan for current Stock.`);
}

function executePlan(store: AppStore, plan: readonly Placement[]): string[] {
  return plan.map(placement => {
    const result = store.placeBlock(placement.shape, placement.position, placement.rotation);
    expect(result.success, result.error).toBe(true);
    return result.blockId!;
  });
}

function mockStorage(): void {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
    length: 0,
    key: () => null,
  } as Storage;
}

function saveAndResume(store: AppStore): AppStore {
  expect(saveGameState(store.getState())).toBe(true);
  const saved = loadGameState();
  expect(saved).not.toBeNull();
  return new AppStore(saved!);
}

function expectDirective(store: AppStore, currentId: string, next: string): void {
  expect(store.getDirectivePresentation()).toMatchObject({ currentId, next });
}

function drainProduction(store: AppStore): Array<{ engineId: string; shape: ShapeType }> {
  return store.drainVisualEvents()
    .filter((event): event is Extract<typeof event, { type: 'production' }> => event.type === 'production')
    .flatMap(event => event.outputs);
}

function advanceToNextProductionEvent(store: AppStore): Array<{ engineId: string; shape: ShapeType }> {
  const powered = store.getPoweredEngineIds();
  const remaining = [...powered]
    .map(engineId => {
      const engine = store.getState().engines[engineId];
      return engine ? Math.max(0, getProductionIntervalSec(engine) - engine.accumulatedTimeSec) : Infinity;
    });
  const delta = Math.min(...remaining);
  expect(Number.isFinite(delta)).toBe(true);
  store.tick(delta);
  return drainProduction(store);
}

function collectUntilStock(store: AppStore, target: number): void {
  for (let attempt = 0; attempt < 80 && getStockUsage(store.getState().buffers) < target; attempt += 1) {
    advanceToNextProductionEvent(store);
  }
  expect(getStockUsage(store.getState().buffers)).toBeGreaterThanOrEqual(target);
}

function submitConnectedBufferGroup(store: AppStore, tempIds: string[]): string[] {
  store.selectBlocks(tempIds);
  const bound = store.bindEngine();
  expect(bound.success, bound.error).toBe(true);
  const engineId = bound.engine!.id;
  expect(store.submitEngine(engineId).success).toBe(true);
  return [];
}

function engineCells(store: AppStore, engineId: string): CellSet {
  const state = store.getState();
  const engine = state.engines[engineId];
  return keysForCells((engine?.constituentBlockIds || []).flatMap(id => {
    const block = state.blocks[id];
    return block?.position ? getBlockOccupiedCells(block.shape, block.position, block.rotation) : [];
  }));
}

function collectFrontierMaterial(store: AppStore, sealIds: string[]): void {
  const sealOrigins = [
    { x: 4, y: -2 }, { x: 5, y: -2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
  ];
  const sealLane = new Set<string>();
  for (const origin of sealOrigins) {
    for (const cell of getBlockOccupiedCells('I', origin, 1)) sealLane.add(coordKey(cell.x, cell.y));
  }

  const flushBuffers = (): void => {
    while (sealIds.length < 4 && store.getState().buffers.I > 0) {
      const origin = sealOrigins[sealIds.length];
      const placed = store.placeBlock('I', origin, 1);
      expect(placed.success, placed.error).toBe(true);
      sealIds.push(placed.blockId!);
    }

    const nonIOnly = { ...store.getState().buffers, I: 0 };
    const nonIStock = getStockUsage(nonIOnly);
    if (nonIStock >= 4) {
      let groupPlan: Placement[] | null = null;
      for (const sequence of uniqueShapeSequences(nonIOnly, 4)) {
        groupPlan = planConnectedBlocks(store.getState(), sequence, {
          reservedCells: sealLane,
          prefer: { x: 1, y: 7 },
        });
        if (groupPlan) break;
      }
      expect(groupPlan, 'No legal temporary Compression group for current Stock.').not.toBeNull();
      const temporaryIds = executePlan(store, groupPlan!);
      submitConnectedBufferGroup(store, temporaryIds);
    }
  };

  for (let attempt = 0; attempt < 180 && sealIds.length < 4; attempt += 1) {
    flushBuffers();
    if (sealIds.length >= 4) break;
    advanceToNextProductionEvent(store);
  }
  flushBuffers();
  expect(sealIds).toHaveLength(4);
  expect(getStockUsage(store.getState().buffers)).toBeLessThanOrEqual(STOCK_CAPACITY);
}

function planTwinStars(store: AppStore, targetChunkId: string): Placement[] {
  const targetCells = keysForCells(getChunkCells(targetChunkId));
  const openingCells = keysForCells(getOpeningUnlockedCells());
  const sequences = uniqueShapeSequences(store.getState().buffers, 4, 400);
  const targetOrigin = { x: 7, y: -1 };

  for (const sequence of sequences) {
    const targetPlan = planConnectedBlocks(store.getState(), sequence.slice(0, 2), {
      allowedCells: targetCells,
      prefer: targetOrigin,
    });
    if (!targetPlan) continue;

    const simulated = structuredClone(store.getState());
    for (const placement of targetPlan) {
      const result = placeBlockFromBuffer(simulated, placement.shape, placement.position, placement.rotation);
      if (!result.success) throw new Error(result.error);
    }
    const targetOccupied = keysForCells(targetPlan.flatMap(cellsForBlock));
    const oldPlan = planConnectedBlocks(simulated, sequence.slice(2), {
      allowedCells: openingCells,
      forbiddenAdjacentTo: targetOccupied,
      prefer: { x: 1, y: 7 },
    });
    if (oldPlan) return [...targetPlan, ...oldPlan];
  }

  throw new Error('No legal expanded Twin Stars plan for current Stock.');
}

describe('fresh-game early loop integration', () => {
  it('completes Heart → Frontier → expanded Twin Stars with real store transitions', () => {
    mockStorage();
    let store = new AppStore();
    const initial = store.getState();
    expect(initial.buffers).toEqual({ I: 1, O: 1, T: 0, L: 1, J: 1, S: 0, Z: 0 });
    expect(getStockUsage(initial.buffers)).toBe(4);
    expect(store.getDirectivePresentation()).toMatchObject({
      currentId: 'bind_heart_seal',
      now: 'BIND HEART SEAL',
      next: 'BIND A COMPRESSION ENGINE',
    });

    expect(store.placeBlock('I', { x: 0, y: 0 }, 0).success).toBe(true);
    expect(store.placeBlock('O', { x: 1, y: 1 }, 0).success).toBe(true);
    expect(store.placeBlock('L', { x: 0, y: 1 }, 0).success).toBe(true);
    expect(store.placeBlock('J', { x: 2, y: 1 }, 0).success).toBe(true);
    store.selectAllLooseBlocks();
    expect(store.getPatternActionPreview().analysis?.patternId).toBe('heart_seal');
    expect(store.bindEngine().success).toBe(true);
    expectDirective(store, 'bind_compression_engine', 'SUBMIT AN ORDINARY ENGINE');
    expect(store.getState().currencies).toEqual({ shards: 0, cores: 0 });

    store = saveAndResume(store);
    collectUntilStock(store, 4);
    const compressionPlan = planFromBuffer(store, 4, { prefer: { x: -1, y: 5 } });
    const compressionIds = executePlan(store, compressionPlan);
    store.selectBlocks(compressionIds);
    expect(store.getPatternActionPreview().analysis).toMatchObject({ patternId: 'compression_press', isValid: true });
    expect(store.bindEngine().success).toBe(true);
    expectDirective(store, 'submit_ordinary_engine', 'UPGRADE A SHAPE TO GRADE 2');
    const compressionEngineId = store.getState().selectedEngineId!;
    const compressionSubmission = store.submitEngine(compressionEngineId);
    expect(compressionSubmission.success).toBe(true);
    expectDirective(store, 'upgrade_shape_grade_2', 'BUILD A POWERED ENGINE');
    expect(store.getState().currencies.shards).toBeGreaterThanOrEqual(6);

    expect(store.upgradeShape('I')).toMatchObject({ success: true, cost: 3, grade: 2 });
    expectDirective(store, 'rebuild_powered_engine', 'STABILIZE THE LINE');

    collectUntilStock(store, 4);
    const aZone = rectangleCells(-2, 1, -2, 5);
    for (const cell of getBlockOccupiedCells('O', { x: 0, y: 0 }, 0)) aZone.delete(coordKey(cell.x, cell.y));
    const aIds = executePlan(store, planFromBuffer(store, 4, {
      allowedCells: aZone,
      requiredAdjacentTo: keysForCells(Object.values(store.getState().blocks)
        .filter(block => block.state === 'Bound' && block.id.startsWith('block-'))
        .flatMap(block => block.position ? getBlockOccupiedCells(block.shape, block.position, block.rotation) : [])),
      prefer: { x: -1, y: 1 },
      finalCheck: cells => cells.has(coordKey(-1, 5)),
    }));
    store.selectBlocks(aIds);
    const aBind = store.bindEngine();
    expect(aBind.success, aBind.error).toBe(true);
    expectDirective(store, 'stabilize_line', 'FRONTIER SEAL');
    expect(store.getPoweredEngineIds()).toContain(aBind.engine!.id);
    expect(getDirectHeartPoweredEngineIds(store.getState())).toEqual([aBind.engine!.id]);
    expect(store.getState().engines[aBind.engine!.id].accumulatedTimeSec).toBe(0);

    store = saveAndResume(store);
    collectUntilStock(store, 4);
    const heartCells = engineCells(store, store.getState().heartEngineId!);
    const aCells = engineCells(store, aBind.engine!.id);
    expect(getStabilizeLinePairs(store.getState())).toEqual([]);
    const bIds = executePlan(store, planFromBuffer(store, 4, {
      allowedCells: rectangleCells(0, 3, 5, 9),
      requiredAdjacentTo: aCells,
      forbiddenAdjacentTo: heartCells,
      prefer: { x: 1, y: 6 },
    }));
    store.selectBlocks(bIds);
    const bBind = store.bindEngine();
    expect(bBind.success, bBind.error).toBe(true);
    expectDirective(store, 'stabilize_line', 'FRONTIER SEAL');
    expect(derivePoweredEngineIds(store.getState().engines, store.getState().blocks, store.getState().heartEngineId))
      .toContain(bBind.engine!.id);
    expect(getDirectHeartPoweredEngineIds(store.getState())).toEqual([aBind.engine!.id]);
    expect(getStabilizeLinePairs(store.getState())).toEqual([
      { engineAId: aBind.engine!.id, engineBId: bBind.engine!.id },
    ]);

    let relayOutputSeen = false;
    for (let attempt = 0; attempt < 100 && !relayOutputSeen; attempt += 1) {
      const outputs = advanceToNextProductionEvent(store);
      relayOutputSeen ||= outputs.some(output => output.engineId === bBind.engine!.id);
    }
    expect(relayOutputSeen).toBe(true);
    expect(store.getState().currencies.cores).toBe(1);
    expectDirective(store, 'frontier_seal', 'ACTIVATE IT AT THE FRONTIER');
    expect(store.getState().directive.completedIds.filter(id => id === 'stabilize_line')).toHaveLength(1);

    for (let attempt = 0; attempt < 12; attempt += 1) advanceToNextProductionEvent(store);
    expect(store.getState().currencies.cores).toBe(1);
    expect(store.getState().directive.completedIds.filter(id => id === 'stabilize_line')).toHaveLength(1);

    // B has emitted the qualifying output, so it is safe to Submit the relay.
    expect(store.submitEngine(bBind.engine!.id).success).toBe(true);
    collectUntilStock(store, 4);
    const spareIds = executePlan(store, planFromBuffer(store, 4, { prefer: { x: 1, y: 7 } }));
    store.selectBlocks(spareIds);
    const spareBind = store.bindEngine();
    expect(spareBind.success, spareBind.error).toBe(true);
    expect(store.submitEngine(spareBind.engine!.id).success).toBe(true);
    expect(store.getState().currencies.shards).toBeGreaterThanOrEqual(12);

    const sealIds: string[] = [];
    collectFrontierMaterial(store, sealIds);
    expect(sealIds.every(id => store.getState().blocks[id]?.shape === 'I')).toBe(true);
    store.selectBlocks(sealIds);
    const sealPreview = store.getFrontierSealPreview(sealIds, '6,-2');
    expect(sealPreview).toMatchObject({ validGeometry: true, target: { valid: true, contactCount: 4 }, canActivate: true });
    expect(store.getPatternActionPreview(sealIds)).toMatchObject({
      analysis: { patternId: 'compression_press', isValid: true },
      canBind: true,
    });
    expect(store.selectFrontierTarget('6,-2')).toEqual({ success: true, targetChunkId: '6,-2' });
    expect(store.activateFrontierSeal()).toMatchObject({ success: true, targetChunkId: '6,-2' });
    expect(store.getState().currencies).toEqual({ cores: 0, shards: expect.any(Number) });
    expect(store.getState().currencies.shards).toBeGreaterThanOrEqual(0);
    expectDirective(store, 'build_expanded_twin_stars', 'ADVANCE TO THE NEXT RECIPE TIER');
    expect(store.getState().directive.frontierTargetChunkId).toBe('6,-2');
    expect(store.getState().unlockedChunks).toContain('6,-2');

    store = saveAndResume(store);
    collectUntilStock(store, 4);
    const twinPlan = planTwinStars(store, '6,-2');
    const twinIds = executePlan(store, twinPlan);
    store.selectBlocks(twinIds);
    expect(store.getPatternActionPreview().analysis).toMatchObject({ patternId: 'twin_stars', isValid: true });
    const twinBind = store.bindEngine();
    expect(twinBind.success, twinBind.error).toBe(true);
    expect(twinBind.engine?.sourcePatternId).toBe('twin_stars');
    expectDirective(store, 'next_recipe_tier', 'A DEEPER FRONTIER');
    expect(store.getState().directive.completedIds).toEqual([
      'bind_heart_seal',
      'bind_compression_engine',
      'submit_ordinary_engine',
      'upgrade_shape_grade_2',
      'rebuild_powered_engine',
      'stabilize_line',
      'frontier_seal',
      'build_expanded_twin_stars',
    ]);
    expect(store.getState().directive.stabilizeLineCoreAwarded).toBe(true);
    expect(store.getState().currencies.cores).toBe(0);
    expect(getStockUsage(store.getState().buffers)).toBeLessThanOrEqual(STOCK_CAPACITY);
    expect(store.getDirectivePresentation()).toMatchObject({
      currentId: 'next_recipe_tier',
      now: 'ADVANCE TO THE NEXT RECIPE TIER',
    });
  });
});
