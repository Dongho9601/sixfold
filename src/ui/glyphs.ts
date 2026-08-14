import { getBlockOccupiedCells, ShapeType } from '../core/index.ts';

export function shapeGlyphMarkup(shape: ShapeType, className: string = 'rf-shape-glyph'): string {
  const cells = getBlockOccupiedCells(shape, { x: 0, y: 0 }, 0);
  return `<span class="${className}" data-shape="${shape}" aria-hidden="true">${cells
    .map(cell => `<i style="--rf-col:${cell.x + 1};--rf-row:${cell.y + 1}"></i>`)
    .join('')}</span>`;
}

export function actionIconMarkup(kind: 'bind' | 'return' | 'submit'): string {
  if (kind === 'return') {
    return '<svg class="rf-button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/></svg>';
  }
  if (kind === 'submit') {
    return '<svg class="rf-button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M13 7h4v4M7 13v4h4"/></svg>';
  }
  return '<svg class="rf-button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 5v8l-7 5-7-5V8l7-5Z"/><path d="m9 12 2 2 4-5"/></svg>';
}
