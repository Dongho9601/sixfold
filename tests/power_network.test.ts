import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';
import { createInitialState, GameState } from '../src/application/state.ts';
import { loadGameState, saveGameState } from '../src/platform/storage.ts';
import {
  Block,
  createProductionBag,
  derivePoweredEngineIds,
  EngineState,
  getEnginePowerState,
  getProductionIntervalSec,
  ShapeType,
  stableEngineSeed,
} from '../src/core/index.ts';

interface EngineOptions {
  shape?: ShapeType;
  foundational?: boolean;
  state?: Block['state'];
  position?: { x: number; y: number } | null;
}

function makeEngine(
  id: string,
  blockIds: string[],
  foundational: boolean = false,
): EngineState {
  return {
    id,
    name: foundational ? 'Heart Engine' : `${id} Engine`,
    sourcePatternId: foundational ? 'heart_seal' : 'compression_press',
    sourcePatternName: foundational ? 'Heart Seal' : 'Compression Press',
    foundational,
    submittable: !foundational,
    quality: 1,
    boundValue: 16,
    accumulatedTimeSec: 0,
    constituentBlockIds: blockIds,
    ...createProductionBag(stableEngineSeed(id)),
  };
}

function addEngine(
  state: GameState,
  id: string,
  options: EngineOptions = {},
): void {
  const shape = options.shape || 'I';
  const blockId = `${id}-block`;
  const blockIds = options.position ? [blockId] : [];
  if (options.position) {
    state.blocks[blockId] = {
      id: blockId,
      shape,
      state: options.state || 'Bound',
      grade: 1,
      position: { ...options.position },
      rotation: 0,
    };
  }
  state.engines[id] = makeEngine(id, blockIds, options.foundational || false);
}

function topologyState(): GameState {
  const state = createInitialState();
  state.blocks = {};
  state.engines = {};
  state.heartEngineId = null;
  state.isHeartEngineBound = false;
  return state;
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

describe('Pass 3B Heart Power Network', () => {
  it('keeps the Heart powered as the root and powers a direct Engine', () => {
    const state = topologyState();
    addEngine(state, 'heart', { foundational: true, position: { x: 0, y: 0 } });
    addEngine(state, 'direct', { position: { x: 0, y: 1 } });
    state.heartEngineId = 'heart';
    state.isHeartEngineBound = true;

    const powered = derivePoweredEngineIds(state.engines, state.blocks, state.heartEngineId);
    expect(powered).toEqual(new Set(['heart', 'direct']));
    expect(getEnginePowerState('heart', state.engines, state.blocks, state.heartEngineId)).toBe('Powered');
    expect(getEnginePowerState('direct', state.engines, state.blocks, state.heartEngineId)).toBe('Powered');
  });

  it('relays Power through arbitrary Engine chains and leaves isolated Engines unpowered', () => {
    const state = topologyState();
    addEngine(state, 'heart', { foundational: true, position: { x: 0, y: 0 } });
    addEngine(state, 'a', { position: { x: 0, y: 1 } });
    addEngine(state, 'b', { position: { x: 0, y: 2 } });
    addEngine(state, 'isolated', { position: { x: 10, y: 0 } });
    state.heartEngineId = 'heart';

    expect(derivePoweredEngineIds(state.engines, state.blocks, state.heartEngineId))
      .toEqual(new Set(['heart', 'a', 'b']));
  });

  it('recomputes connectivity immediately when Bind creates a Bound Engine', () => {
    const store = new AppStore();
    const state = store.getState();
    state.blocks = Object.fromEntries([0, 1, 2, 3].map((x, index) => [
      `heart-${index}`,
      {
        id: `heart-${index}`,
        shape: 'I' as const,
        state: 'Loose' as const,
        grade: 1,
        position: { x, y: 0 },
        rotation: 1,
      },
    ]));
    store.selectAllLooseBlocks();
    expect(store.bindEngine().success).toBe(true);

    const ordinaryIds = [0, 1, 2, 3].map(index => `ordinary-${index}`);
    Object.assign(state.blocks, Object.fromEntries(ordinaryIds.map((id, index) => [id, {
      id,
      shape: 'O' as const,
      state: 'Loose' as const,
      grade: 1,
      position: { x: -2 + index * 2, y: 4 },
      rotation: 0,
    }])));
    store.selectBlocks(ordinaryIds);
    expect(store.bindEngine().success).toBe(true);
    expect(store.getEngineInspection('engine-1')?.powered).toBe(true);
  });

  it('does not conduct through Loose Blocks or diagonal contact', () => {
    const looseBridge = topologyState();
    addEngine(looseBridge, 'heart', { foundational: true, position: { x: 0, y: 0 } });
    addEngine(looseBridge, 'downstream', { position: { x: 0, y: 2 } });
    looseBridge.blocks['loose-bridge'] = {
      id: 'loose-bridge',
      shape: 'I',
      state: 'Loose',
      grade: 1,
      position: { x: 0, y: 1 },
      rotation: 0,
    };
    looseBridge.heartEngineId = 'heart';
    expect(derivePoweredEngineIds(looseBridge.engines, looseBridge.blocks, looseBridge.heartEngineId))
      .toEqual(new Set(['heart']));

    const diagonal = topologyState();
    addEngine(diagonal, 'heart', { foundational: true, position: { x: 0, y: 0 } });
    addEngine(diagonal, 'diagonal', { position: { x: 4, y: 1 } });
    diagonal.heartEngineId = 'heart';
    expect(derivePoweredEngineIds(diagonal.engines, diagonal.blocks, diagonal.heartEngineId))
      .toEqual(new Set(['heart']));
  });

  it('preserves Power through an alternate path when one bridge is submitted', () => {
    const state = topologyState();
    addEngine(state, 'heart', { foundational: true, shape: 'O', position: { x: 0, y: 0 } });
    addEngine(state, 'a', { shape: 'O', position: { x: 2, y: 0 } });
    addEngine(state, 'd', { shape: 'O', position: { x: 0, y: 2 } });
    addEngine(state, 'b', { shape: 'O', position: { x: 2, y: 2 } });
    state.heartEngineId = 'heart';
    state.isHeartEngineBound = true;

    const store = new AppStore(state);
    expect(store.getPoweredEngineIds()).toEqual(new Set(['heart', 'a', 'd', 'b']));
    expect(store.submitEngine('a').success).toBe(true);
    expect(store.getPoweredEngineIds()).toEqual(new Set(['heart', 'd', 'b']));
  });

  it('recomputes topology after bridge submission and disconnects downstream Engines', () => {
    const state = topologyState();
    addEngine(state, 'heart', { foundational: true, position: { x: 0, y: 0 } });
    addEngine(state, 'bridge', { position: { x: 0, y: 1 } });
    addEngine(state, 'downstream', { position: { x: 0, y: 2 } });
    state.heartEngineId = 'heart';
    state.isHeartEngineBound = true;

    const store = new AppStore(state);
    expect(store.getEngineInspection('downstream')?.powered).toBe(true);
    expect(store.submitEngine('bridge').success).toBe(true);
    expect(store.getEngineInspection('downstream')?.powered).toBe(false);
    expect(store.getPoweredEngineIds()).toEqual(new Set(['heart']));
  });

  it('produces nothing while unpowered and preserves fractional progress across reconnect', () => {
    const state = topologyState();
    addEngine(state, 'ordinary', { position: { x: 0, y: 0 } });
    const ordinary = state.engines.ordinary;
    const interval = getProductionIntervalSec(ordinary);
    ordinary.accumulatedTimeSec = interval * 0.35;
    const store = new AppStore(state);
    const beforeBuffers = structuredClone(store.getState().buffers);

    store.tick(interval * 20);
    expect(store.getState().engines.ordinary.accumulatedTimeSec).toBeCloseTo(interval * 0.35);
    expect(store.getState().buffers).toEqual(beforeBuffers);
    expect(store.getEngineInspection('ordinary')?.powered).toBe(false);
    expect(store.getEngineInspection('ordinary')?.progress).toBeCloseTo(0.35);

    addEngine(store.getState(), 'heart', { foundational: true, position: { x: 0, y: -1 } });
    store.getState().heartEngineId = 'heart';
    store.getState().isHeartEngineBound = true;
    store.tick(interval * 0.65);

    const outputs = store.drainVisualEvents().filter(event => event.type === 'production');
    expect(outputs).toHaveLength(1);
    if (outputs[0]?.type === 'production') {
      expect(outputs[0].outputs.filter(output => output.engineId === 'ordinary')).toHaveLength(1);
    }
    expect(store.getState().engines.ordinary.accumulatedTimeSec).toBeCloseTo(0);
  });

  it('does not turn disconnected elapsed time into a production backlog', () => {
    const state = topologyState();
    addEngine(state, 'ordinary', { position: { x: 0, y: 0 } });
    const interval = getProductionIntervalSec(state.engines.ordinary);
    state.engines.ordinary.accumulatedTimeSec = interval * 0.2;
    const store = new AppStore(state);

    store.tick(interval * 100);
    addEngine(store.getState(), 'heart', { foundational: true, position: { x: 0, y: -1 } });
    store.getState().heartEngineId = 'heart';
    store.getState().isHeartEngineBound = true;
    store.tick(interval * 0.8);

    const production = store.drainVisualEvents()
      .filter((event): event is Extract<typeof event, { type: 'production' }> => event.type === 'production');
    const ordinaryOutputs = production.flatMap(event => event.outputs.filter(output => output.engineId === 'ordinary'));
    expect(ordinaryOutputs).toHaveLength(1);
    expect(store.getState().engines.ordinary.accumulatedTimeSec).toBeCloseTo(0);
  });

  it('derives the same Power after save/load without persisting stale Power state', () => {
    mockStorage();
    const state = topologyState();
    addEngine(state, 'heart', { foundational: true, position: { x: 0, y: 0 } });
    addEngine(state, 'a', { position: { x: 0, y: 1 } });
    addEngine(state, 'b', { position: { x: 0, y: 2 } });
    state.heartEngineId = 'heart';
    state.isHeartEngineBound = true;
    const store = new AppStore(state);
    const before = store.getPoweredEngineIds();

    expect(saveGameState(store.getState())).toBe(true);
    const raw = localStorage.getItem('rune_foundry_save_v1')!;
    expect(raw).not.toContain('"powered"');

    const parsed = JSON.parse(raw) as GameState & {
      engines: Record<string, EngineState & { powered?: boolean }>;
    };
    parsed.engines.b.powered = false;
    localStorage.setItem('rune_foundry_save_v1', JSON.stringify(parsed));
    const reloaded = new AppStore(loadGameState()!);

    expect(reloaded.getPoweredEngineIds()).toEqual(before);
    expect((reloaded.getState().engines.b as EngineState & { powered?: boolean }).powered).toBeUndefined();
    expect(reloaded.getEngineInspection('b')?.powered).toBe(true);
  });
});
