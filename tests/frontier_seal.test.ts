import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import {
  activateFrontierSeal,
  advanceDirectiveProgress,
  bindPattern,
  getFrontierSealPreview,
  getPatternActionPreview,
  getDirectivePresentation,
} from '../src/application/index.ts';
import { createInitialState, normalizeGameState, SAVE_VERSION } from '../src/application/state.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';
import {
  analyzeFrontierSeal,
  createProductionBag,
  getAdjacentLockedChunkIds,
  getOpeningUnlockedChunkIds,
  validateFrontierSeal,
  EngineState,
  stableEngineSeed,
} from '../src/core/index.ts';

type Point = { x: number; y: number };

function frontierBlocks(
  offset: Point = { x: 4, y: -2 },
  rotation: 0 | 1 = 1,
  prefix = 'seal',
) {
  const origins = rotation === 1
    ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 4 }, { x: 1, y: 4 }]
    : [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 }];
  return origins.map((origin, index) => {
    const id = `${prefix}-${index}`;
    return {
      id,
      shape: 'I' as const,
      state: 'Loose' as const,
      grade: 1,
      position: { x: offset.x + origin.x, y: offset.y + origin.y },
      rotation,
    };
  });
}

function sealState(targetChunkId: string | null = '6,-2') {
  const state = createInitialState();
  state.currencies = { cores: 1, shards: 12 };
  state.directive = {
    currentId: 'frontier_seal',
    completedIds: [
      'bind_heart_seal',
      'bind_compression_engine',
      'submit_ordinary_engine',
      'upgrade_shape_grade_2',
      'rebuild_powered_engine',
      'stabilize_line',
    ],
    stabilizeLineCoreAwarded: true,
  };
  state.blocks = Object.fromEntries(frontierBlocks().map(block => [block.id, block]));
  state.selectedBlockIds = Object.keys(state.blocks);
  state.selectedFrontierChunkId = targetChunkId;
  return state;
}

function engine(id: string, sourcePatternId = 'compression_press'): EngineState {
  return {
    id,
    name: id,
    sourcePatternId,
    sourcePatternName: sourcePatternId === 'twin_stars' ? 'Twin Stars' : 'Compression Press',
    foundational: false,
    submittable: true,
    quality: 1,
    boundValue: 16,
    accumulatedTimeSec: 0,
    constituentBlockIds: [],
    ...createProductionBag(stableEngineSeed(id)),
  };
}

function mockStorage(): void {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
    length: 0,
    key: () => null,
  } as Storage;
}

describe('Pass 3E Frontier Seal geometry and transaction', () => {
  it('accepts the canonical, translated, and 90-degree rotated four-I seal', () => {
    const opening = getOpeningUnlockedChunkIds();
    const canonical = frontierBlocks();
    expect(analyzeFrontierSeal(canonical)).toMatchObject({ valid: true, orientation: 'vertical' });
    expect(validateFrontierSeal(canonical, opening, '6,-2')).toMatchObject({ valid: true, validTarget: true, target: { contactCount: 4 } });

    const translated = frontierBlocks({ x: -2, y: -2 });
    expect(validateFrontierSeal(translated, opening, '-6,-2').valid).toBe(true);

    const rotated = frontierBlocks({ x: -2, y: -2 }, 0);
    expect(validateFrontierSeal(rotated, opening, '-2,-6').valid).toBe(true);
  });

  it('rejects malformed, gapped, overlapping, and extra-Block candidates', () => {
    const malformed = frontierBlocks();
    malformed[3].position = { x: 2, y: 2 };
    expect(analyzeFrontierSeal(malformed).valid).toBe(false);

    const overlapping = frontierBlocks();
    overlapping[3].position = { x: 1, y: 4 };
    expect(analyzeFrontierSeal(overlapping).valid).toBe(false);

    expect(analyzeFrontierSeal([...frontierBlocks(), ...frontierBlocks({ x: 20, y: 20 }, 1, 'extra')]).valid).toBe(false);
  });

  it('requires a locked, full-side-adjacent target and contacts with that exact target', () => {
    const opening = getOpeningUnlockedChunkIds();
    const blocks = frontierBlocks();
    expect(getAdjacentLockedChunkIds(opening)).toContain('6,-2');
    expect(validateFrontierSeal(blocks, opening, '2,-2').valid).toBe(false); // already unlocked
    expect(validateFrontierSeal(blocks, opening, '6,0').valid).toBe(false); // diagonal, not a full side
    expect(validateFrontierSeal(blocks, opening, '-6,-2').valid).toBe(false); // adjacent, but not touched
    expect(validateFrontierSeal(blocks, opening, '6,-2').target.contactCount).toBe(4);
  });

  it('keeps the exact four-I seal available as Compression while Frontier preview recognizes it', () => {
    const state = sealState('6,-2');
    state.isHeartEngineBound = true;
    const blockIds = Object.keys(state.blocks);
    const bindPreview = getPatternActionPreview(state, blockIds);
    const frontierPreview = getFrontierSealPreview(state, blockIds, '6,-2');

    expect(bindPreview.analysis).toMatchObject({ patternId: 'compression_press', isValid: true });
    expect(bindPreview.canBind).toBe(true);
    expect(frontierPreview.geometry.valid).toBe(true);
    expect(frontierPreview.target).toMatchObject({ valid: true, contactCount: 4 });

    const bindResult = bindPattern(state);
    expect(bindResult).toMatchObject({ success: true, engine: { sourcePatternId: 'compression_press' } });
  });

  it('only offers contactable targets and rejects impossible direct selection', () => {
    const state = sealState(null);
    const store = new AppStore(state);
    const preview = store.getFrontierSealPreview();

    expect(preview.targetOptions).toContain('6,-2');
    expect(preview.targetOptions).not.toContain('-6,-2');

    const before = state.selectedFrontierChunkId;
    expect(store.selectFrontierTarget('-6,-2').success).toBe(false);
    expect(state.selectedFrontierChunkId).toBe(before);

    expect(store.selectFrontierTarget('6,-2')).toEqual({ success: true, targetChunkId: '6,-2' });
    expect(state.selectedFrontierChunkId).toBe('6,-2');
  });

  it('previews requirements and leaves every field on failed activation unchanged', () => {
    const missingCore = sealState();
    missingCore.currencies.cores = 0;
    const beforeCore = structuredClone(missingCore);
    expect(getFrontierSealPreview(missingCore).canActivate).toBe(false);
    expect(activateFrontierSeal(missingCore)).toMatchObject({ success: false });
    expect(missingCore).toEqual(beforeCore);

    const missingShards = sealState();
    missingShards.currencies.shards = 11;
    const beforeShards = structuredClone(missingShards);
    expect(activateFrontierSeal(missingShards).success).toBe(false);
    expect(missingShards).toEqual(beforeShards);

    const wrongTarget = sealState('-6,-2');
    const beforeTarget = structuredClone(wrongTarget);
    expect(activateFrontierSeal(wrongTarget).success).toBe(false);
    expect(wrongTarget).toEqual(beforeTarget);
  });

  it('consumes exactly four Blocks, spends exact resources, and unlocks exactly one chunk', () => {
    const state = sealState();
    const store = new AppStore(state);
    const beforeChunks = [...state.unlockedChunks];
    expect(store.selectFrontierTarget('6,-2').success).toBe(true);
    const result = store.activateFrontierSeal();

    expect(result).toMatchObject({ success: true, targetChunkId: '6,-2', blockIds: ['seal-0', 'seal-1', 'seal-2', 'seal-3'] });
    expect(state.currencies).toEqual({ cores: 0, shards: 0 });
    expect(Object.keys(state.blocks)).toHaveLength(0);
    expect(state.unlockedChunks).toEqual([...beforeChunks, '6,-2']);
    expect(state.unlockedChunks).toHaveLength(beforeChunks.length + 1);
    expect(state.engines).toEqual({});
    expect(state.directive.currentId).toBe('build_expanded_twin_stars');
    expect(state.directive.completedIds).toContain('frontier_seal');
    expect(state.directive.frontierTargetChunkId).toBe('6,-2');
  });

  it('cannot repeat activation or double-spend after the chunk is open', () => {
    const store = new AppStore(sealState());
    expect(store.activateFrontierSeal().success).toBe(true);
    const after = structuredClone(store.getState());
    expect(store.activateFrontierSeal().success).toBe(false);
    expect(store.getState()).toEqual(after);
  });

  it('persists the unlocked chunk, consumed Blocks, resources, and Directive context', () => {
    mockStorage();
    const store = new AppStore(sealState());
    expect(store.activateFrontierSeal().success).toBe(true);
    expect(saveGameState(store.getState())).toBe(true);
    const reloaded = new AppStore(loadGameState()!).getState();
    expect(reloaded.unlockedChunks).toContain('6,-2');
    expect(reloaded.blocks).toEqual({});
    expect(reloaded.currencies).toEqual({ cores: 0, shards: 0 });
    expect(reloaded.directive.currentId).toBe('build_expanded_twin_stars');
    expect(reloaded.directive.frontierTargetChunkId).toBe('6,-2');
  });
});

describe('Pass 3E Directive gates', () => {
  it('does not complete rebuild from an old direct-powered Engine, but accepts a new Bind event', () => {
    const state = createInitialState();
    state.directive = {
      currentId: 'rebuild_powered_engine',
      completedIds: [
        'bind_heart_seal',
        'bind_compression_engine',
        'submit_ordinary_engine',
        'upgrade_shape_grade_2',
      ],
      stabilizeLineCoreAwarded: false,
    };
    const oldHeartBlock = { id: 'heart-cell', shape: 'I' as const, state: 'Bound' as const, grade: 1, position: { x: 0, y: 0 }, rotation: 0 };
    const oldEngineBlock = { id: 'old-cell', shape: 'O' as const, state: 'Bound' as const, grade: 1, position: { x: 0, y: 1 }, rotation: 0 };
    state.blocks = { 'heart-cell': oldHeartBlock, 'old-cell': oldEngineBlock };
    state.engines = {
      heart: { ...engine('heart'), foundational: true, submittable: false, constituentBlockIds: ['heart-cell'] },
      old: { ...engine('old'), constituentBlockIds: ['old-cell'] },
    };
    state.heartEngineId = 'heart';
    state.isHeartEngineBound = true;

    expect(advanceDirectiveProgress(state).currentId).toBe('rebuild_powered_engine');
    expect(state.directive.completedIds).not.toContain('rebuild_powered_engine');

    const newBlock = { id: 'new-cell', shape: 'O' as const, state: 'Bound' as const, grade: 1, position: { x: 2, y: 1 }, rotation: 0 };
    state.blocks[newBlock.id] = newBlock;
    state.engines.new = { ...engine('new'), constituentBlockIds: [newBlock.id] };
    expect(advanceDirectiveProgress(state, { boundEngineId: 'new' }).currentId).toBe('stabilize_line');
  });

  it('requires Twin Stars to use the recorded expanded chunk and old opening space', () => {
    const state = createInitialState();
    state.unlockedChunks.push('6,-2');
    state.directive = {
      currentId: 'build_expanded_twin_stars',
      completedIds: [...createInitialState().directive.completedIds, 'frontier_seal'],
      stabilizeLineCoreAwarded: true,
      frontierTargetChunkId: '6,-2',
    };
    state.isHeartEngineBound = true;
    state.heartEngineId = 'heart';
    state.engines.heart = { ...engine('heart'), foundational: true, submittable: false };

    const oldLayout = [
      { id: 'old-a', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 0, y: 4 }, rotation: 0 },
      { id: 'old-b', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 2, y: 4 }, rotation: 0 },
      { id: 'old-c', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 0, y: -2 }, rotation: 0 },
      { id: 'old-d', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 2, y: -2 }, rotation: 0 },
    ];
    state.blocks = Object.fromEntries(oldLayout.map(block => [block.id, block]));
    const oldStore = new AppStore(state);
    oldStore.selectBlocks(oldLayout.map(block => block.id));
    expect(oldStore.bindEngine().success).toBe(true);
    expect(oldStore.getState().directive.currentId).toBe('build_expanded_twin_stars');

    const expanded = createInitialState();
    expanded.unlockedChunks.push('6,-2');
    expanded.directive = {
      currentId: 'build_expanded_twin_stars',
      completedIds: ['frontier_seal'],
      stabilizeLineCoreAwarded: true,
      frontierTargetChunkId: '6,-2',
    };
    expanded.isHeartEngineBound = true;
    expanded.heartEngineId = 'heart';
    expanded.engines.heart = { ...engine('heart'), foundational: true, submittable: false };
    const expandedBlocks = [
      { id: 'new-a', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 6, y: -2 }, rotation: 0 },
      { id: 'new-b', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 8, y: -2 }, rotation: 0 },
      { id: 'base-a', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 0, y: 4 }, rotation: 0 },
      { id: 'base-b', shape: 'O' as const, state: 'Loose' as const, grade: 1, position: { x: 2, y: 4 }, rotation: 0 },
    ];
    expanded.blocks = Object.fromEntries(expandedBlocks.map(block => [block.id, block]));
    const expandedStore = new AppStore(expanded);
    expandedStore.selectBlocks(expandedBlocks.map(block => block.id));
    expect(expandedStore.bindEngine().success).toBe(true);
    expect(expandedStore.getState().directive.currentId).toBe('next_recipe_tier');
    expect(getDirectivePresentation(expandedStore.getState()).next).toBe('A DEEPER FRONTIER');
  });

  it('allows legacy migration to infer the direct-powered rebuild step', () => {
    const legacy = createInitialState();
    legacy.version = SAVE_VERSION - 1;
    legacy.directive = {
      currentId: 'rebuild_powered_engine',
      completedIds: [
        'bind_heart_seal',
        'bind_compression_engine',
        'submit_ordinary_engine',
        'upgrade_shape_grade_2',
      ],
      stabilizeLineCoreAwarded: false,
    };
    legacy.blocks = {
      h: { id: 'h', shape: 'I', state: 'Bound', grade: 1, position: { x: 0, y: 0 }, rotation: 0 },
      a: { id: 'a', shape: 'O', state: 'Bound', grade: 1, position: { x: 0, y: 1 }, rotation: 0 },
    };
    legacy.engines = {
      heart: { ...engine('heart'), foundational: true, submittable: false, constituentBlockIds: ['h'] },
      a: { ...engine('a'), constituentBlockIds: ['a'] },
    };
    legacy.heartEngineId = 'heart';
    legacy.isHeartEngineBound = true;
    const migrated = normalizeGameState(legacy);
    expect(migrated.directive.currentId).toBe('stabilize_line');
    expect(migrated.directive.completedIds).toContain('rebuild_powered_engine');
  });
});
