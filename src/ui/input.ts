/**
 * Desktop/mobile input contract for Rune Foundry.
 * Left click commits the active ghost or selects a Loose Block; it never edits a placed Block.
 */

import { Block, findNearestValidPlacement, getBlockOccupiedCells, Position, ShapeType } from '../core/index.ts';
import { getAllOccupiedCells } from '../application/actions.ts';
import { GameState } from '../application/state.ts';
import { AppStore } from '../application/store.ts';
import { Camera } from './camera.ts';
import { HoldPreviewState, PlacementPreviewState, SelectionPreviewState } from './renderer.ts';
import { HUD } from './hud.ts';

export const LONG_PRESS_RETURN_MS = 450;

const SHAPE_BY_HOTKEY: Record<string, ShapeType> = {
  Digit1: 'I', Numpad1: 'I',
  Digit2: 'O', Numpad2: 'O',
  Digit3: 'T', Numpad3: 'T',
  Digit4: 'L', Numpad4: 'L',
  Digit5: 'J', Numpad5: 'J',
  Digit6: 'S', Numpad6: 'S',
  Digit7: 'Z', Numpad7: 'Z',
};

export function shapeForHotkey(code: string): ShapeType | null {
  return SHAPE_BY_HOTKEY[code] || null;
}

export function isUnavailableShapeHotkey(_code: string): boolean {
  return false;
}

export type GameplayCommand = 'rotate' | 'pan' | 'return' | 'cancel';

export function gameplayCommandForCode(code: string): GameplayCommand | null {
  if (code === 'KeyR') return 'rotate';
  if (code === 'Space') return 'pan';
  if (code === 'Delete' || code === 'Backspace') return 'return';
  if (code === 'Escape') return 'cancel';
  return null;
}

export function shouldCompleteLongPress(elapsedMs: number, pointerMoved: boolean): boolean {
  return !pointerMoved && elapsedMs >= LONG_PRESS_RETURN_MS;
}

export type PointerIntent =
  | 'multi-touch'
  | 'pan'
  | 'existing-loose'
  | 'existing-engine'
  | 'place'
  | 'deselect'
  | 'ignore';

export interface PointerIntentContext {
  pointerType: string;
  pointerCount: number;
  button: number;
  spaceDown: boolean;
  existingBlockState: Block['state'] | null;
  hasSpawnShape: boolean;
}

/**
 * Pure primary-intent routing. Placement mode owns primary click everywhere;
 * selection and Engine inspection are available only after placement is off.
 */
export function decidePointerIntent(context: PointerIntentContext): PointerIntent {
  if (context.pointerType === 'touch' && context.pointerCount >= 2) return 'multi-touch';
  if (context.button === 1 || context.button === 2 || (context.button === 0 && context.spaceDown)) return 'pan';
  if (context.button !== 0) return 'ignore';
  if (context.hasSpawnShape) return 'place';
  if (context.existingBlockState === 'Loose') return 'existing-loose';
  if (context.existingBlockState === 'Bound') return 'existing-engine';
  return 'deselect';
}

export function gameplayHotkeysEnabled(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey;
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

  private selectionPointerId: number | null = null;
  private selectionStart: PointerPosition | null = null;
  private selectionCurrent: PointerPosition | null = null;
  private selectionAdditive = false;
  private selectionMoved = false;

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

  getSelectionPreview(): SelectionPreviewState | null {
    if (!this.selectionMoved || !this.selectionStart || !this.selectionCurrent) return null;
    return { start: { ...this.selectionStart }, end: { ...this.selectionCurrent } };
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

    const canvasPoint = this.getCanvasPoint(event.clientX, event.clientY);
    const gridPosition = this.camera.screenToGrid(canvasPoint.x, canvasPoint.y);
    this.lastGridPosition = gridPosition;
    const clickedBlock = this.findBlockAt(this.store.getState(), gridPosition);
    const activeShape = this.hud.getSelectedSpawnShape();
    const intent = decidePointerIntent({
      pointerType: event.pointerType,
      pointerCount: this.pointers.size,
      button: event.button,
      spaceDown: this.spaceDown,
      existingBlockState: clickedBlock?.state || null,
      hasSpawnShape: Boolean(activeShape),
    });

    if (intent === 'multi-touch') {
      this.beginTouchGesture();
      return;
    }

    if (intent === 'pan') {
      this.beginPan(event);
      return;
    }

    if (intent === 'ignore') return;

    if (intent === 'existing-loose' && clickedBlock) {
      this.beginReturnHold(clickedBlock, event);
      return;
    }

    if (intent === 'existing-engine' && clickedBlock) {
      this.store.selectEngineByBlockId(clickedBlock.id);
      return;
    }

    if (intent === 'place' && activeShape) {
      this.placementPointerId = event.pointerId;
      this.placementMoved = false;
      this.placementStartPointer = { ...canvasPoint };
      this.updatePlacementPreview(gridPosition);
      return;
    }

    if (intent === 'deselect') {
      this.selectionPointerId = event.pointerId;
      this.selectionStart = canvasPoint;
      this.selectionCurrent = canvasPoint;
      this.selectionAdditive = event.shiftKey;
      this.selectionMoved = false;
      this.canvas.setPointerCapture?.(event.pointerId);
    }
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


    if (this.selectionPointerId === event.pointerId && this.selectionStart) {
      const canvasPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.selectionCurrent = canvasPoint;
      if (Math.hypot(canvasPoint.x - this.selectionStart.x, canvasPoint.y - this.selectionStart.y) > 5) {
        this.selectionMoved = true;
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

    if (this.selectionPointerId === event.pointerId) {
      if (this.selectionMoved && this.selectionStart && this.selectionCurrent) {
        const start = this.camera.screenToGrid(this.selectionStart.x, this.selectionStart.y);
        const end = this.camera.screenToGrid(this.selectionCurrent.x, this.selectionCurrent.y);
        this.store.selectBlocksInRect({
          minX: Math.min(start.x, end.x),
          maxX: Math.max(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxY: Math.max(start.y, end.y),
        }, this.selectionAdditive);
      } else if (!this.selectionAdditive) {
        this.store.clearSelection();
        this.store.clearEngineSelection();
      }
      this.cancelRectangleSelection();
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
    if (this.selectionPointerId === event.pointerId) this.cancelRectangleSelection();
    if (this.isPanning && this.panPointerId === event.pointerId) {
      this.isPanning = false;
      this.panPointerId = null;
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (!gameplayHotkeysEnabled(event)) return;

    if (event.code === 'Space') {
      this.spaceDown = true;
      event.preventDefault();
      return;
    }

    const shape = shapeForHotkey(event.code);
    if (shape) {
      const count = this.store.getState().buffers[shape] || 0;
      if (count <= 0) {
        this.hud.setSelectedSpawnShape(null);
        this.hud.showFeedback('0', true);
      } else {
        if (this.hud.getSelectedSpawnShape() === shape) {
          this.hud.setSelectedSpawnShape(null);
        } else {
          this.store.clearSelection();
          this.store.clearEngineSelection();
          this.spawnRotation = 0;
          this.hud.setSelectedSpawnShape(shape);
          this.updatePlacementPreview(this.lastGridPosition);
        }
      }
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyR') {
      if (this.hud.getSelectedSpawnShape()) {
        this.spawnRotation = (this.spawnRotation + 1) % 4;
        this.updatePlacementPreview(this.lastGridPosition);
        event.preventDefault();
      }
      return;
    }

    if (event.code === 'Delete' || event.code === 'Backspace') {
      const ids = [...this.store.getState().selectedBlockIds];
      for (const id of ids) this.store.returnBlock(id);
      if (ids.length > 0) this.hud.showFeedback('↩');
      event.preventDefault();
      return;
    }

    if (event.code === 'Escape') {
      if (this.hud.getSelectedSpawnShape()) this.hud.setSelectedSpawnShape(null);
      else {
        this.store.clearSelection();
        this.store.clearEngineSelection();
      }
      this.cancelHold(true);
      this.cancelRectangleSelection();
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') {
      this.spaceDown = false;
      if (gameplayHotkeysEnabled(event)) event.preventDefault();
    }
  };

  private onWindowBlur = (): void => {
    this.spaceDown = false;
    this.cancelHold(true);
    this.cancelRectangleSelection();
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
    this.store.selectBlock(blockId, additive);
  }

  private updatePlacementPreview(gridPosition: Position | null): void {
    const shape = this.hud.getSelectedSpawnShape();
    if (!shape || !gridPosition) {
      this.placementPreview = null;
      return;
    }

    const state = this.store.getState();
    const resolved = (state.buffers[shape] || 0) > 0
      ? findNearestValidPlacement(shape, this.spawnRotation, gridPosition, getAllOccupiedCells(state), 3)
      : null;
    this.placementPreview = {
      shape,
      position: resolved ? { ...resolved } : { ...gridPosition },
      rotation: this.spawnRotation,
      isValid: resolved !== null,
    };
  }

  private cancelRectangleSelection(): void {
    this.selectionPointerId = null;
    this.selectionStart = null;
    this.selectionCurrent = null;
    this.selectionAdditive = false;
    this.selectionMoved = false;
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
    this.cancelRectangleSelection();
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
