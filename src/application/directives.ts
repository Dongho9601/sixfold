/**
 * Authored Foundry progression.
 *
 * This is deliberately a small state machine rather than a general quest
 * system. The current Directive and its completed milestones are persisted;
 * Power remains derived from the live Bound-cell topology.
 */

import {
  derivePowerNetwork,
  EngineState,
  getBlockOccupiedCells,
  isCradleCell,
} from '../core/index.ts';
import type { GameState } from './state.ts';

export const DIRECTIVE_IDS = [
  'bind_heart_seal',
  'bind_compression_engine',
  'submit_ordinary_engine',
  'upgrade_shape_grade_2',
  'rebuild_powered_engine',
  'stabilize_line',
  'frontier_seal',
] as const;

export type DirectiveId = typeof DIRECTIVE_IDS[number];

const DIRECTIVE_INDEX = new Map<DirectiveId, number>(
  DIRECTIVE_IDS.map((id, index) => [id, index]),
);

export interface DirectiveState {
  /** The only Directive presented as NOW. */
  currentId: DirectiveId;
  /** Authored milestones completed in deterministic sequence order. */
  completedIds: DirectiveId[];
  /** The one-time Core reward has been committed. */
  stabilizeLineCoreAwarded: boolean;
}

export interface DirectiveProductionOutput {
  engineId: string;
}

export interface DirectiveEvaluationContext {
  /** Outputs committed by the current production transition, if any. */
  productionOutputs?: readonly DirectiveProductionOutput[];
}

export interface DirectiveEvaluationResult {
  changed: boolean;
  awardedCore: boolean;
  completedIds: DirectiveId[];
  previousCurrentId: DirectiveId;
  currentId: DirectiveId;
}

export interface DirectivePresentation {
  currentId: DirectiveId;
  now: string;
  nowDetail: string;
  next: string;
  nextDetail: string;
}

interface DirectiveCopy {
  now: string;
  nowDetail: string;
  next: string;
  nextDetail: string;
}

const DIRECTIVE_COPY: Record<DirectiveId, DirectiveCopy> = {
  bind_heart_seal: {
    now: 'BIND HEART SEAL',
    nowDetail: 'FILL THE 4×4 CRADLE',
    next: 'BIND A COMPRESSION ENGINE',
    nextDetail: '4–10 CONNECTED BLOCKS',
  },
  bind_compression_engine: {
    now: 'BIND A COMPRESSION ENGINE',
    nowDetail: 'BUILD 4–10 CONNECTED BLOCKS',
    next: 'SUBMIT AN ORDINARY ENGINE',
    nextDetail: 'FREE ITS CELLS FOR REBUILDING',
  },
  submit_ordinary_engine: {
    now: 'SUBMIT AN ORDINARY ENGINE',
    nowDetail: 'CLAIM THE NORMAL SHARD PAYOUT',
    next: 'UPGRADE A SHAPE TO GRADE 2',
    nextDetail: 'SPEND 3 SHARDS',
  },
  upgrade_shape_grade_2: {
    now: 'UPGRADE A SHAPE TO GRADE 2',
    nowDetail: 'USE SHARDS ON ANY SHAPE',
    next: 'BUILD A POWERED ENGINE',
    nextDetail: 'KEEP AN ORDINARY ENGINE ON HEART POWER',
  },
  rebuild_powered_engine: {
    now: 'BUILD A POWERED ENGINE',
    nowDetail: 'KEEP AN ORDINARY ENGINE DIRECTLY POWERED BY HEART',
    next: 'STABILIZE THE LINE',
    nextDetail: 'POWER ENGINE B THROUGH ENGINE A',
  },
  stabilize_line: {
    now: 'STABILIZE THE LINE',
    nowDetail: 'POWER ENGINE B THROUGH ENGINE A',
    next: 'FRONTIER SEAL',
    nextDetail: '1 CORE · 12 SHARDS · FOUR I BLOCKS',
  },
  frontier_seal: {
    now: 'BUILD A FRONTIER SEAL',
    nowDetail: '1 CORE · 12 SHARDS · FOUR I BLOCKS',
    next: 'ACTIVATE IT AT THE FRONTIER',
    nextDetail: 'PASS 3E FRONTIER EXPANSION',
  },
};

export function createInitialDirectiveState(): DirectiveState {
  return {
    currentId: 'bind_heart_seal',
    completedIds: [],
    stabilizeLineCoreAwarded: false,
  };
}

function isDirectiveId(value: unknown): value is DirectiveId {
  return typeof value === 'string' && DIRECTIVE_INDEX.has(value as DirectiveId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Normalizes persisted directive data without inferring any new milestone. */
export function normalizeDirectiveState(value: unknown): DirectiveState {
  const source = isRecord(value) ? value : {};
  const currentId = isDirectiveId(source.currentId)
    ? source.currentId
    : isDirectiveId(source.current)
      ? source.current
      : 'bind_heart_seal';
  const rawCompleted = Array.isArray(source.completedIds)
    ? source.completedIds
    : Array.isArray(source.completedMilestones) ? source.completedMilestones : [];
  const completedIds = [...new Set(rawCompleted.filter(isDirectiveId))]
    .sort((left, right) => DIRECTIVE_INDEX.get(left)! - DIRECTIVE_INDEX.get(right)!);
  const stabilizeLineCoreAwarded = source.stabilizeLineCoreAwarded === true
    || source.coreAwarded === true;
  return { currentId, completedIds, stabilizeLineCoreAwarded };
}

function getHeartEngineId(state: GameState): string | null {
  if (state.heartEngineId && state.engines[state.heartEngineId]?.foundational) {
    return state.heartEngineId;
  }
  return Object.values(state.engines).find(engine => engine.foundational)?.id || null;
}

export function hasHeartEngine(state: GameState): boolean {
  const heartId = getHeartEngineId(state);
  return Boolean(heartId && state.engines[heartId]?.foundational);
}

function ordinaryEngines(state: GameState): EngineState[] {
  return Object.values(state.engines)
    .filter(engine => !engine.foundational)
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function hasCompressionEngine(state: GameState): boolean {
  return ordinaryEngines(state).some(engine =>
    engine.sourcePatternId === 'compression_press' || engine.sourcePatternName === 'Compression Press',
  );
}

export function hasSubmittedOrdinaryEngine(state: GameState): boolean {
  return state.learnedActions.submit === true;
}

export function hasGradeTwoShape(state: GameState): boolean {
  return Object.values(state.shapeGrades).some(grade => grade >= 2);
}

function isDirectlyConnectedToHeart(
  state: GameState,
  network: ReturnType<typeof derivePowerNetwork>,
  engineId: string,
): boolean {
  const heartId = getHeartEngineId(state);
  return Boolean(
    heartId
      && engineId !== heartId
      && network.poweredEngineIds.has(engineId)
      && network.connections.get(engineId)?.has(heartId),
  );
}

/** Ordinary Engines with a direct Bound-cell connection to the Heart root. */
export function getDirectHeartPoweredEngineIds(state: GameState): string[] {
  if (!hasHeartEngine(state)) return [];
  const network = derivePowerNetwork(state.engines, state.blocks, getHeartEngineId(state));
  return ordinaryEngines(state)
    .filter(engine => isDirectlyConnectedToHeart(state, network, engine.id))
    .map(engine => engine.id);
}

export function hasDirectHeartPoweredEngine(state: GameState): boolean {
  return getDirectHeartPoweredEngineIds(state).length > 0;
}

function isReachableWithout(
  network: ReturnType<typeof derivePowerNetwork>,
  rootId: string,
  targetId: string,
  excludedId: string,
): boolean {
  if (rootId === excludedId || targetId === excludedId) return false;
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const connectedId of network.connections.get(currentId) || []) {
      if (connectedId === excludedId || visited.has(connectedId)) continue;
      if (connectedId === targetId) return true;
      visited.add(connectedId);
      queue.push(connectedId);
    }
  }
  return false;
}

export interface StabilizeLinePair {
  /** The ordinary Engine directly connected to Heart. */
  engineAId: string;
  /** The ordinary Engine whose only root path runs through A. */
  engineBId: string;
}

/**
 * Finds every valid A/B relay pair in the current topology. No Engine ID or
 * coordinate is authored here; the graph cut check allows alternate layouts.
 */
export function getStabilizeLinePairs(state: GameState): StabilizeLinePair[] {
  const heartId = getHeartEngineId(state);
  if (!heartId || !hasHeartEngine(state)) return [];
  const network = derivePowerNetwork(state.engines, state.blocks, heartId);
  const poweredDirectIds = ordinaryEngines(state)
    .filter(engine => isDirectlyConnectedToHeart(state, network, engine.id))
    .map(engine => engine.id);
  const ordinary = ordinaryEngines(state);
  const pairs: StabilizeLinePair[] = [];

  for (const engineAId of poweredDirectIds) {
    for (const engineB of ordinary) {
      if (engineB.id === engineAId) continue;
      if (!network.poweredEngineIds.has(engineB.id)) continue;
      if (isDirectlyConnectedToHeart(state, network, engineB.id)) continue;
      if (isReachableWithout(network, heartId, engineB.id, engineAId)) continue;
      pairs.push({ engineAId, engineBId: engineB.id });
    }
  }
  return pairs;
}

export function isStabilizeLineConfigured(state: GameState): boolean {
  return getStabilizeLinePairs(state).length > 0;
}

export function isQualifyingStabilizeOutput(state: GameState, engineId: string): boolean {
  return getStabilizeLinePairs(state).some(pair => pair.engineBId === engineId);
}

function isEarlyDirectiveConditionMet(state: GameState, id: DirectiveId): boolean {
  switch (id) {
    case 'bind_heart_seal': return hasHeartEngine(state);
    // A persisted Submit-learning flag is also reliable evidence that an
    // ordinary Engine was previously Bound, even when that Engine's cells
    // have already been freed from the save.
    case 'bind_compression_engine': return hasCompressionEngine(state) || hasSubmittedOrdinaryEngine(state);
    case 'submit_ordinary_engine': return hasSubmittedOrdinaryEngine(state);
    case 'upgrade_shape_grade_2': return hasGradeTwoShape(state);
    case 'rebuild_powered_engine': return hasDirectHeartPoweredEngine(state);
    case 'stabilize_line':
    case 'frontier_seal':
      return false;
    default:
      return false;
  }
}

function markCompleted(state: GameState, id: DirectiveId): boolean {
  if (state.directive.completedIds.includes(id)) return false;
  state.directive.completedIds.push(id);
  state.directive.completedIds.sort((left, right) => DIRECTIVE_INDEX.get(left)! - DIRECTIVE_INDEX.get(right)!);
  return true;
}

function nextDirectiveId(id: DirectiveId): DirectiveId {
  const index = DIRECTIVE_INDEX.get(id)!;
  return DIRECTIVE_IDS[Math.min(DIRECTIVE_IDS.length - 1, index + 1)];
}

/**
 * Advances authored progression until the first unmet condition. Stabilize is
 * special: its Core reward is only committed when this call receives a real
 * production output from a qualifying relay Engine B.
 */
export function advanceDirectiveProgress(
  state: GameState,
  context: DirectiveEvaluationContext = {},
): DirectiveEvaluationResult {
  const previousCurrentId = state.directive.currentId;
  const completedBefore = state.directive.completedIds.length;
  let changed = false;
  let awardedCore = false;

  while (state.directive.currentId !== 'frontier_seal') {
    const currentId = state.directive.currentId;

    if (currentId === 'stabilize_line') {
      if (state.directive.stabilizeLineCoreAwarded) {
        changed = markCompleted(state, currentId) || changed;
        state.directive.currentId = nextDirectiveId(currentId);
        changed = true;
        continue;
      }

      const hasRelayOutput = (context.productionOutputs || [])
        .some(output => isQualifyingStabilizeOutput(state, output.engineId));
      if (!hasRelayOutput) break;

      state.directive.stabilizeLineCoreAwarded = true;
      state.currencies.cores += 1;
      markCompleted(state, currentId);
      state.directive.currentId = nextDirectiveId(currentId);
      changed = true;
      awardedCore = true;
      continue;
    }

    if (!isEarlyDirectiveConditionMet(state, currentId)) break;
    changed = markCompleted(state, currentId) || changed;
    const nextId = nextDirectiveId(currentId);
    if (nextId === currentId) break;
    state.directive.currentId = nextId;
    changed = true;
  }

  return {
    changed: changed || completedBefore !== state.directive.completedIds.length,
    awardedCore,
    completedIds: [...state.directive.completedIds],
    previousCurrentId,
    currentId: state.directive.currentId,
  };
}

/**
 * Legacy saves have no authored Directive state. Infer only conditions that
 * are directly represented by the saved state; never infer Stabilize's real
 * production event or its Core reward.
 */
export function inferDirectiveState(state: GameState): DirectiveState {
  const directive = createInitialDirectiveState();
  state.directive = directive;
  advanceDirectiveProgress(state);
  return state.directive;
}

export function getDirectivePresentation(state: GameState): DirectivePresentation {
  const copy = DIRECTIVE_COPY[state.directive.currentId] || DIRECTIVE_COPY.bind_heart_seal;
  return { currentId: state.directive.currentId, ...copy };
}

/** Readable alias for UI/application callers. */
export const getDirectiveView = getDirectivePresentation;

/** Counts the Loose cells currently filling the authored Heart Cradle. */
export function getHeartCradleProgress(state: GameState): { filled: number; total: number } {
  const occupied = new Set<string>();
  for (const block of Object.values(state.blocks)) {
    if (block.state !== 'Loose' || !block.position) continue;
    for (const cell of getBlockOccupiedCells(block.shape, block.position, block.rotation)) {
      if (isCradleCell(cell.x, cell.y)) occupied.add(`${cell.x},${cell.y}`);
    }
  }
  return { filled: Math.min(16, occupied.size), total: 16 };
}
