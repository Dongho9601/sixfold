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
  private logicalWidth = 0;
  private logicalHeight = 0;

  constructor(rootContainer: HTMLElement, store: AppStore) {
    this.store = store;

    rootContainer.style.position = 'relative';
    rootContainer.style.width = '100vw';
    rootContainer.style.height = '100vh';
    rootContainer.style.overflow = 'hidden';
    rootContainer.style.backgroundColor = '#0b0d12';

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    rootContainer.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    const hudContainer = document.createElement('div');
    rootContainer.appendChild(hudContainer);

    const inspectorContainer = document.createElement('div');
    rootContainer.appendChild(inspectorContainer);

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.camera = new Camera(this.logicalWidth, this.logicalHeight);
    this.renderer = new FieldRenderer(this.ctx);
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
      const submissionPreview = this.store.getSubmissionPreview();
      this.canvas.style.cursor = placementPreview ? 'crosshair' : 'default';
      this.renderer.render(
        state,
        this.camera,
        this.logicalWidth,
        this.logicalHeight,
        placementPreview,
        holdPreview,
        selectionPreview,
        performance.now(),
        submissionPreview.reward ? submissionPreview.blockIds : [],
      );
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
