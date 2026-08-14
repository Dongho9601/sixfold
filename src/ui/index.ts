/**
 * UI / Presentation Package Entry Point.
 * Coordinates renderer, camera, input handlers, HUD overlay, and inspector panel.
 */

import { AppStore } from '../application/store.ts';
import { Camera } from './camera.ts';
import { FieldRenderer } from './renderer.ts';
import { HUD } from './hud.ts';
import { InspectorPanel } from './inspector.ts';
import { InputController } from './input.ts';
import { UiAssets } from './assets.ts';
import './theme.css';

export * from './camera.ts';
export * from './renderer.ts';
export * from './hud.ts';
export * from './inspector.ts';
export * from './input.ts';

export class UIController {
  private store: AppStore;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private renderer: FieldRenderer;
  private hud: HUD;
  private inspector: InspectorPanel;
  private input: InputController;
  private assets: UiAssets;
  private logicalWidth = 0;
  private logicalHeight = 0;

  constructor(rootContainer: HTMLElement, store: AppStore) {
    this.store = store;

    rootContainer.classList.add('rf-app');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'rf-canvas';
    rootContainer.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    const hudContainer = document.createElement('div');
    rootContainer.appendChild(hudContainer);

    const inspectorContainer = document.createElement('div');
    rootContainer.appendChild(inspectorContainer);

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.camera = new Camera(this.logicalWidth, this.logicalHeight);
    this.assets = new UiAssets();
    this.renderer = new FieldRenderer(this.ctx, this.assets);
    this.hud = new HUD(hudContainer, this.store);
    this.inspector = new InspectorPanel(inspectorContainer, this.store, (message, isError = false) => {
      this.hud.showFeedback(message, isError);
    });
    this.input = new InputController(this.canvas, this.camera, this.store, this.hud);

    // Subscribe to store updates
    this.store.subscribe(() => {
      this.renderer.handleVisualEvents(this.store.drainVisualEvents());
      this.hud.update();
      this.inspector.update();
    });

    // Initial HUD/Inspector update
    this.hud.update();
    this.inspector.update();

    // Start render loop
    this.startRenderLoop();
  }

  private resizeCanvas(): void {
    this.logicalWidth = window.innerWidth;
    this.logicalHeight = window.innerHeight;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.canvas.width = Math.round(this.logicalWidth * dpr);
    this.canvas.height = Math.round(this.logicalHeight * dpr);
    this.canvas.style.width = `${this.logicalWidth}px`;
    this.canvas.style.height = `${this.logicalHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private startRenderLoop(): void {
    const loop = () => {
      const state = this.store.getState();
      const placementPreview = this.input.getPlacementPreview();
      const holdPreview = this.input.getHoldPreview();
      const selectionPreview = this.input.getSelectionPreview();
      const hoveredBlockId = this.input.getHoveredBlockId();
      this.canvas.style.cursor = placementPreview ? 'crosshair' : 'default';
      this.renderer.render(
        state,
        this.camera,
        this.logicalWidth,
        this.logicalHeight,
        placementPreview,
        holdPreview,
        selectionPreview,
        hoveredBlockId,
        performance.now(),
      );
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
