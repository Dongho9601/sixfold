/**
 * Canvas 2D Renderer for HL;BM — Rune Foundry.
 * Handles viewport rendering of Cradle, Field grid, Loose blocks, Bound Engine cells, and selection highlights.
 */

import { getBlockOccupiedCells, Position, ShapeType } from '../core/index.ts';
import { GameState } from '../application/state.ts';
import { Camera } from './camera.ts';
import { CRADLE_BOUNDS } from '../core/field.ts';

export const SHAPE_COLORS: Record<ShapeType, { fill: string; stroke: string }> = {
  I: { fill: '#00e5ff', stroke: '#80d8ff' },
  O: { fill: '#ffea00', stroke: '#ffff8d' },
  L: { fill: '#ff9100', stroke: '#ffd180' },
  J: { fill: '#2979ff', stroke: '#82b1ff' },
};

export interface DragPreviewState {
  shape: ShapeType;
  position: Position;
  rotation: number;
  isValid: boolean;
}

export class FieldRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(state: GameState, camera: Camera, screenWidth: number, screenHeight: number, dragPreview?: DragPreviewState | null): void {
    const ctx = this.ctx;
    const currentCellSize = camera.cellSize * camera.zoom;

    // 1. Background
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // 2. Visible grid calculation
    const minGx = Math.floor((0 - camera.panX) / currentCellSize) - 1;
    const maxGx = Math.ceil((screenWidth - camera.panX) / currentCellSize) + 1;
    const minGy = Math.floor((0 - camera.panY) / currentCellSize) - 1;
    const maxGy = Math.ceil((screenHeight - camera.panY) / currentCellSize) + 1;

    // 3. Render grid lines
    ctx.strokeStyle = '#181c26';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let gx = minGx; gx <= maxGx; gx++) {
      const p = camera.gridToScreen(gx, 0);
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, screenHeight);
    }
    for (let gy = minGy; gy <= maxGy; gy++) {
      const p = camera.gridToScreen(0, gy);
      ctx.moveTo(0, p.y);
      ctx.lineTo(screenWidth, p.y);
    }
    ctx.stroke();

    // 4. Render Cradle
    const cradleTopLeft = camera.gridToScreen(CRADLE_BOUNDS.minX, CRADLE_BOUNDS.minY);
    const cradleWidth = 4 * currentCellSize;
    const cradleHeight = 4 * currentCellSize;

    ctx.fillStyle = state.isHeartEngineBound
      ? 'rgba(138, 43, 226, 0.08)'
      : 'rgba(255, 215, 0, 0.08)';
    ctx.fillRect(cradleTopLeft.x, cradleTopLeft.y, cradleWidth, cradleHeight);

    ctx.strokeStyle = state.isHeartEngineBound ? '#a855f7' : '#eab308';
    ctx.lineWidth = Math.max(2, 3 * camera.zoom);
    ctx.strokeRect(cradleTopLeft.x, cradleTopLeft.y, cradleWidth, cradleHeight);

    // Cradle Label (if unbound)
    if (!state.isHeartEngineBound && camera.zoom >= 0.6) {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.6)';
      ctx.font = `${Math.round(12 * camera.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('CRADLE (4×4)', cradleTopLeft.x + cradleWidth / 2, cradleTopLeft.y + cradleHeight / 2);
    }

    // 5. Render Blocks (Loose & Bound)
    const blocksList = Object.values(state.blocks).filter(b => b.state === 'Loose' || b.state === 'Bound');

    for (const block of blocksList) {
      if (!block.position) continue;
      const isSelected = state.selectedBlockIds.includes(block.id);
      const isEngine = block.state === 'Bound';
      const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
      const colorScheme = SHAPE_COLORS[block.shape];

      for (const c of cells) {
        const p = camera.gridToScreen(c.x, c.y);
        const padding = 2 * camera.zoom;
        const cellSize = currentCellSize - padding * 2;

        if (isEngine) {
          // Bound Engine Cell styling (crystallized glowing purple)
          ctx.fillStyle = '#7e22ce';
          ctx.fillRect(p.x + padding, p.y + padding, cellSize, cellSize);

          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = Math.max(1, 2 * camera.zoom);
          ctx.strokeRect(p.x + padding + 1, p.y + padding + 1, cellSize - 2, cellSize - 2);

          // Inner rune dot
          ctx.fillStyle = '#f0abfc';
          ctx.beginPath();
          ctx.arc(p.x + currentCellSize / 2, p.y + currentCellSize / 2, Math.max(2, 3 * camera.zoom), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Loose Block Cell styling
          ctx.fillStyle = colorScheme.fill;
          ctx.fillRect(p.x + padding, p.y + padding, cellSize, cellSize);

          ctx.strokeStyle = colorScheme.stroke;
          ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
          ctx.strokeRect(p.x + padding, p.y + padding, cellSize, cellSize);

          if (isSelected) {
            // Selected highlight aura
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(2, 3 * camera.zoom);
            ctx.strokeRect(p.x + padding - 2, p.y + padding - 2, cellSize + 4, cellSize + 4);
          }
        }
      }
    }

    // 6. Render Drag / Hover Ghost Preview
    if (dragPreview) {
      const previewCells = getBlockOccupiedCells(dragPreview.shape, dragPreview.position, dragPreview.rotation);
      ctx.fillStyle = dragPreview.isValid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.strokeStyle = dragPreview.isValid ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2 * camera.zoom;

      for (const c of previewCells) {
        const p = camera.gridToScreen(c.x, c.y);
        const padding = 2 * camera.zoom;
        const cellSize = currentCellSize - padding * 2;

        ctx.fillRect(p.x + padding, p.y + padding, cellSize, cellSize);
        ctx.strokeRect(p.x + padding, p.y + padding, cellSize, cellSize);
      }
    }
  }
}
