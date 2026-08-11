/** Pure deterministic 7-bag production owned independently by each Engine. */

import { BufferCounts, EngineState, SHAPE_TYPES, ShapeType } from './types.ts';
import { calculateBlocksPerMinute, calculateEngineMaterialMultiplier, calculateEnginePower } from './economy.ts';
import { canAddToStock, isStockFull, STOCK_CAPACITY } from './stock.ts';

/** Canonical production pacing: Blocks per minute before material/Quality scaling. */
export const BASE_RATE = 3.5;
export const DEFAULT_BASE_PRODUCTION_RATE = BASE_RATE;
export const DEFAULT_ENGINE_SEED = 0x6d2b79f5;

export interface EngineTickResult {
  engine: EngineState;
  buffers: BufferCounts;
  generatedShapes: ShapeType[];
}

export interface EngineProductionView {
  nextShape: ShapeType;
  progress: number;
  intervalSec: number;
  blocksPerMinute: number;
  materialMultiplier: number;
  enginePower: number;
  powered: boolean;
}

export interface EngineShapeOutput {
  engine: EngineState;
  shape: ShapeType;
}

function nonZeroSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? DEFAULT_ENGINE_SEED : normalized;
}

/** xorshift32: compact, deterministic, and fully represented by one persisted uint32. */
export function nextRngUint32(state: number): { value: number; state: number } {
  let next = nonZeroSeed(state);
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { value: next, state: nonZeroSeed(next) };
}

export function shuffleShapeBag(rngState: number): { bag: ShapeType[]; rngState: number } {
  const bag = [...SHAPE_TYPES];
  let state = nonZeroSeed(rngState);
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const random = nextRngUint32(state);
    state = random.state;
    const swapIndex = random.value % (index + 1);
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return { bag, rngState: state };
}

export function createProductionBag(seed: number): Pick<EngineState, 'rngState' | 'productionBag' | 'nextShape'> {
  const shuffled = shuffleShapeBag(seed);
  return {
    rngState: shuffled.rngState,
    productionBag: shuffled.bag,
    nextShape: shuffled.bag[0],
  };
}

export function stableEngineSeed(engineId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < engineId.length; index += 1) {
    hash ^= engineId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return nonZeroSeed(hash);
}

export function getProductionIntervalSec(
  engine: EngineState,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
): number {
  return 60 / calculateBlocksPerMinute(baseRate, engine.boundValue, engine.quality);
}

export function getEngineProductionView(
  engine: EngineState,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
  powered: boolean = true,
): EngineProductionView {
  const intervalSec = getProductionIntervalSec(engine, baseRate);
  return {
    nextShape: engine.nextShape,
    progress: Math.min(1, Math.max(0, engine.accumulatedTimeSec / intervalSec)),
    intervalSec,
    blocksPerMinute: 60 / intervalSec,
    materialMultiplier: calculateEngineMaterialMultiplier(engine.boundValue),
    enginePower: calculateEnginePower(engine.boundValue, engine.quality),
    powered,
  };
}

function normalizeBag(engine: EngineState): EngineState {
  if (engine.productionBag.length > 0 && engine.productionBag[0] === engine.nextShape) return engine;
  const refill = createProductionBag(engine.rngState);
  return { ...engine, ...refill };
}

/** Returns a cloned Engine with a valid persisted bag/next-Shape pair. */
export function normalizeEngineProduction(sourceEngine: EngineState): EngineState {
  return normalizeBag({ ...sourceEngine, productionBag: [...sourceEngine.productionBag] });
}

/** Advances only the deterministic bag after one completed output. */
export function advanceEngineShape(sourceEngine: EngineState): EngineShapeOutput {
  let engine = normalizeEngineProduction(sourceEngine);
  const shape = engine.nextShape;
  const remaining = engine.productionBag.slice(1);
  if (remaining.length > 0) {
    engine = { ...engine, productionBag: remaining, nextShape: remaining[0] };
  } else {
    const refill = createProductionBag(engine.rngState);
    engine = { ...engine, ...refill };
  }
  return { engine, shape };
}

export function advanceEngineProduction(
  sourceEngine: EngineState,
  buffers: BufferCounts,
  deltaSeconds: number,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
  powered: boolean = true,
  stockCapacity: number = STOCK_CAPACITY,
): EngineTickResult {
  if (!powered) {
    return {
      engine: { ...sourceEngine, productionBag: [...sourceEngine.productionBag] },
      buffers: { ...buffers },
      generatedShapes: [],
    };
  }

  let engine = normalizeEngineProduction(sourceEngine);
  const intervalSec = getProductionIntervalSec(engine, baseRate);
  const elapsedSeconds = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const generatedShapes: ShapeType[] = [];
  const updatedBuffers = { ...buffers };

  // A full Stock does not advance the clock. Preserve fractional progress and
  // at most one already-completed interval; elapsed time spent blocked never
  // creates additional ready outputs.
  if (isStockFull(updatedBuffers, stockCapacity)) {
    const preservedProgress = preserveBlockedProgress(engine.accumulatedTimeSec, intervalSec);
    return {
      engine: { ...engine, accumulatedTimeSec: preservedProgress },
      buffers: updatedBuffers,
      generatedShapes,
    };
  }

  let accumulatedTimeSec = engine.accumulatedTimeSec + elapsedSeconds;

  while (accumulatedTimeSec + 1e-9 >= intervalSec) {
    if (!canAddToStock(updatedBuffers, 1, stockCapacity)) break;

    const output = advanceEngineShape(engine);
    updatedBuffers[output.shape] += 1;
    generatedShapes.push(output.shape);
    accumulatedTimeSec = Math.max(0, accumulatedTimeSec - intervalSec);
    engine = output.engine;

    // This Engine's output filled Stock. The output completed exactly at the
    // moment backpressure began, so elapsed time after it is blocked time and
    // must be discarded rather than converted into future production.
    if (isStockFull(updatedBuffers, stockCapacity)) {
      accumulatedTimeSec = 0;
      break;
    }
  }

  return {
    engine: { ...engine, accumulatedTimeSec },
    buffers: updatedBuffers,
    generatedShapes,
  };
}

function preserveBlockedProgress(accumulatedTimeSec: number, intervalSec: number): number {
  const normalized = Math.max(0, accumulatedTimeSec);
  return Math.min(normalized, intervalSec);
}
