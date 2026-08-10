/**
 * Minimal persistent HUD for Rune Foundry.
 * Resources and Shape buffers stay visible; engine and Pattern detail live on the Field.
 */

import { getBlockOccupiedCells, ShapeType } from '../core/index.ts';
import { AppStore } from '../application/store.ts';

const AVAILABLE_SHAPES: ShapeType[] = ['I', 'O', 'L', 'J'];
const SHAPE_HOTKEYS: Record<ShapeType, string> = { I: '1', O: '2', L: '4', J: '5' };

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
    const banner = this.container.querySelector('#hud-feedback') as HTMLElement | null;
    if (!banner) return;

    if (this.statusTimeoutId !== null) window.clearTimeout(this.statusTimeoutId);
    banner.textContent = message;
    banner.style.color = isError ? '#d56e5f' : '#b7b4ae';
    banner.style.opacity = message ? '1' : '0';
    this.statusTimeoutId = window.setTimeout(() => {
      banner.style.opacity = '0';
      this.statusTimeoutId = null;
    }, 900);
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <style>
        .rf-hud {
          position: absolute;
          inset: 0;
          pointer-events: none;
          color: #b7b4ae;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          user-select: none;
        }

        .rf-resource-strip {
          position: absolute;
          top: 14px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 32px;
          padding: 4px 10px;
          background: rgba(10, 10, 10, 0.78);
          border-bottom: 1px solid rgba(94, 90, 84, 0.58);
          pointer-events: auto;
        }

        .rf-mark {
          color: #e3b53c;
          font-size: 12px;
          letter-spacing: 0.14em;
        }

        .rf-resource {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #b7b4ae;
          font-size: 14px;
          font-weight: 700;
          line-height: 20px;
        }

        .rf-ash-icon {
          color: #dc8151;
          font-size: 16px;
          line-height: 1;
        }

        .rf-resource-icon {
          width: 19px;
          height: 19px;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .rf-reset {
          width: 24px;
          height: 24px;
          margin-left: 2px;
          padding: 0;
          color: #5e5a54;
          background: transparent;
          border: 0;
          font: inherit;
          font-size: 16px;
          cursor: pointer;
        }

        .rf-reset:hover { color: #b7b4ae; }

        .rf-palette {
          position: absolute;
          left: 50%;
          bottom: 16px;
          display: flex;
          align-items: end;
          gap: 5px;
          transform: translateX(-50%);
          padding: 5px 7px;
          background: rgba(10, 10, 10, 0.8);
          border-top: 1px solid rgba(94, 90, 84, 0.58);
          pointer-events: auto;
        }

        .rf-shape-btn {
          position: relative;
          display: grid;
          place-items: center;
          width: 48px;
          height: 46px;
          padding: 3px 3px 6px;
          color: #b7b4ae;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
        }

        .rf-shape-btn:hover:not(:disabled) { border-color: #5e5a54; }
        .rf-shape-btn.active { border-color: #e3b53c; background: rgba(89, 69, 99, 0.3); }
        .rf-shape-btn:disabled { opacity: 0.28; cursor: not-allowed; }

        .rf-hotkey {
          position: absolute;
          right: 3px;
          bottom: 1px;
          color: #5e5a54;
          font-size: 9px;
          line-height: 10px;
        }

        .rf-shape-count {
          position: absolute;
          left: 4px;
          bottom: 1px;
          color: #b7b4ae;
          font-size: 9px;
          line-height: 10px;
        }

        .rf-shape-glyph {
          display: grid;
          grid-template-columns: repeat(4, 6px);
          grid-template-rows: repeat(4, 6px);
          gap: 1px;
          width: 27px;
          height: 27px;
          color: #e3b53c;
        }

        .rf-shape-glyph i {
          display: block;
          width: 6px;
          height: 6px;
          background: currentColor;
        }

        .rf-shape-btn[data-shape="I"] .rf-shape-glyph { color: #8bbbc2; }
        .rf-shape-btn[data-shape="O"] .rf-shape-glyph { color: #e3b53c; }
        .rf-shape-btn[data-shape="L"] .rf-shape-glyph { color: #dc8151; }
        .rf-shape-btn[data-shape="J"] .rf-shape-glyph { color: #91a7cb; }

        .rf-feedback {
          position: absolute;
          top: 58px;
          left: 50%;
          min-width: 18px;
          padding: 3px 7px;
          color: #b7b4ae;
          background: rgba(10, 10, 10, 0.84);
          border-bottom: 1px solid rgba(94, 90, 84, 0.5);
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          opacity: 0;
          transform: translateX(-50%);
          transition: opacity 120ms ease;
          pointer-events: none;
        }

        @media (max-width: 560px) {
          .rf-resource-strip { top: 8px; left: 8px; gap: 9px; }
          .rf-palette { bottom: 8px; }
          .rf-shape-btn { width: 44px; }
        }
      </style>

      <div class="rf-hud">
        <div class="rf-resource-strip" aria-label="Resources">
          <span class="rf-mark">RF</span>
          <span class="rf-resource" title="Ash"><span class="rf-ash-icon" aria-hidden="true">✦</span><span id="hud-ash">0</span></span>
          <span class="rf-resource" title="Shards"><img class="rf-resource-icon" src="/assets/hlbm/icon_gem.png" alt="" /><span id="hud-shards">0</span></span>
          <button class="rf-reset" id="btn-reset" type="button" title="Reset" aria-label="Reset">↺</button>
        </div>

        <div class="rf-feedback" id="hud-feedback" aria-live="polite"></div>

        <div class="rf-palette" id="hud-palette" aria-label="Loose Block palette">
          ${AVAILABLE_SHAPES.map(shape => `
            <button class="rf-shape-btn" id="btn-shape-${shape}" data-shape="${shape}" type="button" aria-label="${shape} Block">
              ${shapeGlyphMarkup(shape)}
              <span class="rf-shape-count" id="count-shape-${shape}">0</span>
              <span class="rf-hotkey">${SHAPE_HOTKEYS[shape]}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    for (const shape of AVAILABLE_SHAPES) {
      const button = this.container.querySelector(`#btn-shape-${shape}`);
      button?.addEventListener('click', () => {
        const state = this.store.getState();
        if ((state.buffers[shape] || 0) <= 0) {
          this.showFeedback('0', true);
          return;
        }

        if (this.selectedSpawnShape === shape) {
          this.selectedSpawnShape = null;
        } else {
          this.selectedSpawnShape = shape;
          this.store.clearSelection();
        }
        this.update();
      });
    }

    this.container.querySelector('#btn-reset')?.addEventListener('click', () => {
      if (window.confirm('Reset Rune Foundry?')) {
        this.store.resetGame();
        this.selectedSpawnShape = 'I';
        this.update();
        this.showFeedback('↺');
      }
    });
  }

  update(): void {
    const state = this.store.getState();
    const ashEl = this.container.querySelector('#hud-ash');
    const shardsEl = this.container.querySelector('#hud-shards');
    if (ashEl) ashEl.textContent = compactNumber(state.currencies.ash);
    if (shardsEl) shardsEl.textContent = compactNumber(state.currencies.shards);

    for (const shape of AVAILABLE_SHAPES) {
      const button = this.container.querySelector(`#btn-shape-${shape}`) as HTMLButtonElement | null;
      const countEl = this.container.querySelector(`#count-shape-${shape}`);
      const count = state.buffers[shape] || 0;
      if (!button || !countEl) continue;
      countEl.textContent = compactNumber(count);
      button.disabled = count <= 0;
      button.setAttribute('aria-label', `${shape} Block, ${count} available, hotkey ${SHAPE_HOTKEYS[shape]}`);
      if (count <= 0 && this.selectedSpawnShape === shape) this.selectedSpawnShape = null;
      button.classList.toggle('active', this.selectedSpawnShape === shape);
    }
  }
}

function compactNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
}

function shapeGlyphMarkup(shape: ShapeType): string {
  const cells = getBlockOccupiedCells(shape, { x: 0, y: 0 }, 0);
  return `<span class="rf-shape-glyph" aria-hidden="true">${cells.map(cell => `<i style="grid-column:${cell.x + 1};grid-row:${cell.y + 1}"></i>`).join('')}</span>`;
}
