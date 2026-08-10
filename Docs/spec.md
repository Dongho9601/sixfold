# HL;BM — Rune Foundry Specification

> **Canonical core:** Browser-first spatial incremental / pattern-construction game.

## 1. Core Loop

```text
Engines generate random Loose Blocks
→ player builds spatial Patterns
→ valid Loose Pattern chooses:

   BIND (keep)
   → cells remain on the Field as an Engine
   → that Engine continuously generates future Blocks

   SUBMIT (consume)
   → Loose cells disappear
   → player receives Ash

→ an ordinary Bound Engine may later be EXTRACTED (consume)
→ player receives Shards and loses that Engine's production
→ Shards upgrade Shape Grades
→ stronger Blocks increase later Submission and Engine value
```

Ash and Shards are the active currencies. Engine XP/Level is not part of the core.

The primary choices are where permanent Engines occupy space, whether a useful Pattern should become production or immediate Ash, and when an ordinary Engine is worth sacrificing for Grade progression.

## 2. Opening and the Heart Engine

The opening inventory is one each of `I`, `O`, `L`, and `J`. The player fills the illuminated 4×4 Cradle with those four Blocks and must Bind the exact **Heart Seal**.

The resulting **Heart Engine**:

- is unique and foundational;
- remains on the Field;
- is never extractable;
- ensures the player can never permanently lose all Block production.

After the Heart Engine exists, all seven Shapes may be produced.

## 3. Blocks, Shapes, and Placement

A Block is one tetromino occupying four orthogonally connected cells. Canonical Shape order and physical hotkeys are:

```text
1 = I   2 = O   3 = T   4 = L   5 = J   6 = S   7 = Z
```

Every Shape supports four normalized rotations. The palette always contains seven slots; unavailable counts display `0`.

Block states are:

- **Buffered:** Shape inventory awaiting placement.
- **Loose:** placed and eligible for selection, Return, Bind, or Submit.
- **Bound:** immutable constituent of one Engine.
- **Consumed:** removed by Submit or Extract and not retained in active state.

### 3.1 Placement Mode

Selecting a palette Shape or physical Shape hotkey enables placement. The ghost is resolved before click:

```text
cursor desired origin
→ test desired origin
→ search nearby origins within 3 cells by increasing squared distance
→ deterministic y-then-x tie-break
→ show the ghost at the resolved legal origin
→ click places at exactly that shown origin
```

If no legal origin exists in the radius, the ghost is invalid and click has no effect. Pressing the active Shape again toggles placement off. `KeyR` rotates; `Escape` cancels placement.

### 3.2 Selection Mode

When no Shape is active:

- click a Loose Block to select it;
- Shift+click toggles a Loose Block in the selection;
- left-drag starting on empty Field shows a rectangle and selects intersecting Loose Blocks on release;
- Shift+drag adds intersecting Loose Blocks;
- Bound cells are never included;
- `Delete` or `Backspace` Returns selected Loose Blocks to inventory.

Rectangle selection never moves Blocks. Right/middle drag or Space+left-drag pans; wheel zooms. Two-finger touch pans/zooms and a stationary 450 ms Loose-Block hold Returns it.

### 3.3 Keyboard Contract

Gameplay uses `KeyboardEvent.code`, never character `key`:

- `Digit1..Digit7` and `Numpad1..Numpad7`: Shapes;
- `KeyR`: rotate;
- `Space`: pan modifier;
- `Delete` / `Backspace`: Return selection;
- `Escape`: cancel mode/selection.

Ctrl, Meta, or Alt disables gameplay shortcut handling so browser/system shortcuts remain untouched. This contract is independent of English/Korean layouts and active IMEs.

## 4. Patterns and Recipes

The Field evaluates a bounded local Loose candidate after placement or Return. Explicit selection overrides the automatic candidate. UI may show missing cells or a compact validity trace, but core geometry owns all recognition and Quality calculations.

Active Recipes:

| Pattern | Minimal rule | Bind | Submit |
|---|---|---:|---:|
| Heart Seal | exact 4×4 opening Cradle fill | mandatory foundational Engine | no |
| Compression | 4–10 Blocks in one connected component | ordinary Engine | Ash |
| Twin Stars | exactly two separated components with equal Block counts | ordinary Engine | Ash |

Bind and Submit freeze the exact candidate Block IDs, revalidate those same IDs, then apply atomically.

## 5. Engines and Production

The Field supports the Heart Engine plus zero or more ordinary Engine instances. Every Engine records:

- stable Engine ID;
- constituent Block IDs;
- source Pattern ID/name;
- bound Quality;
- foundational/extractable flags;
- accumulated production time;
- persisted RNG state, remaining 7-bag, and actual next Shape.

Bound cells remain visible and immutable. Ordinary Engines are extractable; the Heart Engine is not.

### 5.1 Deterministic Random Production

Each Engine independently owns a shuffled bag containing exactly:

```text
I O T L J S Z
```

The bag is deterministically Fisher–Yates shuffled using a persisted xorshift32 state. Each completed cycle emits the stored `nextShape`, advances the bag, and refills/shuffles only when empty. Production never consults inventory counts and canonical logic never calls `Math.random()`.

Generated Blocks accumulate without an ordinary cap. There is no full/blocked Engine state and no low-buffer balancing. Each Engine shows its own next Shape, progress ring, and completion pulse on the Field.

Production rate is intentionally simple:

```text
BlocksPerMinute = BaseRate × (0.75 + 0.50 × boundQuality)
```

## 6. Bind, Submit, and Extract

### Bind — keep

- Available for the Heart Seal and valid ordinary Recipes.
- Converts the frozen Loose Block IDs to Bound.
- Creates one Engine instance without moving or removing cells.
- First-use teaching: `BIND → ENGINE` and a Loose-to-Engine diagram.

### Submit — consume Loose Pattern

- Available for valid ordinary Recipes.
- Previews the exact Loose Blocks that disappear and exact Ash reward.
- Removes those Blocks and grants Ash atomically.
- First-use teaching: `SUBMIT → ASH`.

```text
BlockValue(grade) = 4 × 2^(grade - 1)
SubmissionPower = sum(BlockValue) × N^0.30 × (1 + 1.75 × Quality²)
Ash = round(60 × SubmissionPower)
```

### Extract — consume ordinary Engine

- Appears only while an Engine is inspected.
- Shows the Engine silhouette, exact Shard reward, and loss-of-production warning.
- Freezes and revalidates the Engine/constituent IDs, removes the cells and Engine, grants Shards, then saves.
- Heart extraction fails safely.

```text
Shards = max(1, round(sum(constituent Block Grades) × (1 + boundQuality)))
```

## 7. Shape Grades

Each Shape has a persistent Grade starting at 1:

```text
upgrade cost from Grade N = 3 × N Shards
```

An upgrade increments that Shape Grade by one. It updates all existing **Loose** Blocks of the Shape immediately and all future placements use the new Grade. Bound constituents retain the Grade snapshot they had at Bind, keeping extraction previews stable.

The intended progression is explicit:

```text
Extract Engine → Shards → Shape Grade ↑ → stronger future Pattern value
```

## 8. UX and Teaching

The Field remains the hero surface. The HUD uses larger minimal controls: resource values about 18 px, icons about 24 px, 62 px Shape buttons, 11 px hotkeys, and 13 px counts.

A quiet, collapsible right sidebar (260 px desktop; drawer behavior on mobile) contains:

- the current Heart Seal diagram/progress before the Heart Engine;
- `BUILD A PATTERN` afterward;
- compact Compression and Twin Stars Recipe cards with topology, rule, and both outcomes;
- contextual Bind/Submit choice or selected-Engine Extract action;
- seven compact Shape Grade upgrade rows.

Use icons for repeated information and short text for concepts/decisions. Progressive first-use vocabulary is:

```text
BUILD
BIND → ENGINE
SUBMIT → ASH
EXTRACT → SHARDS
SHARDS → GRADE ↑
```

No modal tutorial pages or verbose Inspector paragraphs are part of the core.

## 9. Save and Architecture

State is saved to versioned `localStorage` after consequential actions and generated output, plus browser lifecycle exits. Save normalization migrates the previous single-Heart-Engine shape and fills newly introduced Shape/Grade fields.

All geometry, economy, production, RNG, and transactions are deterministic TypeScript. Dependencies flow inward:

```text
core ← application ← ui/platform
```

UI renders canonical previews and dispatches actions; it does not own topology, rewards, or production rules.

## 10. Deferred Systems

Sector expansion, Fractures, Stencils, offline progress, Recast, advanced Pattern families, Engine traits, and the authored ending remain later work. A storage cap should be reconsidered only if actual play demonstrates a need.
