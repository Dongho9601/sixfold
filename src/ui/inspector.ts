/**
 * Inspector and Submission Preview Modal Controller for HL;BM — Rune Foundry.
 * Displays pattern feedback, Quality metrics, near-match clues, Bind Heart Seal, and SUBMIT N BLOCKS action.
 */

import { calculateRecipeReward, Block } from '../core/index.ts';
import { AppStore } from '../application/store.ts';

export class InspectorPanel {
  private container: HTMLElement;
  private store: AppStore;

  constructor(container: HTMLElement, store: AppStore) {
    this.container = container;
    this.store = store;
    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <style>
        .rf-inspector {
          position: absolute;
          top: 80px;
          right: 16px;
          width: 320px;
          background: rgba(17, 24, 39, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(75, 85, 99, 0.5);
          border-radius: 12px;
          padding: 16px;
          font-family: system-ui, -apple-system, sans-serif;
          color: #f3f4f6;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: auto;
          user-select: none;
        }

        .rf-insp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(75, 85, 99, 0.4);
          padding-bottom: 8px;
        }

        .rf-insp-title {
          font-weight: 700;
          font-size: 14px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .rf-insp-count {
          font-size: 13px;
          background: #374151;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .rf-pattern-card {
          background: rgba(31, 41, 55, 0.7);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid rgba(107, 114, 128, 0.3);
        }

        .rf-pattern-name {
          font-size: 16px;
          font-weight: 700;
          color: #38bdf8;
          margin-bottom: 4px;
        }

        .rf-pattern-status {
          font-size: 12px;
          font-weight: 600;
          color: #22c55e;
          display: inline-block;
          margin-bottom: 8px;
        }

        .rf-pattern-nearmatch {
          color: #f59e0b;
        }

        .rf-reward-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin: 10px 0;
          background: rgba(17, 24, 39, 0.6);
          padding: 8px;
          border-radius: 6px;
          text-align: center;
        }

        .rf-reward-val {
          font-size: 15px;
          font-weight: 700;
        }

        .rf-reward-lbl {
          font-size: 10px;
          color: #9ca3af;
          text-transform: uppercase;
        }

        .rf-action-btn-primary {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .rf-btn-bind {
          background: linear-gradient(135deg, #a855f7, #7e22ce);
          color: #ffffff;
          box-shadow: 0 0 16px rgba(168, 85, 247, 0.4);
        }

        .rf-btn-bind:hover {
          background: linear-gradient(135deg, #c084fc, #9333ea);
        }

        .rf-btn-submit {
          background: linear-gradient(135deg, #0284c7, #0369a1);
          color: #ffffff;
          box-shadow: 0 0 16px rgba(2, 132, 199, 0.4);
        }

        .rf-btn-submit:hover {
          background: linear-gradient(135deg, #38bdf8, #0284c7);
        }
      </style>

      <div class="rf-inspector" id="inspector-root">
        <!-- Rendered dynamically -->
      </div>
    `;
  }

  update(): void {
    const root = this.container.querySelector('#inspector-root');
    if (!root) return;

    const state = this.store.getState();
    const selectedCount = state.selectedBlockIds.length;
    const analysis = state.lastAnalysis;

    if (selectedCount === 0) {
      root.innerHTML = `
        <div class="rf-insp-header">
          <div class="rf-title">Selection</div>
          <div class="rf-insp-count">0 Blocks</div>
        </div>
        <div class="rf-pattern-card" style="text-align:center; color:#9ca3af; font-size:13px;">
          Select Loose Blocks on the Field to Analyze, Bind, or Submit.
        </div>
      `;
      return;
    }

    const selectedLooseBlocks = state.selectedBlockIds
      .map(id => state.blocks[id])
      .filter((b): b is Block => Boolean(b) && b.state === 'Loose');

    const looseCount = selectedLooseBlocks.length;

    let contentHTML = `
      <div class="rf-insp-header">
        <div class="rf-title">Selection</div>
        <div class="rf-insp-count">${looseCount} Loose Blocks</div>
      </div>
    `;

    if (!analysis || !analysis.isValid) {
      const clue = analysis?.nearMatchReason || 'No valid pattern recognized.';
      contentHTML += `
        <div class="rf-pattern-card">
          <div class="rf-pattern-name" style="color:#f59e0b;">Near-Match Clue</div>
          <div class="rf-pattern-status rf-pattern-nearmatch">INVALID ARRANGEMENT</div>
          <div style="font-size:13px; line-height:1.4; color:#d1d5db;">
            ${clue}
          </div>
        </div>
      `;
    } else if (analysis.patternId === 'heart_seal') {
      contentHTML += `
        <div class="rf-pattern-card" style="border-color:#a855f7;">
          <div class="rf-pattern-name" style="color:#c084fc;">Pattern Detected</div>
          <div style="font-size:18px; font-weight:800; color:#f3f4f6; margin-bottom:4px;">HEART SEAL</div>
          <div class="rf-pattern-status" style="color:#c084fc;">OPENING ENGINE BIND</div>
          <div style="font-size:12px; color:#9ca3af; margin-bottom:12px;">
            Arrangement occupies all 16 Cradle cells. Binding crystallizes starter blocks into the persistent Heart Engine generator.
          </div>
          <button class="rf-action-btn-primary rf-btn-bind" id="btn-bind-action">
            BIND HEART SEAL
          </button>
        </div>
      `;
    } else if (analysis.patternId === 'compression_press' || analysis.patternId === 'twin_stars') {
      const rewards = calculateRecipeReward(selectedLooseBlocks, analysis.quality);
      contentHTML += `
        <div class="rf-pattern-card">
          <div class="rf-pattern-name">${analysis.patternName}</div>
          <div class="rf-pattern-status">${rewards.qualityTier.toUpperCase()} QUALITY (${Math.round(analysis.quality * 100)}%)</div>
          
          <div class="rf-reward-grid">
            <div>
              <div class="rf-reward-val" style="color:#f97316;">+${rewards.ash}</div>
              <div class="rf-reward-lbl">Ash</div>
            </div>
            <div>
              <div class="rf-reward-val" style="color:#38bdf8;">+${rewards.shards}</div>
              <div class="rf-reward-lbl">Shards</div>
            </div>
            <div>
              <div class="rf-reward-val" style="color:#c084fc;">+${rewards.engineXp}</div>
              <div class="rf-reward-lbl">Engine XP</div>
            </div>
          </div>

          <div style="font-size:11px; color:#ef4444; margin-bottom:10px; text-align:center;">
            ⚠️ Submitted Loose Blocks will be consumed and removed from Field.
          </div>

          <button class="rf-action-btn-primary rf-btn-submit" id="btn-submit-action">
            SUBMIT ${looseCount} BLOCKS
          </button>
        </div>
      `;
    }

    root.innerHTML = contentHTML;

    // Attach Action Listeners
    root.querySelector('#btn-bind-action')?.addEventListener('click', () => {
      const res = this.store.bindEngine();
      if (!res.success) {
        alert(res.error || 'Failed to bind engine.');
      }
    });

    root.querySelector('#btn-submit-action')?.addEventListener('click', () => {
      const res = this.store.submitRecipe();
      if (!res.success) {
        alert(res.error || 'Failed to submit recipe.');
      }
    });
  }
}
