import { getBlockOccupiedCells, getShapeGradeUpgradeCost, SHAPE_TYPES, ShapeType } from '../core/index.ts';
import { STARTER_RECIPES, RecipeDefinition } from '../content/starter.ts';
import { AppStore } from '../application/store.ts';
import { SHAPE_COLORS } from './renderer.ts';

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
        .rf-recipe { display:grid; grid-template-columns:36px 1fr; gap:9px; padding:9px 0; border-bottom:1px solid rgba(94,90,84,.24); }
        .rf-recipe.active { color:#eef0df; background:rgba(80,96,71,.12); }
        .rf-recipe-thumb { width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.35); border:1px solid rgba(94,90,84,.32); border-radius:3px; padding:2px; box-sizing:border-box; }
        .rf-recipe-thumb.exact { border-color:rgba(227,181,60,.4); }
        .rf-recipe-tag { display:inline-block; font-size:9px; font-weight:900; letter-spacing:.08em; color:#8bbbc2; background:rgba(139,187,194,.14); padding:1px 4px; border-radius:2px; margin-top:2px; margin-bottom:2px; text-transform:uppercase; }
        .rf-recipe-name { color:#d6d1c8; font-size:12px; font-weight:850; letter-spacing:.04em; }
        .rf-recipe-rule,.rf-recipe-outcome { margin-top:3px; font-size:11px; color:#8e8981; line-height:1.4; }
        .rf-recipe-outcome { color:#9aac83; }
        .rf-actions { display:flex; gap:7px; margin-top:10px; }
        .rf-action { flex:1; min-height:38px; border:0; font:inherit; font-size:11px; font-weight:900;
          letter-spacing:.07em; cursor:pointer; background:#e3b53c; color:#0a0a0a; }
        .rf-action:hover:not(:disabled){filter:brightness(1.15)} .rf-action:disabled{opacity:.35;cursor:not-allowed}
        .rf-submit{background:#b78dbc}.rf-bind{background:#e3b53c}
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
      const result = this.store.submitEngine();
      if (result.success) this.feedback(`SUBMIT → +${result.shards} SHARDS`);
      else this.feedback(result.error || 'SUBMIT FAILED', true);
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
        <div class="rf-step">1. BUILD HEART SEAL</div>
        <div class="rf-seal-row"><span class="rf-seal-grid">${Array.from({ length: 16 }, (_, index) => `<i class="${missing.has(`${index % 4},${Math.floor(index / 4)}`) ? '' : 'filled'}"></i>`).join('')}</span>
        <span class="rf-goal-progress">${count} / 16</span></div>
        <div class="rf-teach">${preview.canBind ? `2. BIND → ENGINE${transformDiagram()}` : 'FILL THE 4×4 SEAL'}</div>`;
    } else {
      goal.innerHTML = `<div class="rf-step">RECIPES</div><div class="rf-goal-name">BUILD A PATTERN</div>`;
    }

    const inspection = this.store.getEngineInspection();
    if (inspection) {
      contextual.innerHTML = `<div class="rf-engine-card">
        <div class="rf-section-title">ENGINE</div>
        <div class="rf-engine-name">${inspection.foundational ? '♥ ' : '◇ '}${escapeHtml(inspection.name)}</div>
        <div class="rf-engine-meta">NEXT ${inspection.nextShape} · ${inspection.blocksPerMinute.toFixed(1)}/MIN · Q ${Math.round(inspection.quality * 100)}%</div>
        ${inspection.submittable
          ? `<div class="rf-teach">${state.learnedActions.submit ? 'PRODUCTION ENDS' : 'SUBMIT ENGINE → SHARDS<br>SHARDS → GRADE ↑'}</div>
             <div class="rf-actions"><button class="rf-action rf-submit" data-action="submit">SUBMIT ENGINE<br>+${inspection.shards} SHARDS</button></div>`
          : '<div class="rf-teach">FOUNDATIONAL · CANNOT SUBMIT</div>'}
      </div>`;
    } else if (preview.analysis?.isValid && preview.canBind) {
      contextual.innerHTML = `
        <div class="rf-teach">${state.learnedActions.bind ? escapeHtml(preview.analysis.patternName) : `BIND → ENGINE${transformDiagram()}`}</div>
        <div class="rf-actions">
          <button class="rf-action rf-bind" data-action="bind">BIND → ENGINE</button>
        </div>`;
    } else if (state.currencies.shards > 0 && !state.learnedActions.upgrade) {
      contextual.innerHTML = '<div class="rf-teach">SHARDS → GRADE ↑<br>STRONGER BLOCKS</div>';
    } else {
      contextual.innerHTML = '';
    }

    recipes.innerHTML = state.isHeartEngineBound ? `
      <h3 class="rf-section-title">RECIPES</h3>
      ${recipeCard(STARTER_RECIPES['compression_press'], preview.analysis?.patternId === 'compression_press')}
      ${recipeCard(STARTER_RECIPES['twin_stars'], preview.analysis?.patternId === 'twin_stars')}
    ` : `
      <h3 class="rf-section-title">OPENING RECIPE</h3>
      ${recipeCard(STARTER_RECIPES['heart_seal'], preview.analysis?.patternId === 'heart_seal')}
    `;

    grades.innerHTML = `<h3 class="rf-section-title">SHARDS → GRADE ↑</h3>${SHAPE_TYPES.map(shape => {
      const grade = state.shapeGrades[shape];
      const cost = getShapeGradeUpgradeCost(grade);
      return `<div class="rf-grade-row"><span class="rf-grade-shape">${shape}</span><span class="rf-grade-label">Grade ${grade}</span>
        <button class="rf-upgrade" data-action="upgrade" data-shape="${shape}" ${state.currencies.shards < cost ? 'disabled' : ''} aria-label="Upgrade ${shape} to Grade ${grade + 1} for ${cost} Shards">↑ ${cost} ◆</button></div>`;
    }).join('')}`;
  }
}

function renderRecipePreview(recipe: RecipeDefinition): string {
  if (recipe.previewKind === 'exact' || !recipe.previewBlocks || recipe.previewBlocks.length === 0) {
    return `<div class="rf-recipe-thumb exact" aria-hidden="true">
      <div class="rf-preview-grid" style="display:grid; grid-template-columns:repeat(4, 5px); grid-template-rows:repeat(4, 5px); gap:1px;">
        ${Array.from({ length: 16 }, () => `<i style="background:#e3b53c; border:1px solid #f1cc66; box-sizing:border-box;"></i>`).join('')}
      </div>
    </div>`;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const rawCells: Array<{ x: number; y: number; shape: ShapeType }> = [];
  for (const block of recipe.previewBlocks) {
    const occupied = getBlockOccupiedCells(block.shape, block.position, block.rotation);
    for (const pos of occupied) {
      rawCells.push({ x: pos.x, y: pos.y, shape: block.shape });
      if (pos.x < minX) minX = pos.x;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
    }
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const maxDim = Math.max(width, height);
  const cellSize = Math.max(2, Math.floor(28 / maxDim));

  const cellsHtml = rawCells.map(c => {
    const nx = c.x - minX;
    const ny = c.y - minY;
    const colors = SHAPE_COLORS[c.shape];
    return `<i style="grid-column:${nx + 1}; grid-row:${ny + 1}; background:${colors.fill}; border:1px solid ${colors.stroke}; box-sizing:border-box;"></i>`;
  }).join('');

  return `<div class="rf-recipe-thumb" aria-hidden="true">
    <div class="rf-preview-grid" style="display:grid; grid-template-columns:repeat(${width}, ${cellSize}px); grid-template-rows:repeat(${height}, ${cellSize}px); gap:1px;">
      ${cellsHtml}
    </div>
  </div>`;
}

function recipeCard(recipe: RecipeDefinition, active: boolean): string {
  const icon = renderRecipePreview(recipe);
  const tag = recipe.previewKind === 'example' ? '<div class="rf-recipe-tag">EXAMPLE</div>' : '';
  const isOrdinary = recipe.type === 'Bind';
  const cleanRuleText = recipe.description.replace(/<br\s*\/?>/gi, ', ');
  return `<article class="rf-recipe ${active ? 'active' : ''}" tabindex="0" aria-label="${recipe.name}, ${recipe.previewKind === 'example' ? 'EXAMPLE, ' : ''}${cleanRuleText}, ${isOrdinary ? 'Bind to Engine' : 'Fill 4x4 Cradle'}">
    ${icon}<div><div class="rf-recipe-name">${escapeHtml(recipe.name.toUpperCase())}</div>${tag}<div class="rf-recipe-rule">${recipe.description}</div><div class="rf-recipe-outcome">${isOrdinary ? 'BIND → ENGINE' : 'EXACT 4×4 CRADLE'}</div></div></article>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

function transformDiagram(): string {
  return '<span class="rf-transform" aria-label="Loose Pattern becomes Engine"><span class="rf-loose-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>→</b><span class="rf-engine-glyph" aria-hidden="true"></span></span>';
}
