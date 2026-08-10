/**
 * Field-first Canvas renderer for HL;BM — Rune Foundry.
 *
 * The Field carries the hierarchy: a quiet ink grid, bright Loose silhouettes,
 * and darker crystallized Engines with local production state attached.
 */

import {
  findConnectedComponents,
  EngineState,
  getBlockOccupiedCells,
  getEngineProductionView,
  isCradleCell,
  Position,
  ShapeType,
} from '../core/index.ts';
import { GameState } from '../application/state.ts';
import { VisualEvent, VisualBlockEvent } from '../application/store.ts';
import { Camera } from './camera.ts';
import { CRADLE_BOUNDS } from '../core/field.ts';

export const SHAPE_COLORS: Record<ShapeType, { fill: string; stroke: string; glow: string }> = {
  I: { fill: '#3d5d67', stroke: '#8bbbc2', glow: '#9acbd1' },
  O: { fill: '#80672d', stroke: '#e3b53c', glow: '#f1cc66' },
  T: { fill: '#594563', stroke: '#b78dbc', glow: '#d9b3df' },
  L: { fill: '#84422c', stroke: '#dc8151', glow: '#ed9b6b' },
  J: { fill: '#465372', stroke: '#91a7cb', glow: '#b0c4e4' },
  S: { fill: '#506047', stroke: '#8fac72', glow: '#b8cf9e' },
  Z: { fill: '#702f2b', stroke: '#d56e5f', glow: '#e9a59c' },
};

export interface PlacementPreviewState {
  shape: ShapeType;
  position: Position;
  rotation: number;
  isValid: boolean;
}

/** Kept as a compatibility alias for callers that used the Pass 1 preview name. */
export type DragPreviewState = PlacementPreviewState;

export interface HoldPreviewState {
  blockId: string;
  position: Position;
  progress: number;
}

export interface SelectionPreviewState {
  start: Position;
  end: Position;
}

interface TransientBlockEvent {
  type: 'place' | 'return' | 'submit' | 'bind';
  blocks: VisualBlockEvent[];
  startedAt: number;
  duration: number;
  shards?: number;
}

const INK = '#0a0a0a';
const GRID = '#211e1d';
const GRID_MAJOR = '#2d2825';
const BONE = '#b7b4ae';
const GOLD = '#e3b53c';
const CRIMSON = '#7f1a0f';
const MOSS = '#506047';
const AMETHYST = '#594563';
const COLD_STEEL = '#53666d';

export class FieldRenderer {
  private ctx: CanvasRenderingContext2D;
  private transientEvents: TransientBlockEvent[] = [];
  private enginePulseUntil = new Map<string, number>();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  handleVisualEvents(events: VisualEvent[], now: number = performance.now()): void {
    for (const event of events) {
      switch (event.type) {
        case 'place':
          this.transientEvents.push({
            type: 'place',
            blocks: [event.block],
            startedAt: now,
            duration: 240,
          });
          break;
        case 'return':
          this.transientEvents.push({
            type: 'return',
            blocks: [event.block],
            startedAt: now,
            duration: 420,
          });
          break;
        case 'submit':
          this.transientEvents.push({
            type: 'submit',
            blocks: event.blocks,
            startedAt: now,
            duration: 560,
            shards: event.shards,
          });
          break;
        case 'bind':
          this.transientEvents.push({
            type: 'bind',
            blocks: event.blocks,
            startedAt: now,
            duration: 620,
          });
          this.enginePulseUntil.set(event.engineId, now + 460);
          break;
        case 'production':
          for (const output of event.outputs) this.enginePulseUntil.set(output.engineId, now + 460);
          break;
        case 'grade-up':
          break;
        case 'reset':
          this.transientEvents = [];
          this.enginePulseUntil.clear();
          break;
      }
    }
  }

  render(
    state: GameState,
    camera: Camera,
    screenWidth: number,
    screenHeight: number,
    placementPreview: PlacementPreviewState | null = null,
    holdPreview: HoldPreviewState | null = null,
    selectionPreview: SelectionPreviewState | null = null,
    now: number = performance.now(),
  ): void {
    const ctx = this.ctx;
    const currentCellSize = camera.cellSize * camera.zoom;
    this.transientEvents = this.transientEvents.filter(event => now - event.startedAt < event.duration);

    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    this.drawGrid(camera, screenWidth, screenHeight, currentCellSize);
    this.drawCradle(state, camera, currentCellSize, now);
    this.drawPatternFeedback(state, camera, currentCellSize, now);

    const activeBlocks = Object.values(state.blocks).filter(block =>
      (block.state === 'Loose' || block.state === 'Bound') && block.position,
    );
    const looseBlocks = activeBlocks.filter(block => block.state === 'Loose');

    for (const engine of Object.values(state.engines)) {
      const engineBlocks = engine.constituentBlockIds
        .map(id => state.blocks[id])
        .filter(block => Boolean(block?.position) && block.state === 'Bound');
      if (engineBlocks.length > 0) this.drawEngine(state, engine, engineBlocks, camera, currentCellSize, now);
    }

    for (const block of looseBlocks) {
      this.drawLooseBlock(
        state,
        block.id,
        block.shape,
        block.position!,
        block.rotation,
        camera,
        currentCellSize,
      );
    }

    if (placementPreview) {
      this.drawPlacementGhost(placementPreview, camera, currentCellSize);
    }

    if (holdPreview) {
      this.drawHoldPreview(holdPreview, state, camera, currentCellSize);
    }

    if (selectionPreview) this.drawSelectionRect(selectionPreview);

    this.drawTransientEvents(camera, currentCellSize, screenWidth, screenHeight, now);
  }

  private drawGrid(camera: Camera, screenWidth: number, screenHeight: number, currentCellSize: number): void {
    const ctx = this.ctx;
    const minGx = Math.floor((0 - camera.panX) / currentCellSize) - 1;
    const maxGx = Math.ceil((screenWidth - camera.panX) / currentCellSize) + 1;
    const minGy = Math.floor((0 - camera.panY) / currentCellSize) - 1;
    const maxGy = Math.ceil((screenHeight - camera.panY) / currentCellSize) + 1;

    ctx.lineWidth = 1;
    for (let gx = minGx; gx <= maxGx; gx += 1) {
      const p = camera.gridToScreen(gx, 0);
      ctx.strokeStyle = gx % 4 === 0 ? GRID_MAJOR : GRID;
      ctx.beginPath();
      ctx.moveTo(Math.round(p.x) + 0.5, 0);
      ctx.lineTo(Math.round(p.x) + 0.5, screenHeight);
      ctx.stroke();
    }
    for (let gy = minGy; gy <= maxGy; gy += 1) {
      const p = camera.gridToScreen(0, gy);
      ctx.strokeStyle = gy % 4 === 0 ? GRID_MAJOR : GRID;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(p.y) + 0.5);
      ctx.lineTo(screenWidth, Math.round(p.y) + 0.5);
      ctx.stroke();
    }
  }

  private drawCradle(state: GameState, camera: Camera, currentCellSize: number, now: number): void {
    const ctx = this.ctx;
    const topLeft = camera.gridToScreen(CRADLE_BOUNDS.minX, CRADLE_BOUNDS.minY);
    const width = 4 * currentCellSize;
    const height = 4 * currentCellSize;
    const bound = state.isHeartEngineBound;
    const analysis = state.fieldAnalysis;
    const patternPulse = analysis?.patternId === 'heart_seal' && analysis.isValid
      ? 0.76 + Math.sin((now % 720) / 720 * Math.PI * 2) * 0.18
      : 0;
    const heartPulseUntil = state.heartEngineId ? this.enginePulseUntil.get(state.heartEngineId) || 0 : 0;
    const pulse = state.isHeartEngineBound && now < heartPulseUntil
      ? Math.sin(Math.min(1, Math.max(0, (now - (heartPulseUntil - 460)) / 460)) * Math.PI)
      : 0;

    ctx.fillStyle = bound ? 'rgba(89, 69, 99, 0.12)' : 'rgba(227, 181, 60, 0.035)';
    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    ctx.strokeStyle = bound ? AMETHYST : GOLD;
    ctx.globalAlpha = bound ? 0.86 + pulse * 0.14 : patternPulse > 0 ? patternPulse : 0.58;
    ctx.lineWidth = patternPulse > 0 ? Math.max(1.5, 2 * camera.zoom) : Math.max(1, 1.5 * camera.zoom);
    ctx.strokeRect(topLeft.x + 1, topLeft.y + 1, width - 2, height - 2);
    ctx.globalAlpha = 1;

    if (!bound) {
      const occupied = this.getCradleOccupiedCellKeys(state);
      const count = occupied.size;
      if (camera.zoom >= 0.55) {
        ctx.fillStyle = BONE;
        ctx.globalAlpha = 0.68;
        ctx.font = `${Math.max(10, Math.round(12 * camera.zoom))}px ui-monospace, SFMono-Regular, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${count} / 16`, topLeft.x + 8 * camera.zoom, topLeft.y + 7 * camera.zoom);
        ctx.globalAlpha = 1;
      }

      if (analysis?.patternId === 'heart_seal' && analysis.missingCells) {
        ctx.setLineDash([3 * camera.zoom, 3 * camera.zoom]);
        ctx.strokeStyle = analysis.isValid ? GOLD : '#9d7e38';
        ctx.lineWidth = Math.max(1, camera.zoom);
        for (const cell of analysis.missingCells) {
          const p = camera.gridToScreen(cell.x, cell.y);
          ctx.strokeRect(p.x + 4 * camera.zoom, p.y + 4 * camera.zoom, currentCellSize - 8 * camera.zoom, currentCellSize - 8 * camera.zoom);
        }
        ctx.setLineDash([]);
      }
    }
  }

  private drawPatternFeedback(state: GameState, camera: Camera, currentCellSize: number, now: number): void {
    const analysis = state.fieldAnalysis;
    if (!analysis || analysis.patternId === 'none' || state.fieldCandidateBlockIds.length === 0) return;

    const candidate = state.fieldCandidateBlockIds
      .map(id => state.blocks[id])
      .filter(block => Boolean(block?.position));
    if (candidate.length === 0) return;

    const ctx = this.ctx;
    const cells = candidate.flatMap(block => getBlockOccupiedCells(block.shape, block.position!, block.rotation));
    const minX = Math.min(...cells.map(cell => cell.x));
    const maxX = Math.max(...cells.map(cell => cell.x));
    const minY = Math.min(...cells.map(cell => cell.y));
    const maxY = Math.max(...cells.map(cell => cell.y));
    const topLeft = camera.gridToScreen(minX, minY);
    const width = (maxX - minX + 1) * currentCellSize;
    const height = (maxY - minY + 1) * currentCellSize;

    if (analysis.patternId === 'heart_seal') return;

    const valid = analysis.isValid;
    ctx.strokeStyle = valid ? MOSS : '#a17d3b';
    ctx.globalAlpha = valid ? 0.9 : 0.48;
    ctx.lineWidth = Math.max(1.5, 2 * camera.zoom);
    if (!valid) ctx.setLineDash([5 * camera.zoom, 4 * camera.zoom]);
    ctx.strokeRect(topLeft.x + 3 * camera.zoom, topLeft.y + 3 * camera.zoom, width - 6 * camera.zoom, height - 6 * camera.zoom);
    ctx.setLineDash([]);

    const components = findConnectedComponents(candidate);
    if (analysis.patternId === 'twin_stars' && components.length >= 2) {
      ctx.globalAlpha = valid ? 0.72 : 0.4;
      for (const component of components.slice(0, 2)) {
        const compMinX = Math.min(...component.cells.map(cell => cell.x));
        const compMaxX = Math.max(...component.cells.map(cell => cell.x));
        const compMinY = Math.min(...component.cells.map(cell => cell.y));
        const compMaxY = Math.max(...component.cells.map(cell => cell.y));
        const p = camera.gridToScreen(compMinX, compMinY);
        ctx.strokeRect(p.x + 5 * camera.zoom, p.y + 5 * camera.zoom, (compMaxX - compMinX + 1) * currentCellSize - 10 * camera.zoom, (compMaxY - compMinY + 1) * currentCellSize - 10 * camera.zoom);
      }
    }
    ctx.globalAlpha = 1;

    if (valid) {
      const phase = (now % 1200) / 1200;
      ctx.strokeStyle = '#9aac83';
      ctx.globalAlpha = 0.25 + Math.sin(phase * Math.PI * 2) * 0.12;
      ctx.lineWidth = Math.max(1, camera.zoom);
      ctx.strokeRect(topLeft.x, topLeft.y, width, height);
      ctx.globalAlpha = 1;
    }
  }

  private drawLooseBlock(
    state: GameState,
    blockId: string,
    shape: ShapeType,
    position: Position,
    rotation: number,
    camera: Camera,
    currentCellSize: number,
  ): void {
    const ctx = this.ctx;
    const colors = SHAPE_COLORS[shape];
    const selected = state.selectedBlockIds.includes(blockId);
    const cells = getBlockOccupiedCells(shape, position, rotation);

    for (const cell of cells) {
      const p = camera.gridToScreen(cell.x, cell.y);
      const padding = Math.max(1.5, 2.5 * camera.zoom);
      const size = currentCellSize - padding * 2;
      ctx.fillStyle = colors.fill;
      ctx.fillRect(p.x + padding, p.y + padding, size, size);
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = Math.max(1, 1.4 * camera.zoom);
      ctx.strokeRect(p.x + padding, p.y + padding, size, size);

      // Small angular mark keeps the Rune language legible without turning the cell into text.
      ctx.strokeStyle = colors.glow;
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = Math.max(1, camera.zoom);
      ctx.beginPath();
      ctx.moveTo(p.x + currentCellSize * 0.32, p.y + currentCellSize * 0.68);
      ctx.lineTo(p.x + currentCellSize * 0.5, p.y + currentCellSize * 0.4);
      ctx.lineTo(p.x + currentCellSize * 0.68, p.y + currentCellSize * 0.68);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (selected) {
      const bounds = this.getScreenBounds(cells, camera, currentCellSize);
      ctx.strokeStyle = BONE;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = Math.max(2, 2 * camera.zoom);
      ctx.strokeRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2);
      ctx.globalAlpha = 1;
    }
  }

  private drawEngine(
    state: GameState,
    engine: EngineState,
    engineBlocks: GameState['blocks'][string][],
    camera: Camera,
    currentCellSize: number,
    now: number,
  ): void {
    const ctx = this.ctx;
    const engineCells = engineBlocks.flatMap(block => getBlockOccupiedCells(block.shape, block.position!, block.rotation));
    const engineKeys = new Set(engineCells.map(cell => `${cell.x},${cell.y}`));
    const pulseUntil = this.enginePulseUntil.get(engine.id) || 0;
    const pulse = now < pulseUntil
      ? Math.sin(Math.min(1, Math.max(0, (now - (pulseUntil - 460)) / 460)) * Math.PI)
      : 0;

    for (const cell of engineCells) {
      const p = camera.gridToScreen(cell.x, cell.y);
      const padding = Math.max(1, 1.5 * camera.zoom);
      const size = currentCellSize - padding * 2;
      ctx.fillStyle = pulse > 0 ? `rgba(89, 69, 99, ${0.68 + pulse * 0.2})` : '#29242c';
      ctx.fillRect(p.x + padding, p.y + padding, size, size);

      const neighbors: Array<[number, number, number, number]> = [
        [1, 0, p.x + currentCellSize * 1.5, p.y + currentCellSize / 2],
        [0, 1, p.x + currentCellSize / 2, p.y + currentCellSize * 1.5],
      ];
      for (const [dx, dy, nx, ny] of neighbors) {
        if (engineKeys.has(`${cell.x + dx},${cell.y + dy}`)) {
          ctx.strokeStyle = AMETHYST;
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = Math.max(1, camera.zoom);
          ctx.beginPath();
          ctx.moveTo(p.x + currentCellSize / 2, p.y + currentCellSize / 2);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      const edgeChecks: Array<[number, number, number, number]> = [
        [1, 0, p.x + currentCellSize, p.y],
        [-1, 0, p.x, p.y],
        [0, 1, p.x, p.y + currentCellSize],
        [0, -1, p.x, p.y],
      ];
      ctx.strokeStyle = '#735c79';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = Math.max(1, 1.3 * camera.zoom);
      for (const [dx, dy, x, y] of edgeChecks) {
        if (!engineKeys.has(`${cell.x + dx},${cell.y + dy}`)) {
          ctx.beginPath();
          if (dx !== 0) {
            ctx.moveTo(x, y + 2 * camera.zoom);
            ctx.lineTo(x, y + currentCellSize - 2 * camera.zoom);
          } else {
            ctx.moveTo(x + 2 * camera.zoom, y);
            ctx.lineTo(x + currentCellSize - 2 * camera.zoom, y);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    const minX = Math.min(...engineCells.map(cell => cell.x));
    const maxX = Math.max(...engineCells.map(cell => cell.x));
    const minY = Math.min(...engineCells.map(cell => cell.y));
    const maxY = Math.max(...engineCells.map(cell => cell.y));
    const centerGrid = { x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 };
    const center = camera.gridToScreen(centerGrid.x, centerGrid.y);
    const engineWidth = (maxX - minX + 1) * currentCellSize;
    const engineHeight = (maxY - minY + 1) * currentCellSize;
    const view = getEngineProductionView(engine);

    {
      const ringRadius = Math.max(9, Math.min(engineWidth, engineHeight) * 0.29);
      ctx.strokeStyle = '#413947';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(1.5, 2 * camera.zoom);
      ctx.beginPath();
      ctx.arc(center.x, center.y, ringRadius, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();

      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(center.x, center.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + view.progress * Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (engine.foundational) this.drawHeartGlyph(center.x, center.y, Math.max(5, ringRadius * 0.48), pulse > 0 ? '#d9b3df' : '#b78dbc');
      else this.drawEngineGlyph(center.x, center.y, Math.max(5, ringRadius * 0.52), pulse > 0 ? '#d9b3df' : '#b78dbc');

      if (state.selectedEngineId === engine.id) {
        ctx.save();
        ctx.strokeStyle = '#d9b3df';
        ctx.lineWidth = Math.max(1.5, 1.8 * camera.zoom);
        ctx.globalAlpha = .92;
        if (engine.submittable) ctx.setLineDash([4 * camera.zoom, 3 * camera.zoom]);
        for (const cell of engineCells) {
          const point = camera.gridToScreen(cell.x, cell.y);
          ctx.strokeRect(point.x + 2, point.y + 2, currentCellSize - 4, currentCellSize - 4);
        }
        ctx.restore();
      }

      if (view.nextShape) {
        const outputAnchor = camera.gridToScreen(maxX + 1.05, minY - 0.08);
        ctx.strokeStyle = COLD_STEEL;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = Math.max(1, camera.zoom);
        ctx.beginPath();
        ctx.moveTo(camera.gridToScreen(maxX + 0.78, minY + 0.78).x, camera.gridToScreen(maxX + 0.78, minY + 0.78).y);
        ctx.lineTo(outputAnchor.x + currentCellSize * 0.12, outputAnchor.y + currentCellSize * 0.4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        this.drawShapeGlyph(view.nextShape, outputAnchor.x, outputAnchor.y, Math.max(3, currentCellSize * 0.18), SHAPE_COLORS[view.nextShape].stroke, 0.95);
      }
    }
  }

  private drawPlacementGhost(preview: PlacementPreviewState, camera: Camera, currentCellSize: number): void {
    const ctx = this.ctx;
    const colors = preview.isValid ? SHAPE_COLORS[preview.shape] : { fill: CRIMSON, stroke: '#d56e5f', glow: '#e2a296' };
    const cells = getBlockOccupiedCells(preview.shape, preview.position, preview.rotation);
    ctx.fillStyle = preview.isValid ? 'rgba(80, 96, 71, 0.34)' : 'rgba(127, 26, 15, 0.32)';
    ctx.strokeStyle = colors.stroke;
    ctx.globalAlpha = 0.86;
    ctx.lineWidth = Math.max(1.5, 2 * camera.zoom);
    for (const cell of cells) {
      const p = camera.gridToScreen(cell.x, cell.y);
      const padding = Math.max(1, 2 * camera.zoom);
      ctx.fillRect(p.x + padding, p.y + padding, currentCellSize - padding * 2, currentCellSize - padding * 2);
      ctx.strokeRect(p.x + padding, p.y + padding, currentCellSize - padding * 2, currentCellSize - padding * 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawHoldPreview(holdPreview: HoldPreviewState, state: GameState, camera: Camera, currentCellSize: number): void {
    const block = state.blocks[holdPreview.blockId];
    const position = block?.position || holdPreview.position;
    const cells = block ? getBlockOccupiedCells(block.shape, position, block.rotation) : [position];
    const centerCell = {
      x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5,
      y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length + 0.5,
    };
    const center = camera.gridToScreen(centerCell.x, centerCell.y);
    const radius = Math.max(12, currentCellSize * 0.44);
    const ctx = this.ctx;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, 3 * camera.zoom);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, -Math.PI / 2, -Math.PI / 2 + holdPreview.progress * Math.PI * 2);
    ctx.stroke();
  }

  private drawSelectionRect(selection: SelectionPreviewState): void {
    const x = Math.min(selection.start.x, selection.end.x);
    const y = Math.min(selection.start.y, selection.end.y);
    const width = Math.abs(selection.end.x - selection.start.x);
    const height = Math.abs(selection.end.y - selection.start.y);
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(139,187,194,.08)';
    this.ctx.strokeStyle = '#8bbbc2';
    this.ctx.globalAlpha = .82;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 4]);
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x + .5, y + .5, width, height);
    this.ctx.restore();
  }

  private drawTransientEvents(
    camera: Camera,
    currentCellSize: number,
    screenWidth: number,
    screenHeight: number,
    now: number,
  ): void {
    const ctx = this.ctx;
    for (const event of this.transientEvents) {
      const progress = Math.min(1, Math.max(0, (now - event.startedAt) / event.duration));
      const alpha = 1 - progress;

      if (event.type === 'bind' && event.blocks.length > 1) {
        const centers = event.blocks.map(block => {
          const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
          const center = {
            x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5,
            y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length + 0.5,
          };
          return camera.gridToScreen(center.x, center.y);
        });
        ctx.save();
        ctx.strokeStyle = AMETHYST;
        ctx.globalAlpha = (0.2 + progress * 0.48) * alpha;
        ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
        for (let index = 1; index < centers.length; index += 1) {
          ctx.beginPath();
          ctx.moveTo(centers[index - 1].x, centers[index - 1].y);
          ctx.lineTo(centers[index].x, centers[index].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const block of event.blocks) {
        const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
        const centerCell = {
          x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5,
          y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length + 0.5,
        };
        const center = camera.gridToScreen(centerCell.x, centerCell.y);

        if (event.type === 'return') {
          const targetX = screenWidth * 0.5;
          const targetY = screenHeight - 32;
          const move = progress * 0.18;
          this.drawEventSilhouette(
            block,
            camera,
            currentCellSize,
            1 - progress * 0.34,
            alpha * 0.92,
            SHAPE_COLORS[block.shape].fill,
            GOLD,
            (targetX - center.x) * move,
            (targetY - center.y) * move,
            0,
          );
          if (progress > 0.48) {
            ctx.save();
            ctx.strokeStyle = GOLD;
            ctx.globalAlpha = alpha * 0.25;
            ctx.lineWidth = Math.max(1, camera.zoom);
            ctx.beginPath();
            ctx.arc(center.x, center.y, currentCellSize * (0.42 + progress * 0.2), -Math.PI / 2, Math.PI * 1.5);
            ctx.stroke();
            ctx.restore();
          }
        } else if (event.type === 'submit') {
          this.drawEventSilhouette(
            block,
            camera,
            currentCellSize,
            1 - progress * 0.78,
            alpha * 0.9,
            SHAPE_COLORS[block.shape].fill,
            AMETHYST,
            0,
            0,
            0.78,
          );
          if (progress < 0.28) {
            const bounds = this.getScreenBounds(cells, camera, currentCellSize);
            ctx.save();
            ctx.strokeStyle = AMETHYST;
            ctx.globalAlpha = alpha * 0.9;
            ctx.lineWidth = Math.max(1, 1.8 * camera.zoom);
            ctx.setLineDash([4 * camera.zoom, 3 * camera.zoom]);
            ctx.strokeRect(bounds.x + 1, bounds.y + 1, bounds.width - 2, bounds.height - 2);
            ctx.restore();
          }
          if (progress > 0.58) {
            ctx.save();
            ctx.strokeStyle = '#dc8151';
            ctx.globalAlpha = alpha * 0.22;
            ctx.lineWidth = Math.max(1, camera.zoom);
            ctx.beginPath();
            ctx.arc(center.x, center.y, currentCellSize * (0.22 + progress * 0.34), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        } else if (event.type === 'bind') {
          // The bound Engine is already underneath this snapshot. Fading the
          // bright tetromino over it makes Bind read as crystallization, not
          // consumption, while the occupied coordinates stay unchanged.
          this.drawEventSilhouette(
            block,
            camera,
            currentCellSize,
            1 - progress * 0.04,
            (1 - progress) * 0.88,
            SHAPE_COLORS[block.shape].fill,
            SHAPE_COLORS[block.shape].stroke,
            0,
            0,
            0,
          );
          ctx.save();
          ctx.strokeStyle = AMETHYST;
          ctx.globalAlpha = alpha * 0.7;
          ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
          ctx.beginPath();
          ctx.arc(center.x, center.y, currentCellSize * (0.28 + progress * 0.35), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          this.drawEventSilhouette(
            block,
            camera,
            currentCellSize,
            1 + (1 - progress) * 0.06,
            alpha * 0.5,
            SHAPE_COLORS[block.shape].fill,
            SHAPE_COLORS[block.shape].glow,
            0,
            0,
            0,
          );
        }
      }

      if (event.type === 'submit' && event.blocks.length > 0) {
        const average = event.blocks.reduce((center, block) => {
          const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
          return {
            x: center.x + cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length + 0.5,
            y: center.y + cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length + 0.5,
          };
        }, { x: 0, y: 0 });
        const rewardCenter = camera.gridToScreen(
          average.x / event.blocks.length,
          average.y / event.blocks.length - progress * 0.8,
        );
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${Math.max(9, Math.round(11 * camera.zoom))}px ui-monospace, SFMono-Regular, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#d9b3df';
        ctx.fillText(`◆ +${event.shards || 0}`, rewardCenter.x + 8 * camera.zoom, rewardCenter.y);
        ctx.restore();
      }
    }
  }

  private drawEventSilhouette(
    block: VisualBlockEvent,
    camera: Camera,
    currentCellSize: number,
    scale: number,
    alpha: number,
    fill: string,
    stroke: string,
    shiftX: number,
    shiftY: number,
    foldAmount: number,
  ): void {
    const cells = getBlockOccupiedCells(block.shape, block.position, block.rotation);
    const centers = cells.map(cell => camera.gridToScreen(cell.x + 0.5, cell.y + 0.5));
    const centroid = centers.reduce((sum, center) => ({ x: sum.x + center.x, y: sum.y + center.y }), { x: 0, y: 0 });
    centroid.x /= centers.length;
    centroid.y /= centers.length;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
    for (const center of centers) {
      const x = centroid.x + (center.x - centroid.x) * (1 - foldAmount * (1 - scale)) + shiftX;
      const y = centroid.y + (center.y - centroid.y) * (1 - foldAmount * (1 - scale)) + shiftY;
      const size = Math.max(2, (currentCellSize - 5 * camera.zoom) * scale);
      ctx.fillStyle = fill;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
  }

  private drawHeartGlyph(x: number, y: number, radius: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + radius * 0.85);
    ctx.bezierCurveTo(x - radius * 1.3, y - radius * 0.05, x - radius * 0.85, y - radius * 0.95, x, y - radius * 0.35);
    ctx.bezierCurveTo(x + radius * 0.85, y - radius * 0.95, x + radius * 1.3, y - radius * 0.05, x, y + radius * 0.85);
    ctx.fill();
  }

  private drawEngineGlyph(x: number, y: number, radius: number, color: string): void {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, radius * .22);
    ctx.beginPath();
    ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y); ctx.closePath();
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, radius * .3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }

  private drawShapeGlyph(shape: ShapeType, x: number, y: number, cellSize: number, color: string, alpha: number): void {
    const cells = getBlockOccupiedCells(shape, { x: 0, y: 0 }, 0);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (const cell of cells) {
      ctx.fillRect(x + cell.x * cellSize, y + cell.y * cellSize, cellSize - 1, cellSize - 1);
    }
    ctx.globalAlpha = 1;
  }

  private getScreenBounds(cells: Position[], camera: Camera, currentCellSize: number): { x: number; y: number; width: number; height: number } {
    const minX = Math.min(...cells.map(cell => cell.x));
    const maxX = Math.max(...cells.map(cell => cell.x));
    const minY = Math.min(...cells.map(cell => cell.y));
    const maxY = Math.max(...cells.map(cell => cell.y));
    const topLeft = camera.gridToScreen(minX, minY);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: (maxX - minX + 1) * currentCellSize,
      height: (maxY - minY + 1) * currentCellSize,
    };
  }

  private getCradleOccupiedCellKeys(state: GameState): Set<string> {
    const occupied = new Set<string>();
    for (const block of Object.values(state.blocks)) {
      if ((block.state !== 'Loose' && block.state !== 'Bound') || !block.position) continue;
      for (const cell of getBlockOccupiedCells(block.shape, block.position, block.rotation)) {
        if (isCradleCell(cell.x, cell.y)) occupied.add(`${cell.x},${cell.y}`);
      }
    }
    return occupied;
  }
}
