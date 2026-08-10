/**
 * Heart Engine production logic for HL;BM — Rune Foundry.
 * Accumulates elapsed time, generates blocks into shape buffers, and respects buffer caps.
 */

import { BufferCounts, HeartEngineState, ShapeType } from './types.ts';
import { calculateBlocksPerMinute } from './economy.ts';

export const DEFAULT_BASE_PRODUCTION_RATE = 10; // Blocks per minute
export const DEFAULT_MAX_BUFFER_PER_SHAPE = 3;  // Buffer capacity per shape

export interface EngineTickResult {
  engine: HeartEngineState;
  buffers: BufferCounts;
  generatedShapes: ShapeType[];
}

export interface EngineProductionView {
  nextShape: ShapeType | null;
  progress: number;
  isBlocked: boolean;
  intervalSec: number;
}

export const PRODUCTION_SHAPE_ORDER: ShapeType[] = ['I', 'O', 'L', 'J'];

export function getNextProductionShape(
  buffers: BufferCounts,
  maxPerShape: number = DEFAULT_MAX_BUFFER_PER_SHAPE,
): ShapeType | null {
  const availableShapes = PRODUCTION_SHAPE_ORDER.filter(shape => buffers[shape] < maxPerShape);
  if (availableShapes.length === 0) return null;

  let targetShape = availableShapes[0];
  let minCount = buffers[targetShape];

  for (const shape of availableShapes) {
    if (buffers[shape] < minCount) {
      minCount = buffers[shape];
      targetShape = shape;
    }
  }

  return targetShape;
}

export function getProductionIntervalSec(
  engine: HeartEngineState,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
): number {
  const bpm = calculateBlocksPerMinute(baseRate, engine.quality, engine.level);
  return 60 / bpm;
}

export function getEngineProductionView(
  engine: HeartEngineState,
  buffers: BufferCounts,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
  maxPerShape: number = DEFAULT_MAX_BUFFER_PER_SHAPE,
): EngineProductionView {
  const intervalSec = getProductionIntervalSec(engine, baseRate);
  const nextShape = getNextProductionShape(buffers, maxPerShape);

  return {
    nextShape,
    progress: Math.min(1, Math.max(0, engine.accumulatedTimeSec / intervalSec)),
    isBlocked: nextShape === null,
    intervalSec,
  };
}

export function advanceEngineProduction(
  engine: HeartEngineState,
  buffers: BufferCounts,
  deltaSeconds: number,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
  maxPerShape: number = DEFAULT_MAX_BUFFER_PER_SHAPE
): EngineTickResult {
  const intervalSec = getProductionIntervalSec(engine, baseRate);

  let accTime = engine.accumulatedTimeSec + deltaSeconds;
  const generatedShapes: ShapeType[] = [];
  const updatedBuffers = { ...buffers };

  while (accTime >= intervalSec) {
    const targetShape = getNextProductionShape(updatedBuffers, maxPerShape);
    if (!targetShape) {
      // Buffers full - cap accumulated time so production resumes immediately when space opens
      accTime = Math.min(accTime, intervalSec);
      break;
    }

    updatedBuffers[targetShape] += 1;
    generatedShapes.push(targetShape);
    accTime -= intervalSec;
  }

  return {
    engine: {
      ...engine,
      accumulatedTimeSec: accTime,
    },
    buffers: updatedBuffers,
    generatedShapes,
  };
}
