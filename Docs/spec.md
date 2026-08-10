# HL;BM — Rune Foundry Specification

> **Canonical core:** Browser-first spatial incremental / pattern-construction game.

## 1. Core Loop

```text
Engine generates Blocks into buffers
→ place Loose Blocks from buffers to build Pattern
→ BIND Pattern into Engine
→ decide whether Engine is worth keeping
→ SUBMIT Engine for Shards
→ spend Shards on Shape Grades
→ stronger Blocks create stronger future Engines
```

The two player-facing actions are:

```text
BIND = turn a valid Loose Pattern into an Engine
SUBMIT = sacrifice an ordinary Bound Engine for Shards
```

Shards are the only global currency in the current core.

## 2. Opening and the Heart Engine

The opening inventory is one each of `I`, `O`, `L`, and `J` (with `T`, `S`, `Z` at count 0). The player fills the illuminated 4×4 Cradle (`x: 0..3, y: 0..3`) and must Bind the exact **Heart Seal**.

The resulting **Heart Engine** (`id: 'engine-heart'`) is unique, foundational, remains on the Field, cannot be Submitted (`submittable: false`), and ensures the player can never permanently lose all Block production. Until the Heart Engine exists, ordinary Recipes cannot be Bound. After it exists, all seven Shapes may be produced by Engines into inventory buffers.

## 3. Blocks and Placement

A Block is one tetromino occupying four orthogonally connected cells. Canonical physical hotkeys map to digit and numpad keys:

```text
1 = I   2 = O   3 = T   4 = L   5 = J   6 = S   7 = Z
```

Active states are **Buffered**, **Loose**, and **Bound**. Consumed or Submitted Blocks are removed rather than retained.

Placement is legal at any sparse grid coordinate `(x, y)` provided the shape has buffer inventory available (`buffer > 0`) and none of the shape's four occupied cells collide with existing Loose or Bound Field cells. The Field has no finite spatial boundaries, unlocked region limits, or locked expansion cells.

Shape buffers are unbounded with no total or per-shape capacity caps and no production backpressure.

### 3.1 Nearest-valid ghost

```text
desired origin
→ nearest legal origin within radius 3 (dx, dy ∈ [-3, 3])
→ squared-distance, then y/x deterministic tie-break
→ ghost shown at that origin
→ click places at exactly that origin
```

If no legal origin exists within radius 3, the ghost is marked invalid and no placement occurs. `KeyR` rotates the active spawn shape and `Escape` cancels active placement or clears selection.

### 3.2 Pointer priority

```text
multi-touch (2+ touches) → pan / zoom gesture
→ explicit pan (middle / right click, or left drag with Space)
→ existing Engine click → inspect Engine
→ existing Loose Block pointer-down → hold candidate (450 ms stationary → Return to buffer)
→ active Shape selected → place ghost at nearest legal origin
→ empty-field drag → rectangle select intersecting Loose Blocks (Shift adds)
→ empty-field click → clear selection and inspection
```

An Engine click always inspects the Engine. Pointer-down on a Loose Block begins a hold candidate. At 450 ms without movement, the Loose Block Returns to buffer inventory (`Delete`/`Backspace` also returns selected Loose Blocks). On a quick release, if an active spawn shape is selected and a valid ghost exists, a new Block is placed at the exact visible snapped ghost position; otherwise the clicked Loose Block is selected or toggled. Placement collision checks remain authoritative, so a new Block never overlaps an existing one.

Gameplay shortcuts use `KeyboardEvent.code`. Holding Ctrl, Meta, or Alt disables gameplay shortcut handling.

## 4. Patterns and Recipes

The Field automatically evaluates a bounded local Loose candidate (up to 12 Loose Blocks selected by Cradle or component proximity to recent placement). Explicit selection of Loose Blocks overrides the automatic local candidate. Before the Heart Engine exists, only the Heart Seal surfaces `BIND`. Afterward, valid ordinary candidate Patterns surface `BIND`.

| Recipe | Internal ID | Canonical rule | Quality formula | Bind result | Sidebar preview |
|---|---|---|---|---|---|
| Heart Seal | `heart_seal` | Exact fill of all 16 cells of the 4×4 Cradle (`x,y ∈ [0,3]`) | `1.0` | Foundational Heart Engine | Exact 4×4 target template |
| Compression Press | `compression_press` | 4–10 Loose Blocks in exactly 1 connected component | `0.50 + 0.50 × cohesion`, where `cohesion = sharedEdges / (2 × blockCount)` | Ordinary Engine | Example 4-block topology |
| Twin Stars | `twin_stars` | Exactly 2 connected components, equal Block counts, ≥ 2 Blocks each | `1.0 - |centroidDistance - 4.0| / 8.0`, clamped to `[0.5, 1.0]` | Ordinary Engine | Example 4-block twin topology |

Binding freezes exact candidate Block IDs, re-reads and revalidates them against Recipe rules, converts those Blocks to Bound without moving them, and creates one Engine.

## 5. Engines and Production

Every Engine persists its identity, constituent Block IDs, source Pattern, bound Quality, foundational/submittable flags, frozen `boundValue`, accumulated time, RNG state, 7-bag, and next Shape. Bound constituent Grades are snapshots taken at Bind time and remain immutable.

Each Engine independently owns a deterministically shuffled 7-bag containing `I O T L J S Z`. Production never consults inventory counts or `Math.random()`. The 7-bag is shuffled using `xorshift32` seeded deterministically via `stableEngineSeed(engineId)`.

```text
BlockValue(Grade) = 4 × 2^(Grade - 1)
boundValue = sum(BlockValue(bound constituent))
baselineValue = 4 Grade-1 Blocks = 16
MaterialMultiplier = sqrt(boundValue / 16)
QualityMultiplier = 0.75 + 0.50 × boundQuality
EnginePower = MaterialMultiplier × QualityMultiplier
BaseRate = 10 Blocks per minute
BlocksPerMinute = BaseRate × EnginePower
ProductionIntervalSec = 60 / BlocksPerMinute
```

The Heart Engine begins with 4 Grade-1 Blocks (`boundValue = 16`, `boundQuality = 1.0`), resulting in `MaterialMultiplier = 1.0`, `QualityMultiplier = 1.25`, `EnginePower = 1.25`, production rate of 12.5 Blocks per minute, and an initial production interval of 4.8 seconds.

Every existing Engine produces independently and continuously on every tick regardless of spatial position, distance, or connection to the Heart Engine. Generated Blocks enter shape buffer inventories directly.

Later global Shape Grade upgrades do not retroactively change an existing Engine's frozen `boundValue`, `quality`, production power, or Submit payout.

## 6. Bind and Submit

### Bind Pattern

- Available for the Heart Seal (when Heart Engine does not exist) and valid ordinary Recipes (when Heart Engine exists).
- Freezes and revalidates exact Loose Block IDs.
- Converts constituent cells on the Field to Bound state and creates an Engine.

### Submit Engine

- Available only for an inspected ordinary Engine (`submittable: true`).
- Previews the exact constituent cells, Quality %, production rate, and exact Shard payout.
- Re-reads the selected Engine, verifies exact constituent IDs and Bound state, freezes payout, removes those cells and the Engine, grants Shards exactly once, clears inspection, saves, and emits an immutable visual event.
- Repeated Submit fails. Heart Engine Submit always fails (`submittable: false`).

```text
Shards = max(1, round(sum(bound constituent Grades) × (1 + boundQuality)))
```

Keeping an Engine preserves its Block production into buffers. Submitting it sacrifices that Engine and its constituent cells for permanent Shape Grade progression.

## 7. Shape Grades

Each Shape begins at Grade 1:

```text
upgrade cost from Grade N to N + 1 = 3 × N Shards
```

An upgrade changes existing **Loose** Blocks of that Shape on the Field and all future placements from buffer inventory. It never changes Bound constituent Grades, existing Engine `boundValue`, production power, or an existing Engine's Shard Submit preview.

## 8. HUD and Teaching

The persistent HUD shows the total Shards count, a Reset button, and all seven Block buffer inventories (with hotkeys `1`–`7` and shape glyphs).

The right sidebar teaches the core loop and displays goals and recipes:

```text
BIND → ENGINE
SUBMIT ENGINE → SHARDS
SHARDS → GRADE ↑
```

- **Before Heart Engine:** Displays `1. BUILD HEART SEAL`, Cradle cell fill progress (`X / 16`), and `2. BIND → ENGINE`. The sidebar shows the Heart Seal recipe with an exact 4×4 target template.
- **After Heart Engine:** Displays `RECIPES: BUILD A PATTERN`. The sidebar shows Compression Press (`4–10 connected`) and Twin Stars (`2+2 or more equal groups · separated`) with valid example topology previews labeled `EXAMPLE`.
- **Inspecting an Engine:** Shows Engine name, next Shape, production rate (blocks/min), Quality %, and (for ordinary Engines) a `SUBMIT ENGINE` button displaying `+X SHARDS`.
- **Shape Grade Upgrades:** Displays upgrade buttons (`↑ <Cost> ◆`) for each of the seven Shapes.

## 9. Save and Architecture

Save schema version 3 (persisted in `localStorage` under key `rune_foundry_save_v1`) removes the retired `ash` currency field and uses explicit `submittable` Engine flags. Version 1 and 2 saves automatically migrate to version 3 on load while preserving Engines, bound snapshots, Grades, Shards, RNG state, 7-bags, Blocks, and the Heart Engine.

All geometry, economy, production, RNG, and state transactions are deterministic TypeScript. Dependencies flow inward:

```text
core ← application ← ui/platform
```

## 10. Deferred Systems

Ash currency is deferred until a real sink such as Sector expansion exists. Sector expansion, Fractures, Stencils, offline progress, Recast, advanced Pattern families, Engine traits, and the authored ending remain deferred.
