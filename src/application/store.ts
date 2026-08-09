/**
 * Application state store container for HL;BM — Rune Foundry.
 * Manages game state, dispatches actions, and notifies listeners.
 */

import { Position, ShapeType } from '../core/types.ts';
import { createInitialState, GameState } from './state.ts';
import {
  advanceProductionTime,
  bindHeartSeal,
  clearSelection,
  moveBlock,
  placeBlockFromBuffer,
  returnBlockToBuffer,
  rotateBlock,
  selectAllLooseBlocks,
  selectBlock,
  submitRecipe,
} from './actions.ts';

export type Listener = (state: GameState) => void;

export class AppStore {
  private state: GameState;
  private listeners: Set<Listener> = new Set();
  private saveCallback: ((state: GameState) => void) | null = null;

  constructor(initialState?: GameState) {
    this.state = initialState || createInitialState();
  }

  getState(): GameState {
    return this.state;
  }

  setState(newState: GameState): void {
    this.state = newState;
    this.notify();
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
    if (res.success) this.notify(true);
    return res;
  }

  moveBlock(blockId: string, newPosition: Position) {
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
    const res = returnBlockToBuffer(this.state, blockId);
    if (res.success) this.notify(true);
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
    const res = bindHeartSeal(this.state);
    if (res.success) this.notify(true);
    return res;
  }

  submitRecipe() {
    const res = submitRecipe(this.state);
    if (res.success) this.notify(true);
    return res;
  }

  tick(deltaSeconds: number) {
    const res = advanceProductionTime(this.state, deltaSeconds);
    if (res.changed) {
      this.notify(true);
    }
  }

  resetGame() {
    this.state = createInitialState();
    this.notify(true);
  }
}
