/** Compact goal/Recipe sidebar and contextual Bind, Submit, Extract, and Grade actions. */

import { getShapeGradeUpgradeCost, SHAPE_TYPES, ShapeType } from '../core/index.ts';
import { AppStore } from '../application/store.ts';

export class InspectorPanel {
  private collapsed = false;

  constructor(
    private container: HTMLElement,
    private store: AppStore,
    private feedback: (message: string, isError?: boolean) => void = () => undefined,
  ) {
    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <style>
        .rf-sidebar {
          position: absolute; top: 14px; right: 14px; bottom: 92px; width: 260px;
          box-sizing: border-box; padding: 14px; overflow: auto; color: #b7b4ae;
          background: rgba(10,10,10,.9); border-left: 1px solid rgba(94,90,84,.56);
          font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
          pointer-events: auto; user-select: none; transition: transform 160ms ease;
        }
        .rf-sidebar.collapsed { transform: translateX(236px); overflow: hidden; }
        .rf-side-toggle { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
          border: 1px solid #4b4742; color: #b7b4ae; background: #121216; cursor: pointer; }
        .rf-side-title { margin: 0 36px 12px 0; color: #d6d1c8; font-size: 13px; letter-spacing: .13em; }
        .rf-step { margin-bottom: 10px; color: #e3b53c; font-size: 12px; font-weight: 800; letter-spacing: .08em; }
        .rf-goal-name { margin: 0 0 9px; color: #e4e0da; font-size: 17px; font-weight: 850; }
        .rf-seal-row { display:flex; align-items:center; gap:12px; margin: 8px 0 12px; }
        .rf-seal-grid { display:grid; grid-template-columns:repeat(4,10px); gap:2px; padding:5px; border:1px solid #80672d; }
        .rf-seal-grid i { width:10px; height:10px; background:#302a22; }
        .rf-seal-grid i.filled { background:#e3b53c; }
        .rf-goal-progress { color:#e3b53c; font-size:17px; font-weight:800; }
        .rf-teach { padding:9px 10px; margin: 9px 0 14px; border-left:2px solid #594563;
          background:rgba(89,69,99,.14); color:#d9b3df; font-size:12px; line-height:1.55; }
        .rf-transform { display:flex; align-items:center; gap:9px; margin-top:6px; color:#d9b3df; }
        .rf-loose-glyph { display:grid; grid-template-columns:repeat(2,7px); gap:2px; transform:rotate(45deg); }
        .rf-loose-glyph i { width:7px; height:7px; background:#8bbbc2; }
        .rf-engine-glyph { width:17px; height:17px; box-sizing:border-box; border:2px solid #b78dbc; transform:rotate(45deg); }
        .rf-section { margin-top:16px; padding-top:12px; border-top:1px solid rgba(94,90,84,.38); }
        .rf-section-title { margin:0 0 9px; color:#8e8981; font-size:11px; letter-spacing:.14em; }
        .rf-recipe { display:grid; grid-template-columns:34px 1fr; gap:9px; padding:9px 0; border-bottom:1px solid rgba(94,90,84,.24); }
        .rf-recipe.active { color:#eef0df; background:rgba(80,96,71,.12); }
        .rf-recipe-name { color:#d6d1c8; font-size:12px; font-weight:850; letter-spacing:.04em; }
        .rf-recipe-rule,.rf-recipe-outcome { margin-top:3px; font-size:11px; color:#8e8981; line-height:1.4; }
        .rf-recipe-outcome { color:#9aac83; }
        .rf-topology { position:relative; display:block; width:30px; height:28px; }
        .rf-topology i { position:absolute; width:7px; height:7px; background:#8bbbc2; }
        .rf-compress i:nth-child(1){left:1px;top:10px}.rf-compress i:nth-child(2){left:9px;top:10px}
        .rf-compress i:nth-child(3){left:17px;top:10px}.rf-compress i:nth-child(4){left:9px;top:2px}
        .rf-compress i:nth-child(5){left:9px;top:18px}
        .rf-twins i:first-child{left:0;top:5px;box-shadow:7px 0 #e3b53c,0 7px #e3b53c,7px 7px #e3b53c;background:#e3b53c}
        .rf-twins i:last-child{left:17px;top:13px;box-shadow:7px 0 #dc8151,0 7px #dc8151,7px 7px #dc8151;background:#dc8151}
        .rf-actions { display:flex; gap:7px; margin-top:10px; }
        .rf-action { flex:1; min-height:38px; border:0; font:inherit; font-size:11px; font-weight:900;
          letter-spacing:.07em; cursor:pointer; background:#e3b53c; color:#0a0a0a; }
        .rf-action:hover:not(:disabled){filter:brightness(1.15)} .rf-action:disabled{opacity:.35;cursor:not-allowed}
        .rf-submit{background:#8bbbc2}.rf-extract{background:#b78dbc}.rf-bind{background:#e3b53c}
        .rf-engine-card { padding:10px; border:1px solid #594563; background:rgba(89,69,99,.12); }
        .rf-engine-name { color:#d9b3df; font-size:13px; font-weight:850; }
        .rf-engine-meta { margin-top:4px; color:#8d7e91; font-size:11px; }
        .rf-grade-row { display:grid; grid-template-columns:22px 1fr auto; align-items:center; gap:8px; min-height:32px; }
        .rf-grade-shape { font-weight:900; color:#d6d1c8; }.rf-grade-label{font-size:11px;color:#9a958d}
        .rf-upgrade { min-width:78px; height:27px; border:1px solid #53666d; color:#8bbbc2; background:transparent;
          font:inherit; font-size:10px; cursor:pointer; }.rf-upgrade:disabled{opacity:.3;cursor:not-allowed}
        @media(max-width:760px){
          .rf-sidebar{top:8px;right:8px;bottom:70px;width:min(280px,calc(100vw - 16px));}
          .rf-sidebar.collapsed{transform:translateX(calc(100% - 34px));}
        }
      </style>
      <aside class="rf-sidebar" id="rf-sidebar" aria-label="Goals and Recipes">
        <button class="rf-side-toggle" id="rf-side-toggle" type="button" aria-label="Collapse goals">›</button>
        <h2 class="rf-side-title">GOAL</h2>
        <div id="rf-goal"></div>
        <div id="rf-contextual"></div>
        <section class="rf-section" id="rf-recipes"></section>
        <section class="rf-section" id="rf-grades"></section>
      </aside>
    `;

    this.container.querySelector('#rf-side-toggle')?.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      this.update();
    });
    this.container.addEventListener('click', event => this.onAction(event));
  }

  private onAction(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'bind') {
      const result = this.store.bindEngine();
      if (result.success && result.engine) this.feedback(`ENGINE → ${result.engine.nextShape}`);
      else this.feedback('BIND FAILED', true);
    } else if (action === 'submit') {
      const result = this.store.submitRecipe();
      if (result.success && result.reward) this.feedback(`SUBMIT → +${result.reward.ash} ASH`);
      else this.feedback('SUBMIT FAILED', true);
    } else if (action === 'extract') {
      const result = this.store.extractEngine();
      if (result.success) this.feedback(`EXTRACT → +${result.shards} SHARDS`);
      else this.feedback(result.error || 'EXTRACT FAILED', true);
    } else if (action === 'upgrade') {
      const shape = target.dataset.shape as ShapeType;
      const result = this.store.upgradeShape(shape);
      if (result.success) this.feedback(`${shape} GRADE ${result.grade}`);
      else this.feedback(result.error || 'UPGRADE FAILED', true);
    }
  }

  update(): void {
    const state = this.store.getState();
    const sidebar = this.container.querySelector('#rf-sidebar') as HTMLElement | null;
    const toggle = this.container.querySelector('#rf-side-toggle') as HTMLButtonElement | null;
    const goal = this.container.querySelector('#rf-goal');
    const contextual = this.container.querySelector('#rf-contextual');
    const recipes = this.container.querySelector('#rf-recipes');
    const grades = this.container.querySelector('#rf-grades');
    if (!sidebar || !toggle || !goal || !contextual || !recipes || !grades) return;
    sidebar.classList.toggle('collapsed', this.collapsed);
    toggle.textContent = this.collapsed ? '‹' : '›';
    toggle.setAttribute('aria-label', this.collapsed ? 'Open goals' : 'Collapse goals');

    const preview = this.store.getPatternActionPreview();
    if (!state.isHeartEngineBound) {
      const count = preview.analysis?.patternId === 'heart_seal' ? preview.analysis.metrics.cellCount : 0;
      const missing = new Set(preview.analysis?.patternId === 'heart_seal'
        ? (preview.analysis.missingCells || []).map(cell => `${cell.x},${cell.y}`)
        : Array.from({ length: 16 }, (_, index) => `${index % 4},${Math.floor(index / 4)}`));
      goal.innerHTML = `
        <div class="rf-step">1. BUILD</div><div class="rf-goal-name">HEART SEAL</div>
        <div class="rf-seal-row"><span class="rf-seal-grid">${Array.from({ length: 16 }, (_, index) => `<i class="${missing.has(`${index % 4},${Math.floor(index / 4)}`) ? '' : 'filled'}"></i>`).join('')}</span>
        <span class="rf-goal-progress">${count} / 16</span></div>
        <div class="rf-teach">${preview.canBind ? `2. BIND → ENGINE<br>KEEP ON FIELD${transformDiagram()}` : 'FILL THE 4×4 SEAL'}</div>`;
    } else {
      goal.innerHTML = `<div class="rf-step">BUILD A PATTERN</div><div class="rf-goal-name">CHOOSE YOUR OUTCOME</div>`;
    }

    const inspection = this.store.getEngineInspection();
    if (inspection) {
      contextual.innerHTML = `<div class="rf-engine-card">
        <div class="rf-engine-name">${inspection.foundational ? '♥ ' : '◇ '}${escapeHtml(inspection.name)}</div>
        <div class="rf-engine-meta">NEXT ${inspection.nextShape} · Q ${Math.round(inspection.quality * 100)}%</div>
        ${inspection.extractable
          ? `<div class="rf-teach">${state.learnedActions.extract ? 'CONSUME ENGINE' : 'EXTRACT → SHARDS<br>PRODUCTION DISAPPEARS'}</div>
             <div class="rf-actions"><button class="rf-action rf-extract" data-action="extract">EXTRACT +${inspection.shards}</button></div>`
          : '<div class="rf-teach">FOUNDATIONAL · CANNOT EXTRACT</div>'}
      </div>`;
    } else if (preview.analysis?.isValid && (preview.canBind || preview.canSubmit)) {
      const firstChoice = !state.learnedActions.submit;
      contextual.innerHTML = `
        <div class="rf-teach">${firstChoice ? `BIND → ENGINE (KEEP)${transformDiagram()}<br>SUBMIT → ASH (CONSUME)` : escapeHtml(preview.analysis.patternName)}</div>
        <div class="rf-actions">
          ${preview.canBind ? '<button class="rf-action rf-bind" data-action="bind">BIND → ENGINE</button>' : ''}
          ${preview.canSubmit ? `<button class="rf-action rf-submit" data-action="submit">SUBMIT +${preview.reward?.ash || 0}</button>` : ''}
        </div>`;
    } else if (state.currencies.shards > 0 && !state.learnedActions.upgrade) {
      contextual.innerHTML = '<div class="rf-teach">SHARDS → GRADE ↑<br>STRONGER BLOCKS</div>';
    } else {
      contextual.innerHTML = '';
    }

    recipes.innerHTML = state.isHeartEngineBound ? `
      <h3 class="rf-section-title">RECIPES</h3>
      ${recipeCard('compression_press', 'COMPRESSION', '4–10 connected', preview.analysis?.patternId === 'compression_press')}
      ${recipeCard('twin_stars', 'TWIN STARS', 'same size · separated', preview.analysis?.patternId === 'twin_stars')}
    ` : '<h3 class="rf-section-title">OPENING RECIPE</h3><div class="rf-recipe-outcome">HEART SEAL · exact 4×4</div>';

    grades.innerHTML = `<h3 class="rf-section-title">BLOCK GRADES · SHARDS</h3>${SHAPE_TYPES.map(shape => {
      const grade = state.shapeGrades[shape];
      const cost = getShapeGradeUpgradeCost(grade);
      return `<div class="rf-grade-row"><span class="rf-grade-shape">${shape}</span><span class="rf-grade-label">Grade ${grade}</span>
        <button class="rf-upgrade" data-action="upgrade" data-shape="${shape}" ${state.currencies.shards < cost ? 'disabled' : ''} aria-label="Upgrade ${shape} to Grade ${grade + 1} for ${cost} Shards">↑ ${cost} ◆</button></div>`;
    }).join('')}`;
  }
}

function recipeCard(id: string, name: string, rule: string, active: boolean): string {
  const icon = id === 'compression_press'
    ? '<span class="rf-topology rf-compress"><i></i><i></i><i></i><i></i><i></i></span>'
    : '<span class="rf-topology rf-twins"><i></i><i></i></span>';
  return `<article class="rf-recipe ${active ? 'active' : ''}" tabindex="0" aria-label="${name}, ${rule}, Bind to Engine or Submit for Ash">
    ${icon}<div><div class="rf-recipe-name">${name}</div><div class="rf-recipe-rule">${rule}</div><div class="rf-recipe-outcome">BIND → ENGINE<br>SUBMIT → ASH</div></div></article>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

function transformDiagram(): string {
  return '<span class="rf-transform" aria-label="Loose Pattern becomes Engine"><span class="rf-loose-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>→</b><span class="rf-engine-glyph" aria-hidden="true"></span></span>';
}
