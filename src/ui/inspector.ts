import { getBlockOccupiedCells, getShapeGradeUpgradeCost, SHAPE_TYPES, ShapeType } from '../core/index.ts';
import { STARTER_RECIPES, RecipeDefinition } from '../content/starter.ts';
import { AppStore } from '../application/store.ts';
import { DIRECTIVE_IDS, DirectivePresentation, getHeartCradleProgress } from '../application/directives.ts';
import { SHAPE_COLORS } from './renderer.ts';
import { actionIconMarkup, shapeGlyphMarkup } from './glyphs.ts';
import { formatBatchReturnFeedback } from './hud.ts';

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
      <aside class="rf-sidebar" id="rf-sidebar" aria-label="Rune Foundry panel">
        <button class="rf-side-toggle" id="rf-side-toggle" type="button" aria-label="Collapse Foundry panel">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </button>
        <p class="rf-side-kicker">BLACK IRON WORKS</p>
        <h2 class="rf-side-title">Foundry Ledger</h2>
        <div id="rf-goal"></div>
        <div class="rf-contextual" id="rf-contextual"></div>
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
      if (result.success && result.engine) this.feedback(`ENGINE BOUND · NEXT ${result.engine.nextShape}`);
      else this.feedback('BIND FAILED', true);
    } else if (action === 'submit') {
      const result = this.store.submitEngine();
      if (result.success) this.feedback(`ENGINE SUBMITTED · +${result.shards} SHARDS`);
      else this.feedback(result.error || 'SUBMIT FAILED', true);
    } else if (action === 'return-selected') {
      const selectedIds = [...this.store.getState().selectedBlockIds];
      let returned = 0;
      let firstError = '';
      for (const blockId of selectedIds) {
        const result = this.store.returnBlock(blockId);
        if (result.success) returned += 1;
        else if (!firstError) firstError = result.error || 'RETURN FAILED';
      }
      const result = formatBatchReturnFeedback(returned, selectedIds.length, firstError);
      this.feedback(result.message, result.isError);
    } else if (action === 'upgrade') {
      const shape = target.dataset.shape as ShapeType;
      const result = this.store.upgradeShape(shape);
      if (result.success) this.feedback(`${shape} RUNE · GRADE ${result.grade}`);
      else this.feedback(result.error || 'UPGRADE FAILED', true);
    } else if (action === 'select-frontier') {
      const targetChunkId = target.dataset.chunk || null;
      const result = this.store.selectFrontierTarget(targetChunkId);
      if (!result.success) this.feedback(result.error || 'TARGET INVALID', true);
    } else if (action === 'activate-frontier') {
      const result = this.store.activateFrontierSeal();
      if (result.success) this.feedback(`FRONTIER OPENED · ${result.targetChunkId}`);
      else this.feedback(result.error || 'FRONTIER SEAL FAILED', true);
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
    toggle.setAttribute('aria-label', this.collapsed ? 'Open Foundry panel' : 'Collapse Foundry panel');
    toggle.setAttribute('aria-expanded', `${!this.collapsed}`);

    const preview = this.store.getPatternActionPreview();
    const directive = this.store.getDirectivePresentation();
    const frontier = this.store.getFrontierSealPreview();
    const cradleProgress = getHeartCradleProgress(state);
    const directiveProgress = state.directive.completedIds.length;
    if (directive.currentId === 'bind_heart_seal') {
      const missing = new Set(preview.analysis?.patternId === 'heart_seal'
        ? (preview.analysis.missingCells || []).map(cell => `${cell.x},${cell.y}`)
        : Array.from({ length: 16 }, (_, index) => `${index % 4},${Math.floor(index / 4)}`));
      goal.innerHTML = directiveMarkup(directive, directiveProgress, `
        <div class="rf-seal-row"><span class="rf-seal-grid">${Array.from({ length: 16 }, (_, index) => `<i class="${missing.has(`${index % 4},${Math.floor(index / 4)}`) ? '' : 'filled'}"></i>`).join('')}</span>
        <span class="rf-goal-progress">${cradleProgress.filled} / ${cradleProgress.total}</span></div>`);
    } else {
      goal.innerHTML = directiveMarkup(directive, directiveProgress);
    }

    const inspection = this.store.getEngineInspection();
    const selectedBlocks = state.selectedBlockIds.map(id => state.blocks[id]).filter(block => Boolean(block));
    if (directive.currentId === 'frontier_seal') {
      contextual.innerHTML = frontierMarkup(frontier, preview);
    } else if (inspection) {
      const powerLabel = inspection.powered
        ? inspection.productionPausedByStock
          ? 'POWERED · STOCK FULL'
          : inspection.foundational ? 'POWERED · HEART ROOT' : 'POWERED · PRODUCING'
        : 'UNPOWERED · PRODUCTION PAUSED';
      contextual.innerHTML = `<div class="rf-engine-chamber">
        <div class="rf-section-title">BOUND ENGINE</div>
        <div class="rf-engine-head">
          <span class="rf-engine-seal" aria-hidden="true"><i></i></span>
          <div><div class="rf-engine-name">${escapeHtml(inspection.name)}</div><div class="rf-engine-power ${inspection.powered ? 'powered' : 'unpowered'}">${powerLabel}</div></div>
        </div>
        <div class="rf-progress-row"><span class="rf-progress-track"><i style="--rf-progress:${Math.round(inspection.progress * 100)}%"></i></span><span class="rf-progress-value">${Math.round(inspection.progress * 100)}%</span></div>
        <div class="rf-engine-stats">
          <span class="rf-stat"><b>${inspection.nextShape}</b><span>NEXT RUNE</span></span>
          <span class="rf-stat"><b>${inspection.blocksPerMinute.toFixed(1)}</b><span>PER MIN</span></span>
          <span class="rf-stat"><b>${Math.round(inspection.quality * 100)}%</b><span>QUALITY</span></span>
        </div>
        <div class="rf-engine-meta">Stock ${inspection.stockUsed} / ${inspection.stockCapacity}</div>
        ${inspection.productionPausedByStock
          ? '<div class="rf-note warning">Stock is full. Progress is preserved until a Rune leaves stock.</div>'
          : inspection.powered ? '' : '<div class="rf-note warning">Reconnect this Engine to the Heart to resume preserved progress.</div>'}
        ${inspection.submittable
          ? `<div class="rf-note">Submitting ends production and reclaims its material value.</div>
             <div class="rf-actions"><button class="rf-action rf-action-danger" data-action="submit">${actionIconMarkup('submit')}SUBMIT · +${inspection.shards} SHARDS</button></div>`
          : '<div class="rf-note">Foundational Heart Engine · cannot be submitted.</div>'}
      </div>`;
    } else if (selectedBlocks.length > 0) {
      const first = selectedBlocks[0];
      const sameShape = selectedBlocks.every(block => block.shape === first.shape);
      const grades = [...new Set(selectedBlocks.map(block => block.grade))].sort((left, right) => left - right);
      const identity = selectedBlocks.length === 1 ? `${first.shape} Rune` : `${selectedBlocks.length} Rune Assembly`;
      const gradeLabel = grades.length === 1 ? `Grade ${grades[0]}` : `Grades ${grades.join(' / ')}`;
      const analysisLabel = preview.analysis && preview.analysis.patternId !== 'none'
        ? preview.analysis.isValid ? `${preview.analysis.patternName} is ready.` : preview.analysis.nearMatchReason
        : selectedBlocks.length === 1 ? 'Add Runes to form a Foundry pattern.' : 'No complete recipe detected.';
      contextual.innerHTML = `<div class="rf-selection-chamber">
        <div class="rf-section-title">${selectedBlocks.length === 1 ? 'SELECTED RUNE' : 'SELECTED ASSEMBLY'}</div>
        <div class="rf-selection-hero">
          <div class="rf-rune-portrait">${shapeGlyphMarkup(first.shape)}</div>
          <div><div class="rf-selection-name">${identity}</div><div class="rf-selection-level">${gradeLabel}${sameShape && selectedBlocks.length > 1 ? ` · ${first.shape} FAMILY` : ''}</div></div>
        </div>
        <div class="rf-selection-status">${escapeHtml(analysisLabel || 'Pattern incomplete.')}</div>
        <div class="rf-actions">
          ${preview.analysis?.isValid && preview.canBind ? `<button class="rf-action" data-action="bind">${actionIconMarkup('bind')}BIND ENGINE</button>` : ''}
          <button class="rf-action rf-action-secondary" data-action="return-selected">${actionIconMarkup('return')}RETURN${selectedBlocks.length > 1 ? ` ${selectedBlocks.length}` : ''}</button>
        </div>
      </div>`;
    } else if (preview.analysis?.isValid && preview.canBind) {
      contextual.innerHTML = `<div class="rf-selection-chamber">
        <div class="rf-section-title">PATTERN READY</div>
        <div class="rf-selection-name">${escapeHtml(preview.analysis.patternName)}</div>
        <div class="rf-selection-status">${state.learnedActions.bind ? 'The pattern can be crystallized into a production Engine.' : `Bind the loose pattern into an Engine.${transformDiagram()}`}</div>
        <div class="rf-actions"><button class="rf-action" data-action="bind">${actionIconMarkup('bind')}BIND ENGINE</button></div>
      </div>`;
    } else if (state.currencies.shards > 0 && !state.learnedActions.upgrade) {
      contextual.innerHTML = '<div class="rf-empty-selection">Shards temper Rune Grades. Choose an upgrade in the workshop below.</div>';
    } else {
      contextual.innerHTML = '<div class="rf-empty-selection">Select a loose Rune or a Bound Engine to inspect it. Shift-select or drag to assemble a pattern.</div>';
    }

    recipes.innerHTML = state.isHeartEngineBound ? `
      <h3 class="rf-section-title">FOUNDRY RECIPES</h3>
      ${recipeRow(STARTER_RECIPES['compression_press'], preview.analysis?.patternId === 'compression_press')}
      ${recipeRow(STARTER_RECIPES['twin_stars'], preview.analysis?.patternId === 'twin_stars')}
      ${recipeRow(STARTER_RECIPES['frontier_seal'], directive.currentId === 'frontier_seal' || frontier.geometry.valid)}
    ` : `
      <h3 class="rf-section-title">OPENING RECIPE</h3>
      ${recipeRow(STARTER_RECIPES['heart_seal'], preview.analysis?.patternId === 'heart_seal')}
    `;

    grades.innerHTML = `<h3 class="rf-section-title">RUNE GRADES</h3>${SHAPE_TYPES.map(shape => {
      const grade = state.shapeGrades[shape];
      const cost = getShapeGradeUpgradeCost(grade);
      return `<div class="rf-grade-row"><span class="rf-grade-shape">${shape}</span><span class="rf-grade-label">Grade ${grade}</span>
        <button class="rf-upgrade" data-action="upgrade" data-shape="${shape}" ${state.currencies.shards < cost ? 'disabled' : ''} aria-label="Upgrade ${shape} Rune to Grade ${grade + 1} for ${cost} Shards">TEMPER · ${cost}</button></div>`;
    }).join('')}`;
  }
}

function directiveMarkup(directive: DirectivePresentation, completedCount: number, context: string = ''): string {
  const currentIndex = Math.min(DIRECTIVE_IDS.length - 1, completedCount);
  const track = DIRECTIVE_IDS.map((_, index) => `<i class="${index < completedCount ? 'done' : index === currentIndex ? 'current' : ''}"></i>`).join('');
  return `<div class="rf-directive-label">CURRENT DIRECTIVE</div>
    <div class="rf-goal-name">${escapeHtml(directive.now)}</div>
    <div class="rf-directive-detail">${escapeHtml(directive.nowDetail)}</div>
    ${context}
    <div class="rf-objective-track" aria-label="${completedCount} of ${DIRECTIVE_IDS.length} directives completed">${track}</div>
    <div class="rf-next-block">
      <div class="rf-directive-label">NEXT</div>
      <div class="rf-next-name">${escapeHtml(directive.next)}</div>
      <div class="rf-next-detail">${escapeHtml(directive.nextDetail)}</div>
    </div>`;
}

function renderRecipePreview(recipe: RecipeDefinition): string {
  if (!recipe.previewBlocks || recipe.previewBlocks.length === 0) {
    return `<div class="rf-recipe-thumb" aria-hidden="true"><div class="rf-preview-grid" style="--rf-grid-cols:4;--rf-grid-rows:4;--rf-cell-size:5px">
      ${Array.from({ length: 16 }, (_, index) => `<i style="--rf-col:${index % 4 + 1};--rf-row:${Math.floor(index / 4) + 1};--rf-cell-fill:#80672d;--rf-cell-stroke:#d4b66d"></i>`).join('')}
    </div></div>`;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rawCells: Array<{ x: number; y: number; shape: ShapeType }> = [];
  for (const block of recipe.previewBlocks) {
    for (const pos of getBlockOccupiedCells(block.shape, block.position, block.rotation)) {
      rawCells.push({ x: pos.x, y: pos.y, shape: block.shape });
      minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
    }
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cellSize = Math.max(2, Math.floor(28 / Math.max(width, height)));
  const cellsHtml = rawCells.map(cell => {
    const colors = SHAPE_COLORS[cell.shape];
    return `<i style="--rf-col:${cell.x - minX + 1};--rf-row:${cell.y - minY + 1};--rf-cell-fill:${colors.fill};--rf-cell-stroke:${colors.stroke}"></i>`;
  }).join('');
  return `<div class="rf-recipe-thumb" aria-hidden="true"><div class="rf-preview-grid" style="--rf-grid-cols:${width};--rf-grid-rows:${height};--rf-cell-size:${cellSize}px">${cellsHtml}</div></div>`;
}

function recipeRow(recipe: RecipeDefinition, active: boolean): string {
  const tag = recipe.previewKind === 'example' ? '<div class="rf-recipe-tag">EXAMPLE FORM</div>' : '';
  const cleanRuleText = recipe.description.replace(/<br\s*\/?>/gi, ', ');
  const outcome = recipe.type === 'Bind' ? 'BIND → ENGINE' : recipe.type === 'Frontier' ? 'UNLOCK ONE 4×4 CHUNK' : 'EXACT 4×4 CRADLE';
  return `<article class="rf-recipe ${active ? 'active' : ''}" tabindex="0" aria-label="${recipe.name}, ${cleanRuleText}, ${outcome}">
    ${renderRecipePreview(recipe)}<div><div class="rf-recipe-name">${escapeHtml(recipe.name.toUpperCase())}</div>${tag}<div class="rf-recipe-rule">${recipe.description}</div><div class="rf-recipe-outcome">${outcome}</div></div></article>`;
}

function frontierMarkup(
  preview: ReturnType<AppStore['getFrontierSealPreview']>,
  bindPreview: ReturnType<AppStore['getPatternActionPreview']>,
): string {
  const geometryStatus = preview.geometry.valid ? 'VALID FOUR-I 2×8 SEAL' : escapeHtml(preview.geometry.reason || 'SELECT FOUR LOOSE I RUNES');
  const targetButtons = !preview.validGeometry
    ? '<div class="rf-frontier-status">Complete the Seal to reveal contactable frontier targets.</div>'
    : preview.targetOptions.length > 0
      ? preview.targetOptions.map(chunkId => {
        const selected = chunkId === preview.targetChunkId;
        const valid = selected && preview.target.valid;
        const contactLabel = selected ? `${preview.target.contactCount} / 4 CONTACTS` : 'SELECT TARGET';
        return `<button class="rf-frontier-target ${selected ? 'selected ' : ''}${valid ? 'valid' : ''}" data-action="select-frontier" data-chunk="${escapeHtml(chunkId)}" type="button"><span>CHUNK ${escapeHtml(chunkId)}</span><small>${contactLabel}</small></button>`;
      }).join('')
      : '<div class="rf-frontier-status">No adjacent locked chunk touches this Seal.</div>';
  const targetStatus = preview.targetChunkId && !preview.target.valid ? `<div class="rf-frontier-status">${escapeHtml(preview.target.reason || 'Target does not contact this Seal.')}</div>` : '';
  const bindAction = bindPreview.canBind && bindPreview.analysis
    ? `<div class="rf-note">${escapeHtml(bindPreview.analysis.patternName)} is also ready to Bind.</div><div class="rf-actions"><button class="rf-action" data-action="bind">${actionIconMarkup('bind')}BIND ENGINE</button></div>`
    : '';
  return `<div class="rf-frontier-chamber">
    <div class="rf-section-title">FRONTIER SEAL</div>
    <div class="rf-selection-name">Open the black-iron frontier</div>
    <div class="rf-frontier-status">${geometryStatus}</div>
    <div class="rf-frontier-cost"><span class="${preview.hasCore ? 'ready' : 'missing'}">CORE ${preview.hasCore ? '1 / 1' : '0 / 1'}</span><span class="${preview.hasShards ? 'ready' : 'missing'}">SHARDS ${preview.hasShards ? '12 / 12' : 'NEED 12'}</span></div>
    <div class="rf-frontier-targets">${targetButtons}</div>${targetStatus}${bindAction}
    <div class="rf-actions"><button class="rf-action" data-action="activate-frontier" ${preview.canActivate ? '' : 'disabled'}>${actionIconMarkup('bind')}ACTIVATE SEAL</button></div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

function transformDiagram(): string {
  return '<span class="rf-transform" aria-label="Loose Pattern becomes Engine"><span class="rf-loose-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>→</b><span class="rf-engine-glyph" aria-hidden="true"></span></span>';
}
