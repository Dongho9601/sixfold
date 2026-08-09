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

    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.renderer = new FieldRenderer(this.ctx);
    this.hud = new HUD(hudContainer, this.store);
    this.inspector = new InspectorPanel(inspectorContainer, this.store);
    this.input = new InputController(this.canvas, this.camera, this.store, this.hud);

    // Subscribe to store updates
    this.store.subscribe(() => {
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
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private startRenderLoop(): void {
    const loop = () => {
      const state = this.store.getState();
      const dragPreview = this.input.getDragPreview();
      this.renderer.render(state, this.camera, this.canvas.width, this.canvas.height, dragPreview);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
