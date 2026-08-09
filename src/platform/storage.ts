/**
 * Browser persistence adapter for HL;BM — Rune Foundry.
 * Saves and loads game state to localStorage with versioning and safe fallback.
 */

import { GameState } from '../application/state.ts';

const SAVE_KEY = 'rune_foundry_save_v1';

export function saveGameState(state: GameState): boolean {
  try {
    const payload = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, payload);
    return true;
  } catch (err) {
    console.warn('Failed to save game state to localStorage:', err);
    return false;
  }
}

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || typeof parsed !== 'object' || !parsed.version) {
      console.warn('Invalid save format found, starting fresh game.');
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn('Error reading save from localStorage, resetting:', err);
    return null;
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn('Failed to clear storage:', err);
  }
}
