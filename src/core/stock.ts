/** Global Buffered Block Stock rules. */

import { BufferCounts, SHAPE_TYPES } from './types.ts';

/** Canonical global capacity shared by all seven Shape buffers. */
export const STOCK_CAPACITY = 12;

/**
 * Returns the total number of Buffered Blocks across all Shape buffers.
 * Missing Shape keys are treated as zero so this remains safe during save
 * normalization and when inspecting older partial state.
 */
export function getStockUsage(buffers: Partial<BufferCounts>): number {
  return SHAPE_TYPES.reduce((total, shape) => total + (buffers[shape] ?? 0), 0);
}

/** Remaining room in global Stock, never reported as negative. */
export function getStockRemaining(
  buffers: Partial<BufferCounts>,
  capacity: number = STOCK_CAPACITY,
): number {
  return Math.max(0, capacity - getStockUsage(buffers));
}

/** Values at or above capacity are blocked, including oversized legacy saves. */
export function isStockFull(
  buffers: Partial<BufferCounts>,
  capacity: number = STOCK_CAPACITY,
): boolean {
  return getStockUsage(buffers) >= capacity;
}

export function canAddToStock(
  buffers: Partial<BufferCounts>,
  count: number = 1,
  capacity: number = STOCK_CAPACITY,
): boolean {
  return getStockUsage(buffers) + count <= capacity;
}
