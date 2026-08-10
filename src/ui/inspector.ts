/**
 * Context action strip. It appears only when the Field or an explicit selection
 * has something actionable; there is no persistent Inspector panel.
 */

import { AppStore } from '../application/store.ts';

type ContextAction = 'bind' | 'submit' | 'none';

export class InspectorPanel {
  private container: HTMLElement;
  private store: AppStore;
  private currentAction: ContextAction = 'none';
  private feedback: (message: string, isError?: boolean) => void;

  constructor(container: HTMLElement, store: AppStore, feedback: (message: string, isError?: boolean) => void = () => undefined) {
    this.container = container;
    this.store = store;
    this.feedback = feedback;
    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <style>
        .rf-context {
          position: absolute;
          left: 50%;
          bottom: 84px;
          display: none;
          align-items: center;
          gap: 9px;
          min-height: 38px;
          padding: 5px 7px 5px 8px;
          color: #b7b4ae;
          background: rgba(10, 10, 10, 0.9);
          border-bottom: 1px solid rgba(94, 90, 84, 0.7);
          transform: translateX(-50%);
          pointer-events: auto;
          user-select: none;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .rf-context-icon {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
        }

        .rf-context-icon img {
          width: 25px;
          height: 25px;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .rf-context-main {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 72px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        .rf-context-metric {
          color: #e3b53c;
          white-space: nowrap;
        }

        .rf-context-rewards {
          display: flex;
          align-items: center;
          gap: 7px;
          padding-left: 4px;
          color: #b7b4ae;
          font-size: 11px;
          font-weight: 700;
        }

        .rf-reward { display: inline-flex; align-items: center; gap: 3px; }
        .rf-reward-ash { color: #dc8151; }
        .rf-reward-xp { color: #b78dbc; }
        .rf-reward-gem { width: 15px; height: 15px; image-rendering: pixelated; }

        .rf-quality {
          color: #506047;
          font-size: 13px;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .rf-context-action {
          min-width: 64px;
          height: 28px;
          padding: 0 9px;
          color: #0a0a0a;
          background: #e3b53c;
          border: 0;
          font: inherit;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          cursor: pointer;
        }

        .rf-context-action:hover { background: #f1cc66; }
        .rf-context-submit { background: #53666d; color: #0a0a0a; }
        .rf-context-submit:hover { background: #8bbbc2; }
        .rf-context-near { color: #a17d3b; }

        @media (max-width: 560px) {
          .rf-context { bottom: 70px; max-width: calc(100vw - 16px); }
          .rf-context-rewards { gap: 4px; }
        }
      </style>

      <div class="rf-context" id="rf-context" role="status">
        <div class="rf-context-icon"><img id="rf-context-icon" src="/assets/hlbm/icon_seal.png" alt="" /></div>
        <div class="rf-context-main">
          <span id="rf-context-name">HEART SEAL</span>
          <span class="rf-context-metric" id="rf-context-metric"></span>
          <span class="rf-quality" id="rf-quality"></span>
        </div>
        <div class="rf-context-rewards" id="rf-context-rewards"></div>
        <button class="rf-context-action" id="rf-context-action" type="button">BIND</button>
      </div>
    `;

    this.container.querySelector('#rf-context-action')?.addEventListener('click', () => {
      if (this.currentAction === 'bind') {
        const result = this.store.bindEngine();
        if (!result.success) this.feedback('×', true);
      } else if (this.currentAction === 'submit') {
        const result = this.store.submitRecipe();
        if (!result.success) this.feedback('×', true);
      }
    });
  }

  update(): void {
    const state = this.store.getState();
    const context = this.container.querySelector('#rf-context') as HTMLElement | null;
    const icon = this.container.querySelector('#rf-context-icon') as HTMLImageElement | null;
    const name = this.container.querySelector('#rf-context-name');
    const metric = this.container.querySelector('#rf-context-metric');
    const quality = this.container.querySelector('#rf-quality');
    const rewards = this.container.querySelector('#rf-context-rewards');
    const action = this.container.querySelector('#rf-context-action') as HTMLButtonElement | null;
    if (!context || !icon || !name || !metric || !quality || !rewards || !action) return;

    const fieldAnalysis = state.fieldAnalysis;
    const preview = this.store.getSubmissionPreview();
    this.currentAction = 'none';
    context.classList.remove('rf-context-near');
    context.style.display = 'none';
    rewards.innerHTML = '';
    quality.textContent = '';
    metric.textContent = '';

    if (!state.isHeartEngineBound && fieldAnalysis?.patternId === 'heart_seal' && fieldAnalysis.isValid) {
      this.currentAction = 'bind';
      icon.src = '/assets/hlbm/icon_seal.png';
      name.textContent = 'HEART SEAL';
      metric.textContent = '4×4';
      action.textContent = 'BIND';
      action.className = 'rf-context-action';
      action.style.display = 'block';
      context.style.display = 'flex';
      return;
    }

    if (!state.isHeartEngineBound && fieldAnalysis?.patternId === 'heart_seal' && !fieldAnalysis.isValid) {
      icon.src = '/assets/hlbm/icon_seal.png';
      name.textContent = 'SEAL';
      metric.textContent = `${fieldAnalysis.metrics.cellCount} / 16`;
      action.style.display = 'none';
      context.classList.add('rf-context-near');
      context.style.display = 'flex';
      return;
    }

    if (preview.reward && preview.analysis) {
      this.currentAction = 'submit';
      icon.src = '/assets/hlbm/icon_gem.png';
      name.textContent = preview.analysis.patternId === 'compression_press' ? 'PRESS' : 'STARS';
      metric.textContent = `${preview.blocks.length}`;
      quality.textContent = qualityPips(preview.analysis.quality);
      rewards.innerHTML = `
        <span class="rf-reward rf-reward-ash"><span aria-hidden="true">✦</span>+${preview.reward.ash}</span>
        <span class="rf-reward"><img class="rf-reward-gem" src="/assets/hlbm/icon_gem.png" alt="" />+${preview.reward.shards}</span>
        <span class="rf-reward rf-reward-xp">+${preview.reward.engineXp}xp</span>
      `;
      action.textContent = `SUBMIT ${preview.blocks.length}`;
      action.className = 'rf-context-action rf-context-submit';
      action.style.display = 'block';
      context.style.display = 'flex';
    }
  }
}

function qualityPips(quality: number): string {
  const filled = Math.max(1, Math.min(4, Math.round(quality * 4)));
  return `${'◆'.repeat(filled)}${'◇'.repeat(4 - filled)}`;
}
