/**
 * Application state store container for HL;BM — Rune Foundry.
 * Manages game state, dispatches actions, and notifies listeners.
 */

import { Position, RecipeReward, ShapeType } from '../core/types.ts';
import { createInitialState, GameState, normalizeGameState } from './state.ts';
import {
  advanceProductionTime,
  bindHeartSeal,
  clearSelection,
  getSubmissionPreview,
  moveBlock,
  placeBlockFromBuffer,
  refreshFieldPattern,
  returnBlockToBuffer,
  rotateBlock,
  selectAllLooseBlocks,
  selectBlock,
  submitRecipe,
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
  | { type: 'submit'; blocks: VisualBlockEvent[]; reward: RecipeReward }
  | { type: 'bind'; blocks: VisualBlockEvent[] }
  | { type: 'production'; shapes: ShapeType[] }
  | { type: 'reset' };

export class AppStore {
  private state: GameState;
  private listeners: Set<Listener> = new Set();
  private saveCallback: ((state: GameState) => void) | null = null;
  private visualEvents: VisualEvent[] = [];

  constructor(initialState?: GameState) {
    this.state = normalizeGameState(initialState || createInitialState());
    if (this.state.fieldAnalysis === null && Object.values(this.state.blocks).some(block => block.state === 'Loose')) {
      refreshFieldPattern(this.state);
    }
  }

  getState(): GameState {
    return this.state;
  }

  getSubmissionPreview() {
    return getSubmissionPreview(this.state);
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

  private enqueueVisualEvent(event: VisualEvent): void {
    this.visualEvents.push(event);
  }

  onSave(callback: (state: GameState) => void): void {
    this.saveCallback = callback;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(save: boolean = true): void {
    if (save && this.saveCallback) {
      this.saveCallback(this.state);
    }
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // Wrapped Actions
  placeBlock(shape: ShapeType, position: Position, rotation?: number) {
    const res = placeBlockFromBuffer(this.state, shape, position, rotation);
    if (res.success && res.blockId) {
      const block = this.state.blocks[res.blockId];
      this.enqueueVisualEvent({
        type: 'place',
        block: { id: res.blockId, shape, position: { ...position }, rotation: block?.rotation || 0 },
      });
      this.notify(true);
    }
    return res;
  }

  moveBlock(blockId: string, newPosition: Position) {
    // Retained for Pass 1/core compatibility; InputController never exposes this as gameplay input.
    const res = moveBlock(this.state, blockId, newPosition);
    if (res.success) this.notify(true);
    return res;
  }

  rotateBlock(blockId: string) {
    const res = rotateBlock(this.state, blockId);
    if (res.success) this.notify(true);
    return res;
  }

  returnBlock(blockId: string) {
    const block = this.state.blocks[blockId];
    const visualBlock = block?.position
      ? { id: block.id, shape: block.shape, position: { ...block.position }, rotation: block.rotation }
      : null;
    const res = returnBlockToBuffer(this.state, blockId);
    if (res.success) {
      if (visualBlock) this.enqueueVisualEvent({ type: 'return', block: visualBlock });
      this.notify(true);
    }
    return res;
  }

  selectBlock(blockId: string, toggle?: boolean) {
    selectBlock(this.state, blockId, toggle);
    this.notify(false);
  }

  selectAllLooseBlocks() {
    selectAllLooseBlocks(this.state);
    this.notify(false);
  }

  clearSelection() {
    clearSelection(this.state);
    this.notify(false);
  }

  bindEngine() {
    const candidateIds = this.state.fieldCandidateBlockIds.length > 0
      ? this.state.fieldCandidateBlockIds
      : this.state.selectedBlockIds;
    const bindBlocks = candidateIds
      .map(id => this.state.blocks[id])
      .filter(block => Boolean(block?.position))
      .map(block => ({ id: block.id, shape: block.shape, position: { ...block.position! }, rotation: block.rotation }));
    const res = bindHeartSeal(this.state);
    if (res.success) {
      this.enqueueVisualEvent({ type: 'bind', blocks: bindBlocks });
      this.notify(true);
    }
    return res;
  }

  submitRecipe() {
    const submitBlocks = this.state.selectedBlockIds
      .map(id => this.state.blocks[id])
      .filter(block => Boolean(block?.position))
      .map(block => ({ id: block.id, shape: block.shape, position: { ...block.position! }, rotation: block.rotation }));
    const res = submitRecipe(this.state);
    if (res.success && res.reward) {
      this.enqueueVisualEvent({ type: 'submit', blocks: submitBlocks, reward: res.reward });
      this.notify(true);
    }
    return res;
  }

  tick(deltaSeconds: number) {
    const res = advanceProductionTime(this.state, deltaSeconds);
    if (res.changed) {
      this.enqueueVisualEvent({ type: 'production', shapes: res.generatedShapes });
      this.notify(true);
    }
  }

  resetGame() {
    this.state = createInitialState();
    this.enqueueVisualEvent({ type: 'reset' });
    this.notify(true);
  }
}
