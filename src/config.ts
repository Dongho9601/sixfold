/** Prototype defaults. Gold values are decimal strings so no Number conversion loses precision. */
export const CONFIG = {
  title: "Sixfold",
  startingGold: "100",
  rollsPerRun: 100,
  minimumWager: "1",
  selectedWager: "10",
  probabilityFloor: 0.02,
  // Indexed by the board's Tilt before the roll, from level 1 through 6.
  // Tuned with scripts/tune-tilt.ts; see docs/PROBABILITY_MODEL.md.
  transferRates: [
    { min: 0.04, max: 0.08 },
    { min: 0.042, max: 0.084 },
    { min: 0.044, max: 0.088 },
    { min: 0.046, max: 0.092 },
    { min: 0.048, max: 0.096 },
    { min: 0.05, max: 0.10 },
  ],
  // Effective-outcome cutoffs, from nearly even to strongly concentrated.
  // Split the old middle band; the former levels 4 and 5 become 5 and 6.
  tiltThresholds: [5.4, 4.8, 4.5, 4.2, 3.6],
  multipliers: { number: 6, row: 2, column: 3, color: 2, jackpot: 24 },
  animationMs: 1100,
  replacementMs: 800,
  leaderboardLimit: 10,
  syncIntervalMs: 5000,
  port: 5173,
} as const;

/** All coverage is derived from this explicit board; order within a row is visual order. */
export const BOARD = [
  [
    { number: 1, color: "red" },
    { number: 3, color: "black" },
    { number: 5, color: "red" },
  ],
  [
    { number: 2, color: "black" },
    { number: 4, color: "red" },
    { number: 6, color: "black" },
  ],
] as const;

export interface BetTarget {
  id: string;
  label: string;
  kind: "number" | "row" | "column" | "color";
  coverage: number[];
  multiplier: number;
}

export const TARGETS: BetTarget[] = [
  ...BOARD.flat().map((cell) => ({
    id: `n${cell.number}`,
    label: `Number ${cell.number}`,
    kind: "number" as const,
    coverage: [cell.number],
    multiplier: CONFIG.multipliers.number,
  })),
  ...BOARD.map((row, i) => ({
    id: `row${i}`,
    label: i === 0 ? "Top row" : "Bottom row",
    kind: "row" as const,
    coverage: row.map((c) => c.number),
    multiplier: CONFIG.multipliers.row,
  })),
  ...[0, 1, 2].map((i) => ({
    id: `col${i}`,
    label: `${["Left", "Middle", "Right"][i]} column`,
    kind: "column" as const,
    coverage: BOARD.map((row) => row[i].number),
    multiplier: CONFIG.multipliers.column,
  })),
  ...(["red", "black"] as const).map((color) => ({
    id: color,
    label: color === "red" ? "Red" : "Black",
    kind: "color" as const,
    coverage: BOARD.flat()
      .filter((c) => c.color === color)
      .map((c) => c.number)
      .sort((a, b) => a - b),
    multiplier: CONFIG.multipliers.color,
  })),
];

export const TARGET_BY_ID = new Map(TARGETS.map((t) => [t.id, t]));
