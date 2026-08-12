/** Observable application store and presentation-event boundary. */

import {
  derivePoweredEngineIds,
  EngineState,
  getEngineProductionView,
  getStockUsage,
  isStockFull,
  Position,
  STOCK_CAPACITY,
  ShapeType,
} from '../core/index.ts';
import { createInitialState, GameState, normalizeGameState } from './state.ts';
import { getDirectivePresentation } from './directives.ts';
import {
  advanceProductionTime,
  activateFrontierSeal,
  bindPattern,
  clearSelection,
  getFrontierSealPreview,
  getEngineSubmissionPreview,
  getEngineIdForBlock,
  getLooseBlockIdsIntersectingRect,
  getPatternActionPreview,
  selectFrontierTarget,
  GridSelectionRect,
  moveBlock,
  placeBlockFromBuffer,
  refreshFieldPattern,
  returnBlockToBuffer,
  rotateBlock,
  selectAllLooseBlocks,
  selectBlock,
  selectEngine,
  selectLooseBlocks,
  submitEngine,
  upgradeShapeGrade,
} from './actions.ts';

export type Listener = (state: GameState) => void;

export interface VisualBlockEvent {
  id: string;
  shape: ShapeType;
  position: Position;
  rotation: number;
}

export type VisualEvent =
  | { type: 'place'; block: VisualBlockEvent }
  | { type: 'return'; block: VisualBlockEvent }
  | { type: 'bind'; blocks: VisualBlockEvent[]; engineId: string }
  | { type: 'submit'; blocks: VisualBlockEvent[]; engineId: string; shards: number }
  | { type: 'production'; outputs: Array<{ engineId: string; shape: ShapeType }> }
  | { type: 'grade-up'; shape: ShapeType; grade: number }
  | { type: 'frontier-unlock'; targetChunkId: string; blockIds: string[] }
  | { type: 'reset' };

export interface EngineInspectionView {
  id: string;
  name: string;
  sourcePatternName: string;
  foundational: boolean;
  submittable: boolean;
  quality: number;
  nextShape: ShapeType;
  shards: number;
  constituentBlockIds: string[];
  blocksPerMinute: number;
  progress: number;
  powered: boolean;
  stockUsed: number;
  stockCapacity: number;
  productionPausedByStock: boolean;
  error?: string;
}

function visualBlock(block: { id: string; shape: ShapeType; position: Position | null; rotation: number }): VisualBlockEvent | null {
  return block.position ? { id: block.id, shape: block.shape, position: { ...block.position }, rotation: block.rotation } : null;
}

export class AppStore {
  private state: GameState;
  private listeners = new Set<Listener>();
  private saveCallback: ((state: GameState) => void) | null = null;
  private visualEvents: VisualEvent[] = [];

  constructor(initialState?: GameState) {
    this.state = normalizeGameState(initialState || createInitialState());
    if (this.state.fieldAnalysis === null && Object.values(this.state.blocks).some(block => block.state === 'Loose')) {
      refreshFieldPattern(this.state);
    }
  }

  getState(): GameState { return this.state; }

  getDirectivePresentation() {
    return getDirectivePresentation(this.state);
  }

  getPatternActionPreview(blockIds?: readonly string[]) {
    return getPatternActionPreview(this.state, blockIds);
  }

  getFrontierSealPreview(blockIds?: readonly string[], targetChunkId?: string | null) {
    return getFrontierSealPreview(this.state, blockIds, targetChunkId);
  }

  getFrontierTargetOptions(): string[] {
    return this.getFrontierSealPreview().targetOptions;
  }

  getEngineInspection(engineId: string | null = this.state.selectedEngineId): EngineInspectionView | null {
    if (!engineId) return null;
    const preview = getEngineSubmissionPreview(this.state, engineId);
    if (!preview) return null;
    const powered = derivePoweredEngineIds(
      this.state.engines,
      this.state.blocks,
      this.state.heartEngineId,
    ).has(preview.engine.id);
    const productionView = getEngineProductionView(preview.engine, undefined, powered);
    const stockUsed = getStockUsage(this.state.buffers);
    const stockFull = isStockFull(this.state.buffers, STOCK_CAPACITY);
    return {
      id: preview.engine.id,
      name: preview.engine.name,
      sourcePatternName: preview.engine.sourcePatternName,
      foundational: preview.engine.foundational,
      submittable: preview.engine.submittable,
      quality: preview.engine.quality,
      nextShape: preview.engine.nextShape,
      shards: preview.shards,
      constituentBlockIds: [...preview.engine.constituentBlockIds],
      blocksPerMinute: productionView.blocksPerMinute,
      progress: productionView.progress,
      powered,
      stockUsed,
      stockCapacity: STOCK_CAPACITY,
      productionPausedByStock: powered && stockFull,
      error: preview.error,
    };
  }

  getPoweredEngineIds(): Set<string> {
    return derivePoweredEngineIds(this.state.engines, this.state.blocks, this.state.heartEngineId);
  }

  setState(newState: GameState): void {
    this.state = normalizeGameState(newState);
    this.notify();
  }

  drainVisualEvents(): VisualEvent[] {
    const events = this.visualEvents;
    this.visualEvents = [];
    return events;
  }

  onSave(callback: (state: GameState) => void): void { this.saveCallback = callback; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(save: boolean = true): void {
    if (save && this.saveCallback) this.saveCallback(this.state);
    for (const listener of this.listeners) listener(this.state);
  }

  placeBlock(shape: ShapeType, position: Position, rotation?: number) {
    const result = placeBlockFromBuffer(this.state, shape, position, rotation);
    if (result.success && result.blockId) {
      const snapshot = visualBlock(this.state.blocks[result.blockId]);
      if (snapshot) this.visualEvents.push({ type: 'place', block: snapshot });
      this.notify(true);
    }
    return result;
  }

  moveBlock(blockId: string, newPosition: Position) {
    const result = moveBlock(this.state, blockId, newPosition);
    if (result.success) this.notify(true);
    return result;
  }

  rotateBlock(blockId: string) {
    const result = rotateBlock(this.state, blockId);
    if (result.success) this.notify(true);
    return result;
  }

  returnBlock(blockId: string) {
    const snapshot = this.state.blocks[blockId] ? visualBlock(this.state.blocks[blockId]) : null;
    const result = returnBlockToBuffer(this.state, blockId);
    if (result.success) {
      if (snapshot) this.visualEvents.push({ type: 'return', block: snapshot });
      this.notify(true);
    }
    return result;
  }

  selectBlock(blockId: string, toggle: boolean = false): void {
    selectBlock(this.state, blockId, toggle);
    this.notify(false);
  }

  selectBlocks(blockIds: readonly string[], additive: boolean = false): void {
    selectLooseBlocks(this.state, blockIds, additive);
    this.notify(false);
  }

  selectBlocksInRect(rect: GridSelectionRect, additive: boolean = false): string[] {
    const ids = getLooseBlockIdsIntersectingRect(this.state, rect);
    selectLooseBlocks(this.state, ids, additive);
    this.notify(false);
    return ids;
  }

  selectAllLooseBlocks(): void {
    selectAllLooseBlocks(this.state);
    this.notify(false);
  }

  clearSelection(): void {
    clearSelection(this.state);
    this.notify(false);
  }

  selectEngineByBlockId(blockId: string): EngineState | null {
    const engineId = getEngineIdForBlock(this.state, blockId);
    selectEngine(this.state, engineId);
    this.notify(false);
    return engineId ? this.state.engines[engineId] : null;
  }

  clearEngineSelection(): void {
    selectEngine(this.state, null);
    this.notify(false);
  }

  selectFrontierTarget(targetChunkId: string | null): ReturnType<typeof selectFrontierTarget> {
    const result = selectFrontierTarget(this.state, targetChunkId);
    if (result.success) this.notify(false);
    return result;
  }

  activateFrontierSeal(targetChunkId?: string | null) {
    const result = activateFrontierSeal(this.state, targetChunkId);
    if (result.success && result.targetChunkId && result.blockIds) {
      this.visualEvents.push({
        type: 'frontier-unlock',
        targetChunkId: result.targetChunkId,
        blockIds: [...result.blockIds],
      });
      this.notify(true);
    }
    return result;
  }

  bindEngine() {
    const preview = this.getPatternActionPreview();
    const snapshots = preview.blocks.map(visualBlock).filter((block): block is VisualBlockEvent => Boolean(block));
    const result = bindPattern(this.state);
    if (result.success && result.engine) {
      this.visualEvents.push({ type: 'bind', blocks: snapshots, engineId: result.engine.id });
      this.notify(true);
    }
    return result;
  }

  submitEngine(engineId: string = this.state.selectedEngineId || '') {
    const preview = getEngineSubmissionPreview(this.state, engineId);
    const snapshots = preview?.blocks.map(visualBlock).filter((block): block is VisualBlockEvent => Boolean(block)) || [];
    const result = submitEngine(this.state, engineId);
    if (result.success && result.shards !== undefined) {
      const immutableSnapshots = Object.freeze(snapshots.map(block => Object.freeze({
        ...block,
        position: Object.freeze({ ...block.position }),
      }))) as unknown as VisualBlockEvent[];
      this.visualEvents.push(Object.freeze({
        type: 'submit', blocks: immutableSnapshots, engineId, shards: result.shards,
      }));
      this.notify(true);
    }
    return result;
  }

  upgradeShape(shape: ShapeType) {
    const result = upgradeShapeGrade(this.state, shape);
    if (result.success && result.grade) {
      this.visualEvents.push({ type: 'grade-up', shape, grade: result.grade });
      this.notify(true);
    }
    return result;
  }

  tick(deltaSeconds: number): void {
    const result = advanceProductionTime(this.state, deltaSeconds);
    if (result.changed) {
      if (result.outputs.length > 0) {
        this.visualEvents.push({ type: 'production', outputs: result.outputs });
      }
      this.notify(result.requiresPersistence);
    }
  }

  resetGame(): void {
    this.state = createInitialState();
    this.visualEvents.push({ type: 'reset' });
    this.notify(true);
  }
}
