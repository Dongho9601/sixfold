/**
 * Canvas Input Controller for HL;BM — Rune Foundry.
 * Manages pointer gestures (pan, zoom, click-select, drag-block, place-from-buffer) and keyboard hotkeys.
 */

import { Block, getBlockOccupiedCells, Position } from '../core/index.ts';
import { GameState } from '../application/state.ts';
import { AppStore } from '../application/store.ts';
import { Camera } from './camera.ts';
import { DragPreviewState } from './renderer.ts';
import { HUD } from './hud.ts';

export class InputController {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private store: AppStore;
  private hud: HUD;

  private isPanning = false;
  private panStart = { x: 0, y: 0 };

  private draggingBlockId: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private dragPreview: DragPreviewState | null = null;

  constructor(canvas: HTMLCanvasElement, camera: Camera, store: AppStore, hud: HUD) {
    this.canvas = canvas;
    this.camera = camera;
    this.store = store;
    this.hud = hud;

    this.attachEventListeners();
  }

  getDragPreview(): DragPreviewState | null {
    return this.dragPreview;
  }

  private attachEventListeners(): void {
    const canvas = this.canvas;

    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    this.camera.zoomAt(mouseX, mouseY, zoomFactor);
  };

  private onMouseDown = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const gridPos = this.camera.screenToGrid(mouseX, mouseY);

    // Middle click (1) or Right click (2) or Space+Left click -> Pan
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.camera.panX, y: e.clientY - this.camera.panY };
      return;
    }

    if (e.button === 0) { // Left click
      const state = this.store.getState();
      const clickedBlock = this.findLooseBlockAt(state, gridPos);

      if (clickedBlock) {
        // Start dragging Loose block
        this.draggingBlockId = clickedBlock.id;
        this.dragOffset = {
          x: gridPos.x - clickedBlock.position!.x,
          y: gridPos.y - clickedBlock.position!.y,
        };

        this.store.selectBlock(clickedBlock.id, e.shiftKey);
        this.updateDragPreview(gridPos);
      } else {
        // Clicked on empty cell
        const activeSpawnShape = this.hud.getSelectedSpawnShape();
        if (activeSpawnShape) {
          if ((state.buffers[activeSpawnShape] || 0) <= 0) {
            this.hud.showFeedback(`Buffer empty for ${activeSpawnShape}`, true);
          } else {
            const res = this.store.placeBlock(activeSpawnShape, gridPos);
            if (res.success && res.blockId) {
              this.store.selectBlock(res.blockId, false);
              this.hud.showFeedback(`Placed ${activeSpawnShape} Block`);
            } else if (!res.success && res.error) {
              this.hud.showFeedback(`Placement failed: ${res.error}`, true);
            }
          }
        } else {
          // Clear selection or start canvas panning
          if (!e.shiftKey) {
            this.store.clearSelection();
          }
          this.isPanning = true;
          this.panStart = { x: e.clientX - this.camera.panX, y: e.clientY - this.camera.panY };
        }
      }
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.isPanning) {
      this.camera.panX = e.clientX - this.panStart.x;
      this.camera.panY = e.clientY - this.panStart.y;
      return;
    }

    if (this.draggingBlockId) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const gridPos = this.camera.screenToGrid(mouseX, mouseY);

      this.updateDragPreview(gridPos);
    }
  };

  private onMouseUp = (): void => {
    if (this.isPanning) {
      this.isPanning = false;
    }

    if (this.draggingBlockId) {
      if (this.dragPreview && this.dragPreview.isValid) {
        this.store.moveBlock(this.draggingBlockId, this.dragPreview.position);
      }
      this.draggingBlockId = null;
      this.dragPreview = null;
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // Ignore if typing in input field
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    const state = this.store.getState();

    if (e.key === 'r' || e.key === 'R') {
      if (state.selectedBlockIds.length > 0) {
        for (const id of state.selectedBlockIds) {
          this.store.rotateBlock(id);
        }
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedBlockIds.length > 0) {
        const ids = [...state.selectedBlockIds];
        for (const id of ids) {
          this.store.returnBlock(id);
        }
      }
    } else if (e.key === 'a' || e.key === 'A') {
      this.store.selectAllLooseBlocks();
    } else if (e.key === 'Escape') {
      this.store.clearSelection();
    }
  };

  private findLooseBlockAt(state: GameState, pos: Position): Block | null {
    for (const b of Object.values(state.blocks)) {
      if (b.state !== 'Loose' || !b.position) continue;
      const cells = getBlockOccupiedCells(b.shape, b.position, b.rotation);
      if (cells.some(c => c.x === pos.x && c.y === pos.y)) {
        return b;
      }
    }
    return null;
  }

  private updateDragPreview(gridPos: Position): void {
    if (!this.draggingBlockId) return;
    const state = this.store.getState();
    const block = state.blocks[this.draggingBlockId];
    if (!block) return;

    const targetPos = {
      x: gridPos.x - this.dragOffset.x,
      y: gridPos.y - this.dragOffset.y,
    };

    const cells = getBlockOccupiedCells(block.shape, targetPos, block.rotation);
    
    // Check collision ignoring current dragging block
    const isColliding = Object.values(state.blocks).some(other => {
      if (other.id === block.id || !other.position || other.state === 'Consumed') return false;
      const otherCells = getBlockOccupiedCells(other.shape, other.position, other.rotation);
      return cells.some(c => otherCells.some(oc => oc.x === c.x && oc.y === c.y));
    });

    this.dragPreview = {
      shape: block.shape,
      position: targetPos,
      rotation: block.rotation,
      isValid: !isColliding,
    };
  }
}
