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

export function advanceEngineProduction(
  engine: HeartEngineState,
  buffers: BufferCounts,
  deltaSeconds: number,
  baseRate: number = DEFAULT_BASE_PRODUCTION_RATE,
  maxPerShape: number = DEFAULT_MAX_BUFFER_PER_SHAPE
): EngineTickResult {
  const bpm = calculateBlocksPerMinute(baseRate, engine.quality, engine.level);
  const intervalSec = 60 / bpm;

  let accTime = engine.accumulatedTimeSec + deltaSeconds;
  const generatedShapes: ShapeType[] = [];
  const updatedBuffers = { ...buffers };

  const shapeOrder: ShapeType[] = ['I', 'O', 'L', 'J'];

  while (accTime >= intervalSec) {
    // Find shapes that have room in buffer
    const availableShapes = shapeOrder.filter(s => updatedBuffers[s] < maxPerShape);
    if (availableShapes.length === 0) {
      // Buffers full - cap accumulated time so production resumes immediately when space opens
      accTime = Math.min(accTime, intervalSec);
      break;
    }

    // Pick shape with lowest current buffer count
    let targetShape = availableShapes[0];
    let minCount = updatedBuffers[targetShape];

    for (const shape of availableShapes) {
      if (updatedBuffers[shape] < minCount) {
        minCount = updatedBuffers[shape];
        targetShape = shape;
      }
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
