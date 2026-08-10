/**
 * HL;BM — Rune Foundry
 * Browser composition root and application entry point.
 * Wires platform storage, game clock, application store, and Canvas UI together.
 */

import { AppStore } from './application/store.ts';
import { GameClock, loadGameState, saveGameState } from './platform/index.ts';
import { UIController } from './ui/index.ts';

function main(): void {
  const rootApp = document.getElementById('app');
  if (!rootApp) {
    console.error('Root #app element not found in DOM.');
    return;
  }

  // 1. Load saved state if present
  const savedState = loadGameState();
  const store = new AppStore(savedState || undefined);

  // 2. Attach persistence listener
  store.onSave(state => {
    saveGameState(state);
  });

  // Save on consequential actions, then cover browser lifecycle exits. The
  // visibility event belongs to document; pagehide remains the hard fallback.
  const saveNow = () => saveGameState(store.getState());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);

  // 3. Start game clock for engine production ticks
  const clock = new GameClock(deltaSeconds => {
    store.tick(deltaSeconds);
  });
  clock.start();

  // 4. Mount UI
  new UIController(rootApp, store);

  console.log('HL;BM — Rune Foundry initialized successfully.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
