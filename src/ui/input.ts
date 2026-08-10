/**
 * Desktop/mobile input contract for Rune Foundry.
 * Left click commits the active ghost or selects a Loose Block; it never edits a placed Block.
 */

import { Block, getBlockOccupiedCells, Position, ShapeType } from '../core/index.ts';
import { hasCollisionAt } from '../application/actions.ts';
import { GameState } from '../application/state.ts';
import { AppStore } from '../application/store.ts';
import { Camera } from './camera.ts';
import { HoldPreviewState, PlacementPreviewState } from './renderer.ts';
import { HUD } from './hud.ts';

export const LONG_PRESS_RETURN_MS = 450;

const SHAPE_BY_HOTKEY: Record<string, ShapeType> = {
  '1': 'I',
  '2': 'O',
  '4': 'L',
  '5': 'J',
};

const UNAVAILABLE_SHAPE_HOTKEYS = new Set(['3', '6', '7']);

export function shapeForHotkey(key: string): ShapeType | null {
  return SHAPE_BY_HOTKEY[key] || null;
}

export function isUnavailableShapeHotkey(key: string): boolean {
  return UNAVAILABLE_SHAPE_HOTKEYS.has(key);
}

export function shouldCompleteLongPress(elapsedMs: number, pointerMoved: boolean): boolean {
  return !pointerMoved && elapsedMs >= LONG_PRESS_RETURN_MS;
}

interface PointerPosition {
  x: number;
  y: number;
}

export class InputController {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private store: AppStore;
  private hud: HUD;

  private isPanning = false;
  private panPointerId: number | null = null;
  private panStart = { x: 0, y: 0 };
  private spaceDown = false;

  private placementPointerId: number | null = null;
  private placementMoved = false;
  private placementStartPointer: PointerPosition | null = null;
  private lastGridPosition: Position | null = null;
  private spawnRotation = 0;
  private placementPreview: PlacementPreviewState | null = null;

  private heldBlockId: string | null = null;
  private holdStartedAt = 0;
  private holdStartPointer = { x: 0, y: 0 };
  private holdMoved = false;
  private holdTimerId: number | null = null;
  private holdPreview: HoldPreviewState | null = null;

  private pointers = new Map<number, PointerPosition>();
  private touchGesture = false;
  private touchStartDistance = 1;
  private touchStartCenter = { x: 0, y: 0 };
  private touchStartZoom = 1;
  private touchStartPan = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, camera: Camera, store: AppStore, hud: HUD) {
    this.canvas = canvas;
    this.camera = camera;
    this.store = store;
    this.hud = hud;
    this.canvas.style.touchAction = 'none';
    this.attachEventListeners();
  }

  getPlacementPreview(): PlacementPreviewState | null {
    if (this.hud.getSelectedSpawnShape() && this.lastGridPosition) {
      this.updatePlacementPreview(this.lastGridPosition);
    }
    return this.hud.getSelectedSpawnShape() ? this.placementPreview : null;
  }

  /** Compatibility accessor for Pass 1 callers; placed Blocks are never dragged now. */
  getDragPreview(): PlacementPreviewState | null {
    return this.getPlacementPreview();
  }

  getHoldPreview(): HoldPreviewState | null {
    if (!this.heldBlockId || this.holdMoved) return null;
    const block = this.store.getState().blocks[this.heldBlockId];
    if (!block?.position) return null;
    this.holdPreview = {
      blockId: block.id,
      position: { ...block.position },
      progress: Math.min(1, (performance.now() - this.holdStartedAt) / LONG_PRESS_RETURN_MS),
    };
    return this.holdPreview;
  }

  private attachEventListeners(): void {
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const point = this.getCanvasPoint(event.clientX, event.clientY);
    this.camera.zoomAt(point.x, point.y, event.deltaY < 0 ? 1.1 : 0.9);
    this.updatePlacementPreview(this.camera.screenToGrid(point.x, point.y));
  };

  private onPointerDown = (event: PointerEvent): void => {
    const point = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, point);

    if (event.pointerType === 'touch' && this.pointers.size >= 2) {
      this.beginTouchGesture();
      return;
    }

    if (event.button === 1 || event.button === 2 || (event.button === 0 && this.spaceDown)) {
      this.beginPan(event);
      return;
    }
    if (event.button !== 0) return;

    const canvasPoint = this.getCanvasPoint(event.clientX, event.clientY);
    const gridPosition = this.camera.screenToGrid(canvasPoint.x, canvasPoint.y);
    this.lastGridPosition = gridPosition;

    const activeShape = this.hud.getSelectedSpawnShape();
    if (activeShape) {
      this.placementPointerId = event.pointerId;
      this.placementMoved = false;
      this.placementStartPointer = { ...canvasPoint };
      this.updatePlacementPreview(gridPosition);
      return;
    }

    const clickedBlock = this.findBlockAt(this.store.getState(), gridPosition);
    if (clickedBlock?.state === 'Loose') {
      this.beginReturnHold(clickedBlock, event);
      return;
    }

    if (clickedBlock?.state === 'Bound') {
      this.hud.showFeedback('♥');
      return;
    }

    // Ordinary left-click on open Field only clears selection. Panning requires a
    // secondary button or Space, so a placed Block can never be accidentally edited.
    if (!event.shiftKey) this.store.clearSelection();
  };

  private onPointerMove = (event: PointerEvent): void => {
    const point = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, point);

    if (this.touchGesture && this.pointers.size >= 2) {
      this.updateTouchGesture();
      return;
    }

    if (this.isPanning && event.pointerId === this.panPointerId) {
      this.camera.panX = event.clientX - this.panStart.x;
      this.camera.panY = event.clientY - this.panStart.y;
      return;
    }

    if (this.heldBlockId) {
      const distance = Math.hypot(event.clientX - this.holdStartPointer.x, event.clientY - this.holdStartPointer.y);
      if (distance > 7) this.cancelHold(true);
    }

    if (this.placementPointerId === event.pointerId) {
      const start = this.placementStartPointer;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) {
        this.placementMoved = true;
      }
    }

    const canvasPoint = this.getCanvasPoint(event.clientX, event.clientY);
    const gridPosition = this.camera.screenToGrid(canvasPoint.x, canvasPoint.y);
    this.lastGridPosition = gridPosition;
    if (this.hud.getSelectedSpawnShape()) this.updatePlacementPreview(gridPosition);
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);

    if (this.touchGesture) {
      if (this.pointers.size < 2) this.touchGesture = false;
      return;
    }

    if (this.isPanning && event.pointerId === this.panPointerId) {
      this.isPanning = false;
      this.panPointerId = null;
      return;
    }

    if (this.placementPointerId === event.pointerId) {
      const preview = this.placementPreview;
      const shape = this.hud.getSelectedSpawnShape();
      if (!this.placementMoved && preview && shape) {
        if (preview.isValid) {
          const result = this.store.placeBlock(shape, preview.position, preview.rotation);
          if (!result.success) this.hud.showFeedback('×', true);
        } else {
          this.hud.showFeedback('×', true);
        }
      }
      this.placementPointerId = null;
      this.placementMoved = false;
      this.placementStartPointer = null;
      return;
    }

    if (this.heldBlockId) {
      const blockId = this.heldBlockId;
      const completed = (this.holdPreview?.progress ?? 0) >= 1;
      const moved = this.holdMoved;
      this.cancelHold(false);
      if (!completed && !moved && this.store.getState().blocks[blockId]?.state === 'Loose') {
        this.selectLooseBlock(blockId, event.shiftKey);
      }
    }
  };

  private onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.placementPointerId === event.pointerId) {
      this.placementPointerId = null;
      this.placementMoved = false;
      this.placementStartPointer = null;
    }
    if (this.heldBlockId) this.cancelHold(true);
    if (this.isPanning && this.panPointerId === event.pointerId) {
      this.isPanning = false;
      this.panPointerId = null;
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    if (event.key === ' ') {
      this.spaceDown = true;
      event.preventDefault();
      return;
    }

    const shape = shapeForHotkey(event.key);
    if (shape) {
      const count = this.store.getState().buffers[shape] || 0;
      if (count <= 0) {
        this.hud.setSelectedSpawnShape(null);
        this.hud.showFeedback('0', true);
      } else {
        this.store.clearSelection();
        this.spawnRotation = 0;
        this.hud.setSelectedSpawnShape(shape);
        this.updatePlacementPreview(this.lastGridPosition);
      }
      event.preventDefault();
      return;
    }

    if (isUnavailableShapeHotkey(event.key)) {
      this.hud.showFeedback('—');
      event.preventDefault();
      return;
    }

    if (event.key === 'r' || event.key === 'R') {
      if (this.hud.getSelectedSpawnShape()) {
        this.spawnRotation = (this.spawnRotation + 1) % 4;
        this.updatePlacementPreview(this.lastGridPosition);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const ids = [...this.store.getState().selectedBlockIds];
      for (const id of ids) this.store.returnBlock(id);
      if (ids.length > 0) this.hud.showFeedback('↩');
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      if (this.hud.getSelectedSpawnShape()) this.hud.setSelectedSpawnShape(null);
      else this.store.clearSelection();
      this.cancelHold(true);
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === ' ') {
      this.spaceDown = false;
      event.preventDefault();
    }
  };

  private onWindowBlur = (): void => {
    this.spaceDown = false;
    this.cancelHold(true);
    this.isPanning = false;
    this.panPointerId = null;
    this.pointers.clear();
  };

  private beginPan(event: PointerEvent): void {
    this.isPanning = true;
    this.panPointerId = event.pointerId;
    this.panStart = { x: event.clientX - this.camera.panX, y: event.clientY - this.camera.panY };
    this.canvas.setPointerCapture?.(event.pointerId);
  }

  private beginReturnHold(block: Block, event: PointerEvent): void {
    this.cancelHold(true);
    this.heldBlockId = block.id;
    this.holdStartedAt = performance.now();
    this.holdStartPointer = { x: event.clientX, y: event.clientY };
    this.holdMoved = false;
    this.holdPreview = {
      blockId: block.id,
      position: { ...block.position! },
      progress: 0,
    };
    this.holdTimerId = window.setTimeout(() => {
      if (!this.heldBlockId || !shouldCompleteLongPress(LONG_PRESS_RETURN_MS, this.holdMoved)) return;
      const returnedId = this.heldBlockId;
      const result = this.store.returnBlock(returnedId);
      if (result.success) this.hud.showFeedback('↩');
      this.holdPreview = null;
      this.heldBlockId = null;
      this.holdTimerId = null;
    }, LONG_PRESS_RETURN_MS);
  }

  private cancelHold(moved: boolean): void {
    if (this.holdTimerId !== null) window.clearTimeout(this.holdTimerId);
    this.holdTimerId = null;
    this.holdMoved = moved || this.holdMoved;
    this.holdPreview = null;
    this.heldBlockId = null;
  }

  private selectLooseBlock(blockId: string, additive: boolean): void {
    const state = this.store.getState();
    const alreadySelected = state.selectedBlockIds.includes(blockId);
    this.store.selectBlock(blockId, additive || alreadySelected);
  }

  private updatePlacementPreview(gridPosition: Position | null): void {
    const shape = this.hud.getSelectedSpawnShape();
    if (!shape || !gridPosition) {
      this.placementPreview = null;
      return;
    }

    const state = this.store.getState();
    const cells = getBlockOccupiedCells(shape, gridPosition, this.spawnRotation);
    this.placementPreview = {
      shape,
      position: { ...gridPosition },
      rotation: this.spawnRotation,
      isValid: (state.buffers[shape] || 0) > 0 && !hasCollisionAt(state, cells),
    };
  }

  private getCanvasPoint(clientX: number, clientY: number): Position {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private findBlockAt(state: GameState, position: Position): Block | null {
    for (const block of Object.values(state.blocks)) {
      if ((block.state !== 'Loose' && block.state !== 'Bound') || !block.position) continue;
      const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
      if (cells.some(cell => cell.x === position.x && cell.y === position.y)) return block;
    }
    return null;
  }

  private beginTouchGesture(): void {
    this.cancelHold(true);
    this.placementPointerId = null;
    this.placementStartPointer = null;
    this.touchGesture = true;
    const values = [...this.pointers.values()];
    this.touchStartDistance = Math.max(1, distance(values[0], values[1]));
    this.touchStartCenter = midpoint(values[0], values[1]);
    this.touchStartZoom = this.camera.zoom;
    this.touchStartPan = { x: this.camera.panX, y: this.camera.panY };
  }

  private updateTouchGesture(): void {
    const values = [...this.pointers.values()];
    if (values.length < 2) return;
    const center = midpoint(values[0], values[1]);
    const distance = Math.max(1, distanceBetweenPointers(values[0], values[1]));
    const oldCellSize = this.camera.cellSize * this.touchStartZoom;
    const gridX = (this.touchStartCenter.x - this.touchStartPan.x) / oldCellSize;
    const gridY = (this.touchStartCenter.y - this.touchStartPan.y) / oldCellSize;
    const zoom = Math.min(2.5, Math.max(0.4, this.touchStartZoom * distance / this.touchStartDistance));
    const newCellSize = this.camera.cellSize * zoom;
    this.camera.zoom = zoom;
    this.camera.panX = center.x - gridX * newCellSize;
    this.camera.panY = center.y - gridY * newCellSize;
  }
}

function distance(left: PointerPosition, right: PointerPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function distanceBetweenPointers(left: PointerPosition, right: PointerPosition): number {
  return distance(left, right);
}

function midpoint(left: PointerPosition, right: PointerPosition): PointerPosition {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}
