/**
 * Camera 2D view transformation for HL;BM — Rune Foundry.
 * Manages pan, zoom, grid-to-screen, and screen-to-grid coordinate conversions.
 */

export class Camera {
  public panX: number = 0;
  public panY: number = 0;
  public zoom: number = 1.0;
  public cellSize: number = 44; // Base pixel size of a grid cell

  constructor(canvasWidth: number, canvasHeight: number) {
    this.centerOnGrid(1.5, 1.5, canvasWidth, canvasHeight);
  }

  centerOnGrid(gx: number, gy: number, screenWidth: number, screenHeight: number): void {
    const currentCellSize = this.cellSize * this.zoom;
    this.panX = screenWidth / 2 - (gx + 0.5) * currentCellSize;
    this.panY = screenHeight / 2 - (gy + 0.5) * currentCellSize;
  }

  gridToScreen(gx: number, gy: number): { x: number; y: number } {
    const currentCellSize = this.cellSize * this.zoom;
    return {
      x: this.panX + gx * currentCellSize,
      y: this.panY + gy * currentCellSize,
    };
  }

  screenToGrid(sx: number, sy: number): { x: number; y: number } {
    const currentCellSize = this.cellSize * this.zoom;
    return {
      x: Math.floor((sx - this.panX) / currentCellSize),
      y: Math.floor((sy - this.panY) / currentCellSize),
    };
  }

  zoomAt(sx: number, sy: number, deltaFactor: number): void {
    const oldZoom = this.zoom;
    const newZoom = Math.min(2.5, Math.max(0.4, oldZoom * deltaFactor));
    if (oldZoom === newZoom) return;

    const oldCellSize = this.cellSize * oldZoom;
    const newCellSize = this.cellSize * newZoom;

    const gridX = (sx - this.panX) / oldCellSize;
    const gridY = (sy - this.panY) / oldCellSize;

    this.zoom = newZoom;
    this.panX = sx - gridX * newCellSize;
    this.panY = sy - gridY * newCellSize;
  }
}
