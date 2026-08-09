/**
 * HUD Overlay controller for HL;BM — Rune Foundry.
 * Renders stable HTML overlays for currencies, Heart Engine status, shape buffers palette, and field action buttons.
 */

import { ShapeType } from '../core/index.ts';
import { AppStore } from '../application/store.ts';

export class HUD {
  private container: HTMLElement;
  private store: AppStore;
  private selectedSpawnShape: ShapeType | null = 'I';
  private statusTimeoutId: number | null = null;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
    this.initDOM();
  }

  getSelectedSpawnShape(): ShapeType | null {
    return this.selectedSpawnShape;
  }

  setSelectedSpawnShape(shape: ShapeType | null): void {
    this.selectedSpawnShape = shape;
    this.update();
  }

  showFeedback(message: string, isError: boolean = false): void {
    const banner = this.container.querySelector('#hud-status-banner') as HTMLElement;
    if (!banner) return;

    if (this.statusTimeoutId !== null) {
      clearTimeout(this.statusTimeoutId);
    }

    banner.textContent = message;
    banner.style.color = isError ? '#f87171' : '#38bdf8';
    banner.style.opacity = '1';

    this.statusTimeoutId = window.setTimeout(() => {
      banner.style.opacity = '0';
      this.statusTimeoutId = null;
    }, 3000);
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <style>
        .rf-hud {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f3f4f6;
          user-select: none;
        }

        .rf-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(75, 85, 99, 0.4);
          border-radius: 12px;
          padding: 12px 20px;
          pointer-events: auto;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .rf-title {
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.05em;
          color: #f3f4f6;
        }

        .rf-currencies {
          display: flex;
          gap: 20px;
          font-weight: 600;
          font-size: 15px;
        }

        .rf-ash { color: #f97316; }
        .rf-shards { color: #38bdf8; }

        .rf-engine-status {
          font-size: 13px;
          background: rgba(31, 41, 55, 0.7);
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(107, 114, 128, 0.3);
        }

        .rf-status-banner {
          align-self: center;
          background: rgba(17, 24, 39, 0.9);
          border: 1px solid rgba(75, 85, 99, 0.5);
          border-radius: 20px;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 600;
          transition: opacity 0.3s ease;
          opacity: 0;
          pointer-events: none;
        }

        .rf-bottom-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          pointer-events: auto;
          gap: 16px;
        }

        .rf-palette {
          display: flex;
          gap: 10px;
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(75, 85, 99, 0.4);
          border-radius: 12px;
          padding: 10px 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .rf-shape-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 54px;
          height: 54px;
          border-radius: 8px;
          border: 2px solid rgba(75, 85, 99, 0.5);
          background: rgba(31, 41, 55, 0.8);
          color: #f3f4f6;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .rf-shape-btn:hover:not(:disabled) {
          border-color: #38bdf8;
          transform: translateY(-2px);
        }

        .rf-shape-btn.active {
          border-color: #38bdf8;
          background: rgba(56, 189, 248, 0.25);
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.5);
        }

        .rf-shape-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .rf-shape-count {
          font-size: 10px;
          font-weight: 500;
          color: #9ca3af;
          margin-top: 2px;
        }

        .rf-actions-bar {
          display: flex;
          gap: 8px;
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(75, 85, 99, 0.4);
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .rf-btn {
          background: #374151;
          color: #f3f4f6;
          border: 1px solid rgba(107, 114, 128, 0.4);
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .rf-btn:hover {
          background: #4b5563;
        }
      </style>

      <div class="rf-hud">
        <div class="rf-top-bar">
          <div class="rf-title">HL;BM — RUNE FOUNDRY</div>
          <div class="rf-currencies">
            <span class="rf-ash" id="hud-ash">🔥 0 Ash</span>
            <span class="rf-shards" id="hud-shards">💎 0 Shards</span>
          </div>
          <div class="rf-engine-status" id="hud-engine">Engine: Unbound</div>
        </div>

        <div class="rf-status-banner" id="hud-status-banner">Ready</div>

        <div class="rf-bottom-bar">
          <div class="rf-palette" id="hud-palette">
            <button class="rf-shape-btn" id="btn-shape-I" data-shape="I">
              <span>I</span>
              <span class="rf-shape-count" id="count-shape-I">0 in buf</span>
            </button>
            <button class="rf-shape-btn" id="btn-shape-O" data-shape="O">
              <span>O</span>
              <span class="rf-shape-count" id="count-shape-O">0 in buf</span>
            </button>
            <button class="rf-shape-btn" id="btn-shape-L" data-shape="L">
              <span>L</span>
              <span class="rf-shape-count" id="count-shape-L">0 in buf</span>
            </button>
            <button class="rf-shape-btn" id="btn-shape-J" data-shape="J">
              <span>J</span>
              <span class="rf-shape-count" id="count-shape-J">0 in buf</span>
            </button>
          </div>
          <div class="rf-actions-bar">
            <button class="rf-btn" id="btn-select-all">Select All</button>
            <button class="rf-btn" id="btn-clear-sel">Clear</button>
            <button class="rf-btn" id="btn-rotate">Rotate (R)</button>
            <button class="rf-btn" id="btn-return">Return (Del)</button>
            <button class="rf-btn" style="background:#7f1d1d;" id="btn-reset">Reset</button>
          </div>
        </div>
      </div>
    `;

    // Attach stable event listeners to shape buttons
    const shapes: ShapeType[] = ['I', 'O', 'L', 'J'];
    for (const shape of shapes) {
      const btn = this.container.querySelector(`#btn-shape-${shape}`);
      btn?.addEventListener('click', () => {
        const state = this.store.getState();
        if (state.buffers[shape] > 0) {
          // Toggle behavior: clicking active shape deselects it to allow panning
          if (this.selectedSpawnShape === shape) {
            this.setSelectedSpawnShape(null);
            this.showFeedback('Selection mode: Panning');
          } else {
            this.setSelectedSpawnShape(shape);
            this.showFeedback(`Selected ${shape} for placement`);
          }
        } else {
          this.showFeedback(`Buffer empty for ${shape}`, true);
        }
      });
    }

    // Attach stable event listeners to action buttons
    this.container.querySelector('#btn-select-all')?.addEventListener('click', () => {
      this.store.selectAllLooseBlocks();
    });
    this.container.querySelector('#btn-clear-sel')?.addEventListener('click', () => {
      this.store.clearSelection();
    });
    this.container.querySelector('#btn-rotate')?.addEventListener('click', () => {
      const state = this.store.getState();
      if (state.selectedBlockIds.length > 0) {
        for (const id of state.selectedBlockIds) {
          this.store.rotateBlock(id);
        }
      }
    });
    this.container.querySelector('#btn-return')?.addEventListener('click', () => {
      const state = this.store.getState();
      if (state.selectedBlockIds.length > 0) {
        const ids = [...state.selectedBlockIds];
        for (const id of ids) {
          this.store.returnBlock(id);
        }
      }
    });
    this.container.querySelector('#btn-reset')?.addEventListener('click', () => {
      if (confirm('Reset game state and start fresh?')) {
        this.store.resetGame();
        this.selectedSpawnShape = 'I';
        this.showFeedback('Game reset');
      }
    });
  }

  update(): void {
    const state = this.store.getState();

    // 1. Currencies
    const ashEl = this.container.querySelector('#hud-ash');
    if (ashEl) ashEl.textContent = `🔥 ${state.currencies.ash} Ash`;

    const shardsEl = this.container.querySelector('#hud-shards');
    if (shardsEl) shardsEl.textContent = `💎 ${state.currencies.shards} Shards`;

    // 2. Engine status
    const engineEl = this.container.querySelector('#hud-engine');
    if (engineEl) {
      if (state.isHeartEngineBound && state.heartEngine) {
        engineEl.textContent = `Heart Engine Lv.${state.heartEngine.level} [XP: ${state.heartEngine.xp}]`;
      } else {
        engineEl.textContent = 'Heart Engine: UNBOUND (Fill Cradle)';
      }
    }

    // 3. Buffer Palette Elements
    const shapes: ShapeType[] = ['I', 'O', 'L', 'J'];
    for (const shape of shapes) {
      const btn = this.container.querySelector(`#btn-shape-${shape}`) as HTMLButtonElement | null;
      const countEl = this.container.querySelector(`#count-shape-${shape}`);
      if (btn && countEl) {
        const count = state.buffers[shape] || 0;
        countEl.textContent = `${count} in buf`;
        btn.disabled = count <= 0;
        btn.classList.toggle('active', this.selectedSpawnShape === shape);

        // Auto-deselect shape if count drops to 0
        if (count <= 0 && this.selectedSpawnShape === shape) {
          this.selectedSpawnShape = null;
        }
      }
    }
  }
}
