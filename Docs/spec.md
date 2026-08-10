# HL;BM — Rune Foundry Specification

> **Pass 2: Core Progression Redesign**
> **Canonical core:** Browser-first spatial incremental / pattern-construction game.

## 1. Product promise

Rune Foundry should always answer two questions:

~~~
NOW  — What should I do next?
NEXT — What meaningful unlock follows?
~~~

The target loop is:

~~~
Heart
→ powered Engines
→ build/Bind recipes
→ Keep vs Submit
→ Shards/upgrades
→ Directive milestone
→ Core
→ Frontier expansion
→ new recipes
~~~

The player has exactly two resources:

- **Shards** — repeatable economy from ordinary Engine submission; spent on Shape Grades and Frontier Seals.
- **Core** — rare authored progression resource; earned only from milestone Directives and spent on major progression such as Frontier Seals.

Production creates Blocks, never resources directly.

## 2. Opening and the Limited Field

The world and camera may extend indefinitely, but Blocks may occupy only unlocked cells.

- Expansion unit: one 4×4 chunk.
- The opening field is roughly 8×8 usable cells, authored as four starting chunks around the Heart Cradle.
- The 4×4 Heart Cradle remains the exact Heart Seal target. Its coordinate origin is an authored map detail; it sits inside the opening field with usable cells around it.
- Opening inventory is one each of I, O, L, and J; T, S, and Z begin at zero. These four real Blocks fill the Heart Seal.
- The resulting Heart Engine is unique, foundational, remains on the Field, cannot be Submitted, and ensures the player retains a permanent Block-production root.
- The authoritative field state is a set of unlocked chunk IDs, not a rectangle. A newly unlocked chunk does not implicitly unlock the cells between it and another chunk, so layouts may branch, contain holes, and be non-rectangular.
- A chunk is adjacent only when it shares a full 4-cell side with an unlocked chunk. Diagonal contact is not enough.
- There is no generic Buy Land action. New chunks are unlocked only by activating a valid Frontier Seal.

Every tetromino placement, Bind, and Frontier Seal activation must revalidate all occupied cells:

1. all four cells of the tetromino are inside unlocked chunks;
2. all four cells are empty of other Loose or Bound Blocks; and
3. the action is committed atomically.

The existing seven tetrominoes, rotations, nearest-valid ghost, pointer priority, selection, and Return-to-buffer interaction remain. The placement resolver searches only unlocked cells. Locked cells are visible as frontier space, but never accept a Block.

Blocks retain the states **Buffered**, **Loose**, **Bound**, and **Consumed**. Bound cells remain fixed until their ordinary Engine is Submitted. The Heart Engine and its Cradle cannot be moved or Submitted.

## 3. Recipes

| Recipe | Rule | Result |
|---|---|---|
| **Heart Seal** | Exact fill of all 16 cells of the 4×4 Heart Cradle, with no candidate cell outside it | Foundational Heart Engine; the Power root |
| **Compression Press** | 4–10 Loose Blocks in exactly one connected component | Ordinary Engine; Quality remains 0.50 + 0.50 × cohesion |
| **Twin Stars** | Exactly two connected Loose components, equal Block counts, at least 2 Blocks per component | Ordinary Engine; Quality remains the current centroid-separation formula |
| **Frontier Seal** | Exact four-Block frontier pattern defined below | Consumes its Blocks, spends resources, and unlocks one chosen adjacent 4×4 chunk; creates no Engine |

Before the Heart Engine exists, only the Heart Seal can Bind. Afterwards, valid ordinary recipes surface Bind. Binding freezes and revalidates the exact Loose Block IDs, converts those Blocks to Bound, and creates one Engine. Bound constituent Grades and Quality are snapshots.

### 3.1 Frontier Seal

The Frontier Seal is a real tetromino recipe, not a land-purchase button.

Canonical normalized pattern:

- exactly four **Loose I Blocks**;
- each I is vertical in the canonical orientation;
- the four Block origins are (0,0), (1,0), (0,4), and (1,4);
- the union is therefore a complete 2×8 rectangle, with no extra candidate Blocks;
- translating or rotating the complete pattern by 90° increments is allowed, but mirroring or arbitrary gaps are not.

Activation also requires:

- the selected 2×8 footprint is entirely inside currently unlocked, unoccupied cells;
- the chosen target is a locked 4×4 chunk sharing a side with the current unlocked field;
- the long side of the Seal has at least four orthogonal edge contacts with that target chunk. A corner or diagonal contact cannot activate it;
- the player has at least **1 Core and 12 Shards**.

Activation validates the pattern, target, and costs in one transaction, then consumes the four I Blocks, removes 1 Core, removes 12 Shards, and unlocks exactly the chosen target chunk. A failed validation removes nothing.

**Verified buildable example:** use an opening frame of x:-2..5, y:-2..5, with the Heart Cradle at x:0..3, y:0..3. Choose the locked east chunk x:6..9, y:-2..1. Place vertical I Blocks with origins (4,-2), (5,-2), (4,2), and (5,2), using rotation 1 from the repository's canonical I geometry. Their occupied cells are exactly {x:4,5} × {y:-2..5}: they do not overlap the Cradle, all 16 cells are in the opening field, and the x:5, y:-2..1 edge is orthogonally adjacent to the target's x:6, y:-2..1 side. This is a valid Frontier Seal made from four real tetrominoes.

The example is an authored layout illustration; the general rule is the normalized footprint and frontier contact, not those absolute coordinates.

## 4. Foundry Directives

The UI exposes only the current **NOW** Directive and the next **NEXT** unlock. It does not show a quest list or arbitrary counter checklist. Directive completion is based on learning a system or reaching an authored state.

The intended early sequence is:

| Order | NOW objective | Completion / reward |
|---|---|---|
| 1 | Bind Heart Seal | Heart Engine exists; the Heart becomes the Power root |
| 2 | Build and Bind Compression Press | First ordinary Engine exists |
| 3 | Submit an ordinary Engine | Grants the normal Shard payout and teaches that Submit frees its cells |
| 4 | Upgrade a Shape to Grade 2 | Teaches the repeatable Shard sink |
| 5 | Keep a Powered ordinary Engine | An ordinary Engine is Bound, connected to Heart, and not Submitted |
| 6 | Complete **Stabilize the Line** | While kept and powered, the ordinary Engine completes one real production output; award exactly 1 Core |
| 7 | Build a Frontier Seal | Show the 1 Core, 12 Shard, and four-I-Block requirements |
| 8 | Activate it at the frontier | Unlock one chosen adjacent 4×4 chunk |
| 9 | Build Twin Stars with expanded space | Bind two equal components, with one component wholly in the newly unlocked chunk and the other in pre-expansion space |
| 10 | Advance to the next recipe tier | Reveal the first authored recipe in the next progression tier |

The order can be represented by authored Directive IDs, but the player sees only NOW and NEXT. If a resource is missing, NOW shows the relevant requirement and the shortest available route: produce/place Blocks, Submit an ordinary Engine for Shards, or complete the current milestone for Core.

The first Core is awarded by the authored **Stabilize the Line** milestone, not by passive time, production output in general, or normal Engine submission. Later Cores follow the same authored-milestone rule.

## 5. Power Network

Power is a connectivity state, not a capacity stat.

- The Heart Engine is the sole Power root.
- Treat every Bound Engine cell as a graph cell. Orthogonally adjacent Bound Engine cells connect.
- An ordinary Engine is **Powered** when any of its Bound cells is reachable from a Heart cell. Because every tetromino is internally connected, all cells of a reached Engine conduct Power onward.
- Powered Engines conduct Power through their own Bound cells to adjacent Bound Engine cells in other Engines.
- Loose Blocks, Buffered Blocks, empty cells, and locked cells never conduct Power.
- An ordinary Engine with no Heart path is **Unpowered** and produces nothing.
- Submitting an Engine removes its cells and immediately recomputes reachability. Submitting a bridge Engine may therefore disconnect every downstream Engine.

An unpowered Engine pauses with its current partial progress preserved. While unpowered, its clock does not advance. Reconnection resumes from that partial progress; disconnected time creates no backlog or catch-up production. No numerical Power capacity, upkeep, or power budget is introduced in this pass.

## 6. Production and Stock pacing

Retain the current material and Quality scaling, but lower the base rate:

~~~
BlockValue(Grade) = 4 × 2^(Grade - 1)
boundValue = sum(BlockValue(bound constituent))
MaterialMultiplier = sqrt(boundValue / 16)
QualityMultiplier = 0.75 + 0.50 × boundQuality
OutputMultiplier = MaterialMultiplier × QualityMultiplier
BlocksPerMinute = BaseRate × OutputMultiplier
~~~

Choose:

~~~
BaseRate = 3.5 Blocks/minute
~~~

The Heart has boundValue = 16 and boundQuality = 1.0, so OutputMultiplier = 1.25, output is 4.375 Blocks/minute, and its initial interval is approximately 13.7 seconds—inside the 12–16 second target. Stronger material and Quality still improve output through the same multipliers. This numerical output multiplier is not a network capacity.

Each Engine keeps its deterministic persisted 7-bag, next Shape, and partial interval. Only Powered Engines may advance their production clock.

### 6.1 Global Buffered Block capacity

The seven Shape buffers share one global **Stock** capacity of **12 Buffered Blocks**:

~~~
Stock = sum of all seven Shape buffer counts
~~~

The opening four starter Blocks count toward Stock. Loose and Bound Blocks do not count toward Stock.

- If Stock is below 12, a Powered Engine may advance and emit into its Shape buffer.
- If an output would make Stock 12, emit up to the available room and pause at full.
- At Stock 12, production progress is preserved and no blocked time is added.
- When a Block is placed, Bound, Submitted, or otherwise leaves a buffer, production can resume from the preserved partial progress.
- A Loose Block can always be deliberately abandoned as a last-resort escape; when Stock is full, that action discards the Loose Block rather than exceeding capacity and grants no resource.

Process simultaneous Engine outputs in stable Engine-ID order so capacity contention is deterministic. Stock-full feedback must name the condition; it must never silently accelerate or lose a completed interval.

## 7. Keep vs Submit and the two-resource economy

Ordinary Engine Submit remains atomic and exact:

~~~
Shards = max(1, round(sum(bound constituent Grades) × (1 + boundQuality)))
~~~

Submitting consumes the Engine and its Bound constituent Blocks, grants Shards once, and frees its cells. The Heart Engine is never submittable.

Keeping an Engine preserves its production only while it is Powered and consumes field space. A kept Engine can also be a bridge that powers other Engines. Submitting it grants repeatable Shards, frees space, and may break a Power route. Stock pressure means that additional Engines are not automatically better: an unpowered or strategically redundant Engine can be worth submitting, while a powered bridge can be worth keeping even when its immediate Shard payout is attractive.

Shape Grades remain the repeatable Shard sink:

~~~
Upgrade cost from Grade N to Grade N + 1 = 3 × N Shards
~~~

Upgrades affect Loose Blocks and future placements only; Bound snapshots, Engine production, and Submit previews do not change retroactively.

Core is intentionally non-redundant with Shards:

- Core is awarded only by authored milestone Directives.
- Normal production and Engine Submit never award Core.
- Shards cannot substitute for Core, and Core cannot be converted into Shards or Shape Grades.
- The early Frontier Seal consumes 1 Core, making the milestone a prerequisite rather than another repeatable economy.

## 8. UI and feedback requirements

The specification is conceptual; it does not prescribe CSS, pixel dimensions, or a particular layout implementation.

The persistent HUD and Field feedback must make these states legible:

- **Directives:** one NOW objective and one NEXT meaningful unlock, with contextual requirements/progress.
- **Resources:** Shards, Cores, and Stock as current / 12.
- **Engines:** Powered versus Unpowered status, visible Heart-root connectivity, local production progress, and the fact that an unpowered clock is paused.
- **Stock pause:** an explicit STOCK FULL — PRODUCTION PAUSED state; progress remains visibly preserved.
- **Frontier:** locked cells/chunks are visually distinct from empty unlocked cells; the chosen adjacent target and valid/invalid Frontier Seal preview are clear.
- **Recipe decisions:** Bind previews exact constituent Blocks; Frontier Seal previews its four-I footprint, target chunk, and Core/Shard cost; Submit previews its Shard payout and the cells it frees.
- **Asset language:** Core, Heart, Power, Frontier, and Directives use the existing HLBM seal/gem/rune visual language and distinguish Core from Shards at a glance.

Engine inspection must make the Keep versus Submit tradeoff readable: production rate while Powered, current Power state, bridge relevance when applicable, exact Shard payout, and the consequence that Submit removes the Engine from the network.

## 9. Asset reuse and technical boundaries

Continue the existing HLBM asset-reuse approach:

- Copy only selected suitable assets into Rune Foundry and preserve provenance in public/assets/hlbm/README.md.
- The current copied gem and seal markers remain the visual reference for Shards and Heart/Frontier seals; reuse matching HLBM motifs for Core, Power, and Directive feedback when suitable source art exists.
- Rune Foundry has no runtime dependency on the Unity or sibling repository, its metadata, or its asset paths.
- Tetromino geometry, chunk outlines, Power paths, and board presentation remain procedural where that is clearer.

All geometry, recipe validation, Power reachability, economy, production, RNG, and state transactions remain deterministic TypeScript. The next implementation save migration should add cores, unlocked chunk IDs, Directive/milestone state, and the Stock rule while preserving existing Blocks, Engines, Grades, Shards, RNG state, and partial production.

## 10. Safety checks and invariants

- **Spatial softlock:** the opening field leaves usable space around the Cradle, and the authored Frontier Seal example provides a valid first route. Any later expansion must be side-adjacent to an already unlocked chunk.
- **Expansion reachability:** the first Core milestone is completable using the Heart and a powered ordinary Engine before expansion. The Frontier Seal requires only real Blocks, Shards, Core, and an existing frontier; it never requires land that is already locked.
- **Stock deadlock:** Stock-full production pauses rather than accumulating. Placement, Bind, ordinary Submit, and the explicit full-Stock Loose-block discard all provide ways to reduce pressure.
- **Impossible Seal placement:** both the canonical geometry and the target frontier are checked at activation time; costs and Blocks are removed only after every check succeeds.
- **Power exploit:** Power is recomputed from Bound-cell adjacency after every Bind and Submit. Unpowered Engines neither produce nor conduct; disconnected time and repeated Submit never create extra output or payout.
- **Core collapse:** Core is a milestone gate with no Shard conversion, so it cannot become a second name for Shards or be farmed through production.
- **No-goal states:** every Directive transition immediately supplies a new NOW and NEXT. Missing resources show their source action, and a full Stock state explains how to make room.
- **Keep/Submit dominance:** field occupancy, Stock pressure, Power bridges, expansion room, and Shard payout all matter, so neither keeping nor submitting is universally optimal.

## 11. Deferred systems

Numerical Power capacity/upkeep, offline production, Stencils, Fractures, advanced Pattern families, Recast, later Frontier tiers, and the authored ending remain deferred until this core progression has been validated.
