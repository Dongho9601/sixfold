import { describe, expect, it } from 'vitest';
import { AppStore } from '../src/application/store.ts';

describe('Bind & Submission Transactions', () => {
  it('should Bind Heart Seal without consuming constituent blocks', () => {
    const store = new AppStore();
    const state = store.getState();

    // Clear initial buffer blocks and place 4 I blocks to fill 4x4 Cradle
    state.blocks = {
      b1: { id: 'b1', shape: 'I', state: 'Loose', grade: 1, position: { x: 0, y: 0 }, rotation: 1 },
      b2: { id: 'b2', shape: 'I', state: 'Loose', grade: 1, position: { x: 1, y: 0 }, rotation: 1 },
      b3: { id: 'b3', shape: 'I', state: 'Loose', grade: 1, position: { x: 2, y: 0 }, rotation: 1 },
      b4: { id: 'b4', shape: 'I', state: 'Loose', grade: 1, position: { x: 3, y: 0 }, rotation: 1 },
    };

    store.selectAllLooseBlocks();
    const bindRes = store.bindEngine();

    expect(bindRes.success).toBe(true);
    expect(state.isHeartEngineBound).toBe(true);
    expect(state.heartEngine).not.toBeNull();

    // Check that bound blocks still exist on the board as 'Bound' Engine cells
    expect(state.blocks['b1'].state).toBe('Bound');
    expect(state.blocks['b2'].state).toBe('Bound');
    expect(state.blocks['b3'].state).toBe('Bound');
    expect(state.blocks['b4'].state).toBe('Bound');

    // Duplicate bind attempt should fail
    const dupBind = store.bindEngine();
    expect(dupBind.success).toBe(false);
  });

  it('should Submit Loose Blocks, consume them, and grant Ash, Shards, and Engine XP', () => {
    const store = new AppStore();
    const state = store.getState();

    // Setup a bound Heart Engine first so Engine XP can be awarded
    state.isHeartEngineBound = true;
    state.heartEngine = {
      id: 'engine-heart',
      name: 'Heart Engine',
      level: 1,
      xp: 0,
      quality: 1.0,
      accumulatedTimeSec: 0,
      constituentBlockIds: [],
    };

    // Place 2 touching Loose blocks outside Cradle for Compression Press
    state.blocks = {
      l1: { id: 'l1', shape: 'O', state: 'Loose', grade: 1, position: { x: 10, y: 10 }, rotation: 0 },
      l2: { id: 'l2', shape: 'O', state: 'Loose', grade: 1, position: { x: 12, y: 10 }, rotation: 0 },
    };

    store.selectAllLooseBlocks();
    const initialAsh = state.currencies.ash;
    const initialShards = state.currencies.shards;
    const initialXp = state.heartEngine.xp;

    const subRes = store.submitRecipe();

    expect(subRes.success).toBe(true);
    expect(subRes.reward).toBeDefined();

    // Selected Loose blocks must be consumed and removed from active blocks
    expect(state.blocks['l1']).toBeUndefined();
    expect(state.blocks['l2']).toBeUndefined();

    // Currencies and XP must increase
    expect(state.currencies.ash).toBeGreaterThan(initialAsh);
    expect(state.currencies.shards).toBeGreaterThan(initialShards);
    expect(state.heartEngine.xp).toBeGreaterThan(initialXp);
  });

  it('should prevent submitting Engine constituent cells', () => {
    const store = new AppStore();
    const state = store.getState();

    state.blocks = {
      e1: { id: 'e1', shape: 'I', state: 'Bound', grade: 1, position: { x: 0, y: 0 }, rotation: 1 },
      e2: { id: 'e2', shape: 'I', state: 'Bound', grade: 1, position: { x: 1, y: 0 }, rotation: 1 },
    };

    // Try selecting bound blocks
    store.selectBlock('e1', false);
    expect(state.selectedBlockIds).toHaveLength(0);

    expect(store.returnBlock('e1').success).toBe(false);

    const subRes = store.submitRecipe();
    expect(subRes.success).toBe(false);
  });
});
