/** Pure deterministic 7-bag production owned independently by each Engine. */

import { BufferCounts, EngineState, SHAPE_TYPES, ShapeType } from './types.ts';
import { calculateBlocksPerMinute, calculateEngineMaterialMultiplier, calculateEnginePower } from './economy.ts';

export const DEFAULT_BASE_PRODUCTION_RATE = 10;
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
): EngineProductionView {
  const intervalSec = getProductionIntervalSec(engine, baseRate);
  return {
    nextShape: engine.nextShape,
    progress: Math.min(1, Math.max(0, engine.accumulatedTimeSec / intervalSec)),
    intervalSec,
    blocksPerMinute: 60 / intervalSec,
    materialMultiplier: calculateEngineMaterialMultiplier(engine.boundValue),
    enginePower: calculateEnginePower(engine.boundValue, engine.quality),
  };
}

function normalizeBag(engine: EngineState): EngineState {
  if (engine.productionBag.length > 0 && engine.productionBag[0] === engine.nextShape) return engine;
  const refill = createProductionBag(engine.rngState);
  return { ...engine, ...refill };
}

export function advanceEngineProduction(
  sourceEngine: EngineState,
  buffers: BufferCounts,
  deltaSeconds: number,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
): EngineTickResult {
  let engine = normalizeBag({ ...sourceEngine, productionBag: [...sourceEngine.productionBag] });
  const intervalSec = getProductionIntervalSec(engine, baseRate);
  let accumulatedTimeSec = engine.accumulatedTimeSec + Math.max(0, deltaSeconds);
  const generatedShapes: ShapeType[] = [];
  const updatedBuffers = { ...buffers };

  while (accumulatedTimeSec + 1e-9 >= intervalSec) {
    const output = engine.nextShape;
    updatedBuffers[output] += 1;
    generatedShapes.push(output);
    accumulatedTimeSec = Math.max(0, accumulatedTimeSec - intervalSec);

    const remaining = engine.productionBag.slice(1);
    if (remaining.length > 0) {
      engine = { ...engine, productionBag: remaining, nextShape: remaining[0] };
    } else {
      const refill = createProductionBag(engine.rngState);
      engine = { ...engine, ...refill };
    }
  }

  return {
    engine: { ...engine, accumulatedTimeSec },
    buffers: updatedBuffers,
    generatedShapes,
  };
}
