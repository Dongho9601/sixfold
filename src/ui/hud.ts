/** Persistent Foundry status rail and Rune stock tray. */

import { getStockUsage, isStockFull, SHAPE_TYPES, ShapeType, STOCK_CAPACITY } from '../core/index.ts';
import { AppStore } from '../application/store.ts';
import { shapeGlyphMarkup } from './glyphs.ts';

const AVAILABLE_SHAPES: readonly ShapeType[] = SHAPE_TYPES;
const SHAPE_HOTKEYS: Record<ShapeType, string> = { I: '1', O: '2', T: '3', L: '4', J: '5', S: '6', Z: '7' };

export class HUD {
  private selectedSpawnShape: ShapeType | null = 'I';
  private statusTimeoutId: number | null = null;

  constructor(private container: HTMLElement, private store: AppStore) {
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
    banner.classList.toggle('error', isError);
    banner.style.opacity = message ? '1' : '0';
    this.statusTimeoutId = window.setTimeout(() => {
      banner.style.opacity = '0';
      this.statusTimeoutId = null;
    }, 900);
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="rf-hud">
        <header class="rf-status-rail" aria-label="Foundry status">
          <div class="rf-brand"><span class="rf-brand-mark" aria-hidden="true"></span><span class="rf-brand-name">RUNE FOUNDRY</span></div>
          <span class="rf-run-state" title="Simulation is running"><i aria-hidden="true"></i>FOUNDRY ACTIVE</span>
          <div class="rf-resources" aria-label="Resources">
            <span class="rf-resource" title="Shards">
              <img class="rf-resource-icon" src="/assets/hlbm/icon_gem.png" alt="" />
              <span class="rf-resource-copy"><span class="rf-resource-label">Shards</span><span class="rf-resource-value" id="hud-shards">0</span></span>
            </span>
            <span class="rf-resource" title="Cores">
              <img class="rf-resource-icon" src="/assets/hlbm/icon_seal.png" alt="" />
              <span class="rf-resource-copy"><span class="rf-resource-label">Cores</span><span class="rf-resource-value" id="hud-cores">0</span></span>
            </span>
            <span class="rf-resource rf-stock-resource" id="hud-stock-resource" title="Buffered Rune stock">
              <span class="rf-resource-copy"><span class="rf-resource-label">Rune stock</span><span class="rf-resource-value" id="hud-stock">0 / ${STOCK_CAPACITY}</span></span>
              <span class="rf-stock-meter" aria-hidden="true"><i id="hud-stock-meter"></i></span>
              <span class="rf-stock-full" id="hud-stock-full" hidden>FULL</span>
            </span>
          </div>
          <button class="rf-reset" id="btn-reset" type="button" title="Reset" aria-label="Reset Rune Foundry">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V3m0 5h5M5.6 7.2A8 8 0 1 1 4 14"/></svg>
          </button>
        </header>

        <div class="rf-feedback" id="hud-feedback" aria-live="polite"></div>

        <div class="rf-palette-shell">
          <div class="rf-palette-head"><span class="rf-palette-title">RUNE STOCK</span><span class="rf-palette-help">1–7 SELECT · R ROTATE</span></div>
          <div class="rf-palette" id="hud-palette" aria-label="Loose Rune palette">
            ${AVAILABLE_SHAPES.map(shape => `
              <button class="rf-shape-btn" id="btn-shape-${shape}" data-shape="${shape}" type="button" aria-label="${shape} Rune">
                ${shapeGlyphMarkup(shape)}
                <span class="rf-shape-count" id="count-shape-${shape}">0</span>
                <span class="rf-hotkey">${SHAPE_HOTKEYS[shape]}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    for (const shape of AVAILABLE_SHAPES) {
      this.container.querySelector(`#btn-shape-${shape}`)?.addEventListener('click', () => {
        const state = this.store.getState();
        if ((state.buffers[shape] || 0) <= 0) {
          this.showFeedback('NO RUNES IN STOCK', true);
          return;
        }

        if (this.selectedSpawnShape === shape) {
          this.selectedSpawnShape = null;
        } else {
          this.selectedSpawnShape = shape;
          this.store.clearSelection();
          this.store.clearEngineSelection();
        }
        this.update();
      });
    }

    this.container.querySelector('#btn-reset')?.addEventListener('click', () => {
      if (window.confirm('Reset Rune Foundry?')) {
        this.store.resetGame();
        this.selectedSpawnShape = 'I';
        this.update();
        this.showFeedback('FOUNDRY RESET');
      }
    });
  }

  update(): void {
    const state = this.store.getState();
    const shardsEl = this.container.querySelector('#hud-shards');
    if (shardsEl) shardsEl.textContent = compactNumber(state.currencies.shards);
    const coresEl = this.container.querySelector('#hud-cores');
    if (coresEl) coresEl.textContent = compactNumber(state.currencies.cores);

    const stockUsed = getStockUsage(state.buffers);
    const stockFull = isStockFull(state.buffers, STOCK_CAPACITY);
    const stockEl = this.container.querySelector('#hud-stock');
    const stockResourceEl = this.container.querySelector('#hud-stock-resource');
    const stockFullEl = this.container.querySelector('#hud-stock-full') as HTMLElement | null;
    const stockMeterEl = this.container.querySelector('#hud-stock-meter') as HTMLElement | null;
    if (stockEl) stockEl.textContent = `${stockUsed} / ${STOCK_CAPACITY}`;
    stockMeterEl?.style.setProperty('--rf-stock-fill', `${Math.min(100, stockUsed / STOCK_CAPACITY * 100)}%`);
    stockResourceEl?.classList.toggle('full', stockFull);
    if (stockFullEl) {
      stockFullEl.hidden = !stockFull;
      stockFullEl.setAttribute('aria-label', stockFull ? 'Stock full; production paused' : '');
    }

    for (const shape of AVAILABLE_SHAPES) {
      const button = this.container.querySelector(`#btn-shape-${shape}`) as HTMLButtonElement | null;
      const countEl = this.container.querySelector(`#count-shape-${shape}`);
      const count = state.buffers[shape] || 0;
      if (!button || !countEl) continue;
      countEl.textContent = compactNumber(count);
      button.disabled = count <= 0;
      button.setAttribute('aria-label', `${shape} Rune, ${count} available, hotkey ${SHAPE_HOTKEYS[shape]}`);
      if (count <= 0 && this.selectedSpawnShape === shape) this.selectedSpawnShape = null;
      button.classList.toggle('active', this.selectedSpawnShape === shape);
      button.setAttribute('aria-pressed', `${this.selectedSpawnShape === shape}`);
    }
  }
}

function compactNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
}
