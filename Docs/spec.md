# HL;BM — Rune Foundry Specification

> **Canonical core:** Browser-first spatial incremental / pattern-construction game.

## 1. Core Loop

```text
Engine generates Blocks
→ build Pattern
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

Shards are the only global currency in the current core. Engine XP/Level is not part of it.

## 2. Opening and the Heart Engine

The opening inventory is one each of `I`, `O`, `L`, and `J`. The player fills the illuminated 4×4 Cradle and must Bind the exact **Heart Seal**.

The resulting **Heart Engine** is unique, foundational, remains on the Field, cannot be Submitted, and ensures the player can never permanently lose all Block production. After it exists, all seven Shapes may be produced.

## 3. Blocks and Placement

A Block is one tetromino occupying four orthogonally connected cells. Canonical physical hotkeys are:

```text
1 = I   2 = O   3 = T   4 = L   5 = J   6 = S   7 = Z
```

Active states are **Buffered**, **Loose**, and **Bound**. Consumed Blocks are removed rather than retained.

### 3.1 Nearest-valid ghost

```text
desired origin
→ nearest legal origin within radius 3
→ squared-distance, then y/x deterministic tie-break
→ ghost shown at that origin
→ click places at exactly that origin
```

If no legal origin exists, the ghost is invalid and no placement occurs. `KeyR` rotates and `Escape` cancels placement.

### 3.2 Pointer priority

```text
multi-touch
→ explicit pan
→ existing Engine
→ existing Loose Block hold/click logic
→ empty-cell placement
→ empty-field selection
```

An Engine click always inspects the Engine. Pointer-down on a Loose Block begins a hold candidate. At 450 ms without movement, the existing Loose Block Returns to inventory. On a quick release, a valid active ghost is placed at its exact visible snapped position; otherwise the Loose Block is selected/toggled. Placement collision checks remain authoritative, so the new Block can never overlap the existing one.

With no active Shape, click/Shift+click selects or toggles Loose Blocks. Empty-field drag selects intersecting Loose Blocks. Bound cells are excluded. Right/middle drag or Space+left-drag pans; wheel zooms; two-finger touch pans/zooms.

Gameplay uses `KeyboardEvent.code`. Ctrl, Meta, or Alt disables gameplay shortcut handling.

## 4. Patterns and Recipes

The Field evaluates a bounded local Loose candidate after placement or Return. Explicit selection overrides the automatic candidate. A valid Loose candidate surfaces only `BIND`.

| Pattern | Canonical rule | Bind result |
|---|---|---|
| Heart Seal | exact 4×4 opening Cradle fill | foundational Heart Engine |
| Compression | 4–10 Blocks, exactly one connected component | ordinary Engine; Quality from Cohesion |
| Twin Stars | exactly two separated components, equal Block counts, at least 2 Blocks each | ordinary Engine; Quality from separation |

Binding freezes exact candidate Block IDs, re-reads and revalidates them, converts the same Blocks to Bound without moving them, and creates one Engine.

## 5. Engines and Production

Every Engine persists its identity, constituent Block IDs, source Pattern, bound Quality, foundational/submittable flags, frozen `BoundValue`, accumulated time, RNG state, 7-bag, and next Shape. Bound constituent Grades are snapshots and remain immutable.

Each Engine independently owns a deterministically shuffled bag containing `I O T L J S Z`. Production never consults inventory counts or `Math.random()`.

```text
BlockValue(Grade) = 4 × 2^(Grade - 1)
BoundValue = sum(BlockValue(bound constituent))
baselineValue = 4 Grade-1 Blocks = 16
MaterialMultiplier = sqrt(BoundValue / 16)
QualityMultiplier = 0.75 + 0.50 × boundQuality
EnginePower = MaterialMultiplier × QualityMultiplier
BlocksPerMinute = BaseRate × EnginePower
```

The square-root material scale makes larger and higher-Grade Engines meaningfully faster without making doubled material exactly double production. Later global Shape Grade upgrades do not change an existing Engine's frozen power.

## 6. Bind and Submit

### Bind Pattern

- Available for the Heart Seal and valid ordinary Recipes.
- Freezes and revalidates exact Loose Block IDs.
- Keeps cells on the Field, converts them to Bound, and creates an Engine.

### Submit Engine

- Available only for an inspected ordinary Engine.
- Previews the exact constituent cells and exact Shard payout.
- Re-reads the selected Engine, verifies exact constituent IDs and Bound state, freezes payout, removes those cells and the Engine, grants Shards exactly once, clears inspection, saves, and emits an immutable visual event.
- Repeated Submit fails. Heart Engine Submit always fails.

```text
Shards = max(1, round(sum(bound constituent Grades) × (1 + boundQuality)))
```

Keeping an Engine preserves its Block production. Submitting it trades that production for permanent Shape Grade progression.

## 7. Shape Grades

Each Shape begins at Grade 1:

```text
upgrade cost from Grade N = 3 × N Shards
```

An upgrade changes existing **Loose** Blocks of that Shape and all future placements. It never changes Bound constituent Grades, existing Engine power, or an existing Engine's Shard preview.

## 8. HUD and Teaching

The persistent HUD shows Shards and all seven Block inventories while preserving the larger control sizing. The compact sidebar teaches:

```text
BIND → ENGINE
SUBMIT ENGINE → SHARDS
SHARDS → GRADE ↑
```

Before the Heart Engine it shows `1. BUILD HEART SEAL` and `2. BIND → ENGINE`. Afterward it shows the Compression and Twin Stars rules. Inspecting an ordinary Engine shows next-Shape/production context plus its exact Submit payout.

## 9. Save and Architecture

Save schema version 3 removes the retired currency field and renames ordinary Engine sacrifice semantics. Version-2 saves discard that retired field while preserving Engines, bound snapshots, Grades, Shards, RNG state, bags, Blocks, and the Heart Engine.

All geometry, economy, production, RNG, and transactions are deterministic TypeScript. Dependencies flow inward:

```text
core ← application ← ui/platform
```

## 10. Deferred Systems

Ash is deferred until a real sink such as Sector expansion exists. Sector expansion, Fractures, Stencils, offline progress, Recast, advanced Pattern families, Engine traits, and the authored ending remain later work.
