# HL;BM — Rune Foundry Game Specification

> **Working title:** *HL;BM — Rune Foundry*  
> **Document status:** Proposed product specification — Pattern Engine and consumptive Recipe revision  
> **Target repository path:** `Docs/rune_foundry_spec.md`  
> **Product relationship:** Standalone browser game and discovery funnel for *Hold Less, Be More*  
> **Canonicality:** This document is the intended source of truth for product behavior, formulas, pacing, UX, persistence, and launch scope.  
> **Revision principle:** A discovered pattern may be bound once as a persistent Engine. Blocks submitted to a Recipe are always consumed and removed from the Field.

---

## 1. Document Purpose

### 1.1 Scope and Authority

This document defines the game vision, player experience, infinite-board rules, Pattern discovery, persistent Engine construction, consumptive Recipe Submission, progression, idle automation, web UX, monetization boundaries, persistence model, technical architecture, and delivery plan for **HL;BM — Rune Foundry**.

The specification describes the intended launch product unless a section is marked **Prototype**, **Tuning Range**, **Post-launch**, or **Future**.

> Runtime, content data, automated simulations, tests, analytics definitions, and presentation must be reconciled with this document whenever they disagree. A consequential formula change must update the specification and deterministic balance harness in the same change.

### 1.2 Metadata

| Field | Value |
|---|---|
| Genre | Browser-first spatial incremental / semi-idle pattern-construction game |
| Core differentiator | Build discoverable macro-patterns from generated tetromino Blocks; bind the first copy as an Engine, then consume later copies through Recipes for upgrades and rule changes |
| Starting Field | One illuminated 4×4 Cradle |
| Long-term Field | Sparse, irregular, effectively unbounded sector map with voids, Fractures, anchors, Engines, Stencils, and loose construction |
| Primary input | Mouse, touch, keyboard shortcuts |
| Primary platform | Modern desktop and mobile browsers |
| Ordinary session | 5–20 minutes |
| First Pattern discovery | Target 2–5 active minutes |
| First Engine binding | Target 4–8 active minutes |
| First consumptive Submission | Target 8–15 active minutes |
| First topology choice | Connected Compression versus separated Constellation by 15–25 active minutes |
| First Recast | Target 5–10 active hours |
| First authored ending | Target 12–20 active hours over approximately 5–14 calendar days |
| Post-ending | Endless Field, daily seeds, advanced Recipes, public Pattern codes |
| Monetization | Optional rewarded ads after core retention is validated |
| Technology direction | Browser-native TypeScript application; not a Unity WebGL export |
| Tone | Dark, restrained, mysterious, tactile, gradually escalating |

### 1.3 Product Relationship to HLBM

Rune Foundry shares the following with *Hold Less, Be More*:

- the seven tetromino shapes;
- Rune, affinity, Weakpoint, dungeon, and Delver vocabulary;
- the visual identity and dark restrained tone;
- the philosophy that filling visible space under constraints creates progress;
- the reveal that Runes are ultimately weapons rather than abstract factory components.

Rune Foundry does **not** reproduce the mobile game's combat loop, stage-bag economy, encounter formulas, or save state. It must remain enjoyable as an independent browser game.

### 1.4 Supporting Artifacts

Expected companion files after acceptance:

- `Docs/rune_foundry_plan.md` — implementation phases and task breakdown.
- `tools/balance-sim/` — executable deterministic economy and pacing simulator tool (imports canonical formulas from `src/core/`).
- `tools/pattern-validator/` — executable topology metrics and Pattern validator tool (imports canonical formulas from `src/core/`).
- `Docs/Balance/` — milestone targets, tolerance bands, results, and methodology documentation/data (e.g. `rune_foundry_targets.json`).
- `Docs/ArtBible/RuneFoundry/` — Field, Block, Engine, discovery, and Submission presentation rules.
- `Docs/rune_foundry_analytics.md` — event schema and experiment contracts.

> **Canonical Formula Location:** Executable balance/geometry tooling lives under `tools/`, while canonical formulas themselves live under `src/core/`. Tooling reuses production core modules to guarantee zero formula duplication or drift. `Docs/Balance/` is reserved for documentation, target datasets, and simulation analysis.

---

## 2. Product Vision

### 2.1 High Concept

**HL;BM — Rune Foundry** is an unfolding browser incremental game played on an expanding sparse grid.

The player begins with four tetromino Blocks inside a 4×4 Cradle. Arranging those Blocks reveals the first hidden Pattern. Binding the discovered Pattern turns its constituent Blocks into a permanent Engine. That Engine generates new Blocks over time.

Generated Blocks are placed back onto the Field to form compact masses, lines, rings, bridges, mirrored structures, separated constellations, and Weakpoint solutions. The game recognizes these arrangements as Recipes. When the player submits a valid Recipe, every selected loose Block is consumed and disappears from the board. In return, the player receives a large resource burst, Engine experience, Block upgrades, new production rules, automation, or access to deeper sectors.

The Field therefore contains two kinds of history:

- **persistent Engines**, which are discovered Patterns that remain and generate;
- **temporary constructions**, which are assembled, optimized, submitted, and removed.

The central long-term pleasure is to grow a personal Foundry of Engines while repeatedly creating and sacrificing increasingly sophisticated arrangements around them.

### 2.2 Fun Thesis

> **Discover a spatial rule, preserve its first successful form as a machine, then rebuild and sacrifice improved forms to make the entire Foundry stronger.**

The recurring emotional sequence is:

```text
My Engines finish new Blocks
→ I place them into a promising arrangement
→ the board begins to recognize a hidden Pattern
→ I adjust contact, spacing, symmetry, holes, or Weakpoint coverage
→ the Pattern is discovered
→ I bind the first copy or prepare it for a Recipe
→ the preview shows exactly what will be consumed and gained
→ I submit
→ the selected Blocks collapse and disappear
→ the relevant Engine, Block family, or Field rule advances
→ the empty space becomes available for a larger experiment
```

The game is not successful if the Field can be replaced by a list of generator buttons without materially changing player decisions.

### 2.3 Player Fantasy

The player is the intelligence inside an abandoned Rune Foundry beneath the Delver's camp.

The player should feel that they are:

- awakening one dormant 4×4 mechanism;
- discovering production laws through geometry rather than reading a fixed technology tree;
- leaving stable machines behind as proof of earlier discoveries;
- using those machines to manufacture new tetromino Blocks;
- deciding whether Blocks should touch as densely as possible or remain deliberately separated;
- noticing that an accidental silhouette satisfies an unknown Pattern;
- rebuilding a known Pattern more efficiently for a better Submission;
- sacrificing valuable live production for a permanent upgrade;
- turning an empty infinite grid into a readable atlas of Engines, experiments, voids, and solved Weakpoints;
- gradually discovering that the Foundry is manufacturing the Delver's weapons.

### 2.4 Core Player Questions

The design must repeatedly ask:

1. **Which Blocks should my Engines produce next?**
2. **Where should I place them?**
3. **Should this arrangement be compact, separated, hollow, symmetric, or connected to a landmark?**
4. **Have I discovered a new Pattern, or am I improving a known one?**
5. **Should I bind this Pattern as a permanent Engine or submit it for an upgrade?**
6. **Is the current quality good enough, or is one more Block worth waiting for?**
7. **Which live production am I willing to lose when the selected Blocks disappear?**
8. **What should refill this empty region after Submission?**

### 2.5 Target Experience

The game should feel:

- **Immediately legible:** the first task is filling one 4×4 Cradle.
- **Spatial before numerical:** placement and topology matter before large numbers appear.
- **Experimental:** the player can test arrangements without permanent loss.
- **Idle with authorship:** time produces materials for a plan the player chose.
- **Consumptive:** submitted work visibly disappears and creates a meaningful local reset.
- **Persistent:** first discoveries remain as Engines and make the Field feel authored.
- **Inspectable:** every Pattern condition, quality score, ETA, and reward is explainable.
- **Surprising but fair:** hidden Recipes can be discovered, but clues prevent blind guessing.
- **Expandable:** the Field grows beyond one screen and can contain irregular holes and distant islands.
- **Finite before endless:** the campaign reaches an authored first ending before infinite scaling.

### 2.6 Design Pillars

#### 2.6.1 Bind Once, Submit Repeatedly

- The first successful copy of a bindable Pattern may become a persistent Engine.
- Bound Blocks crystallize and are no longer loose or submit-able.
- Later copies of that Pattern, or Recipes derived from it, are submitted.
- Every submitted loose Block is removed from the Field.
- Submission is irreversible after confirmation.

#### 2.6.2 Topology Determines Value

- Most early Recipes reward one connected component with high edge contact.
- Some Recipes explicitly reward separation, balanced islands, target distance, holes, symmetry, or landmark relationships.
- There is no universal rule that touching is always correct.
- The Recipe card and live preview state the active topology objective.

#### 2.6.3 Discovery Replaces a Conventional Tech Tree

- The player does not begin with a complete Recipe list.
- Building a qualifying arrangement reveals its Pattern name, rules, and future reward.
- Once discovered, the Pattern enters the Codex permanently.
- Repeating a known Pattern builds Mastery and unlocks automation.
- Hints reveal enough structure to make discovery intentional rather than random.

#### 2.6.4 The Field Is Both Factory and Workbench

- Engines remain as persistent production infrastructure.
- Loose Blocks form temporary constructions around them.
- Submissions create empty space rather than permanent clutter.
- Stencils allow useful empty regions to refill automatically.
- Engines, Fractures, voids, and anchors make location matter.

#### 2.6.5 Waiting Must Follow a Decision

- Engines produce only after the player has decided what to bind and upgrade.
- Blocks may be assigned to Stencils before they exist.
- Honest ETAs show when a Pattern can be completed under current production.
- Offline progress fills buffers and locked Stencils; it never invents an unapproved layout.

#### 2.6.6 Major Payoff Waits for the Player

- New Pattern discovery, first Engine binding, Perfect Submission, Engine evolution, Recast, and the first ending do not silently resolve while offline.
- The state may become `READY`.
- The final action and strongest presentation occur after deliberate player input.

#### 2.6.7 Monetization Never Defines Baseline Pacing

- The full game is balanced with zero ad usage.
- Ads may accelerate a chosen plan but never reveal a hidden Recipe, perform a first discovery, create a Perfect Submission, or grant prestige currency directly.

### 2.7 Explicit Non-Goals

The launch product is not:

- a Tetris line-clear game;
- a conventional inventory merge game;
- a tower defense game;
- a cellular automaton that plays itself without player-authored Stencils;
- a hidden-object puzzle with arbitrary secret inputs;
- a gacha economy;
- a social MMO;
- a Unity WebGL port of HLBM;
- an infinite blank canvas with no landmarks, constraints, or progression structure;
- a system where submitted Blocks remain on the board;
- a system where one compact Recipe dominates every progression path.

---

## 3. Canonical Terminology

| Term | Meaning |
|---|---|
| **Field** | The entire sparse placement world for the current Recast cycle. |
| **Cradle** | The initial illuminated 4×4 placement region. |
| **Sector** | A streamed topology chunk containing placeable cells, voids, Fractures, anchors, and fog. |
| **Cell** | One square coordinate in the Field. |
| **Block** | One generated tetromino piece occupying exactly four cells. |
| **Loose Block** | A placed Block that may be moved, returned to buffer, analyzed, bound, or submitted. |
| **Buffered Block** | A generated Block not yet placed on the Field. |
| **Blueprint Slot** | A ghost placement that reserves shape, rotation, affinity, and priority without consuming a Block. |
| **Stencil** | A saved group of Blueprint Slots that can refill after Submission. |
| **Pattern** | A spatial relation among selected Blocks that the analyzer can recognize. |
| **Motif** | A reusable topology family such as Compression, Spine, Ring, Mirror, Bridge, or Constellation. |
| **Recipe** | A discovered rule specifying material, topology, quality, and Submission reward. |
| **Commission** | A temporary high-value request generated from a known Recipe. |
| **Analyze** | The action that evaluates a selection for undiscovered or known Patterns. |
| **Bind** | Convert one valid Pattern into a persistent Engine instead of consuming it. |
| **Engine** | A bound Pattern that remains on the Field and generates Blocks or another persistent effect. |
| **Submission** | Irreversibly consume and remove selected Loose Blocks according to a Recipe. |
| **Imprint** | A permanent rule or upgrade unlocked by first discovery, first binding, or first Submission. |
| **Quality** | A normalized `0..1` topology score for one Recipe. |
| **Cohesion** | Normalized inter-Block edge contact used by compact connected Recipes. |
| **Component** | One orthogonally connected set of selected occupied cells. |
| **Fracture** | A visible geometric Weakpoint embedded in Field cells. |
| **Matched Fracture** | Every Fracture cell is covered by matching-affinity Blocks. |
| **Precise Fracture** | One matching-affinity Block covers the complete Fracture pattern. |
| **Ash** | Main spendable currency. |
| **Shards** | Recurring upgrade currency earned primarily through Submission. |
| **Insight** | Permanent discovery currency earned primarily from new Patterns. |
| **Block Grade** | Persistent power tier of future Blocks of one shape. |
| **Engine Level** | Persistent production level of one Engine instance. |
| **Shape Mastery** | Persistent progression shared by all Blocks and Engines of one tetromino shape. |
| **Recast** | First prestige: archive the current Field and begin a new one with permanent Proofs. |
| **Proofs** | Recast currency derived from discoveries, Engines, and high-quality Submissions. |
| **Codex** | Permanent library of discovered Recipes, hints, records, and Stencils. |

---

## 4. Core Experience Structure

### 4.1 Long-Form Loop

```text
Engines generate Blocks
→ Blocks enter buffers or locked Stencils
→ player places or adjusts Loose Blocks
→ Analyze reveals or confirms a Pattern
→ first valid copy may be Bound as an Engine
→ later valid copies are submitted to a Recipe
→ submitted Blocks disappear
→ Ash, Shards, Insight, Mastery, and special effects are granted
→ production, Grade, Field access, or automation improves
→ the player constructs a more demanding Pattern
```

### 4.2 Ordinary Return Session

A normal return session should support the following sequence:

1. Offline progress fills Block buffers and approved Stencils.
2. The return summary states which Engines produced what.
3. Any Pattern that became complete is marked `READY`; it is not auto-bound or auto-submitted unless the player previously unlocked and enabled automation for that exact Stencil.
4. The player inspects active Commissions and Pattern hints.
5. The player places several Blocks or modifies one Stencil.
6. The player improves contact, spacing, symmetry, or Weakpoint coverage.
7. The player binds a new Engine, submits a known Recipe, or starts a longer plan.
8. The player assigns production priorities and leaves.

### 4.3 Decision Scales

| Scale | Typical decision |
|---|---|
| Seconds | Rotate a Block; move one piece to create another shared edge; select a valid match |
| Minutes | Wait for one missing shape; decide whether to submit now or improve Quality |
| Session | Bind a new Engine; pursue one Commission; clear a Fracture |
| Chapter | Specialize Shape Mastery; expand toward a landmark; automate a Recipe |
| Recast | Decide which Engines and Codex traits become permanent Proof bonuses |

### 4.4 Payoff Hierarchy

| Tier | Trigger | Presentation budget |
|---|---|---|
| Quiet | ordinary Block generation, buffer fill | subtle pulse and count change |
| Standard | Block placement, Recipe becoming valid | snap, outline, compact sound |
| Earned | Pattern discovery, Matched Fracture, Strong Submission | board-wide trace, named reveal, larger number burst |
| Major | first Engine Bind, Precise Fracture, Masterwork Submission, Engine evolution | staged collapse, persistent visual change |
| Signature | Perfect Submission, Grand Recipe, Recast, first ending | authored full-field sequence, strongest bounded audio and motion |

---

## 5. Opening Sequence

### 5.1 The 4×4 Cradle

The player starts with:

- one illuminated 4×4 Cradle;
- four Buffered Blocks: `I`, `O`, `L`, and `J`;
- no visible Recipe list;
- one instruction: **Fill the Cradle.**

The player may move and rotate the four Blocks freely. The Cradle is authored so at least four visually distinct exact tilings exist.

When all 16 cells are filled:

```text
PATTERN DETECTED
HEART SEAL
```

The game explains:

> A discovered Pattern can be bound once as an Engine.  
> Blocks submitted later will be consumed.

### 5.2 First Bind

The player selects **Bind Heart Seal**.

- The four Blocks crystallize rather than disappear.
- They become the permanent Heart Engine.
- The Heart Engine begins generating `I`, `O`, `L`, and `J` Blocks into the buffer.
- Adjacent fog recedes.
- The Codex opens with one known Pattern and two rumors.

This first action establishes that the first copy of an important Pattern may remain.

### 5.3 First Consumptive Submission

The first Commission asks for a compact connected arrangement of four generated Blocks.

The player creates it and sees a live **Cohesion** meter.

On Submission:

- the selected four Loose Blocks light in sequence;
- they collapse toward their centroid;
- every selected Block is removed;
- Ash and Shards are granted;
- the Heart Engine gains experience;
- the empty cells remain available.

This establishes the normal rule: **Submission consumes the work.**

### 5.4 First Topology Contrast

Within 15–25 active minutes, the player receives two simultaneously viable objectives:

- **Compression Press:** one connected component; maximize contact;
- **Twin Stars:** exactly two separated components of equal size at a target distance.

The player should understand that touching is powerful by default, but not universally correct.

---

## 6. Infinite Field and Sector Topology

### 6.1 Sparse World Model

The Field is stored as sparse chunked coordinates rather than one fixed rectangular array.

Each coordinate may independently contain:

- terrain state;
- one Engine cell;
- one Loose Block cell;
- one Blueprint Slot;
- one Fracture marker;
- one anchor or landmark;
- fog or survey metadata.

The logical Field has no product-level fixed width or height. Runtime and save systems must support at least:

- `65,536` occupied cells;
- `8,192` placed or bound tetromino Blocks;
- `1,024` Engines and Stencils combined;
- camera coordinates beyond signed 16-bit range.

Launch content targets are much smaller. These are architecture limits, not pacing goals.

### 6.2 Sectors

The Field streams in deterministic Sectors, initially `12×12` or `16×16` cells.

A Sector mask may contain:

- fully open floor;
- permanent voids;
- narrow corridors;
- ring-shaped walkable regions;
- disconnected-looking islands joined by anchors;
- Fractures;
- Survey Gates;
- landmarks;
- pre-authored negative-space silhouettes.

The Field need not be rectangular, contiguous, or fully placeable.

### 6.3 Survey

The player may place Loose Blocks only in surveyed cells.

New Sectors are revealed by:

- first-time Pattern discovery;
- Engine binding;
- Fracture resolution;
- Commission milestones;
- spending Ash or Shards;
- Recast progression.

Survey choices should present at least two meaningful directions whenever possible:

- compact safe space;
- difficult Fracture;
- distant landmark;
- void-rich topology;
- Engine-friendly adjacency;
- Constellation-friendly open space.

### 6.4 Field Layers

Rendering and rules distinguish five layers:

1. **Terrain:** open cell, void, wall, feature.
2. **Engine:** bound permanent structure.
3. **Loose Block:** temporary placed material.
4. **Blueprint:** ghost future placement.
5. **Overlay:** Pattern, Recipe, Weakpoint, quality, and selection information.

An Engine and a Loose Block may not occupy the same cell.

### 6.5 Why the Field Can Grow Large

Submitted Blocks disappear. Therefore, a large Field does not imply that every cell remains permanently occupied.

The Field grows through:

- persistent Engine islands;
- active Stencils;
- temporary construction zones;
- cleared regions ready for reuse;
- distant landmarks and Fractures.

This produces the visual scale of a large factory without requiring the player to maintain thousands of active loose pieces simultaneously.

### 6.6 Active Construction Limit

The launch game limits active loose complexity through **Field Load**.

```text
FieldLoad =
    LooseBlockCount
    + 2 × ActiveStencilCount
    + EngineLoad
```

Default launch target:

```text
FieldLoadCapacity = 24
```

Capacity increases through Recipes, Engines, and Recast.

Field Load is a cognitive and simulation limit, not a monetized energy timer.

---

## 7. Blocks, Shapes, Grades, and Affinities

### 7.1 Block Definition

A Block is one tetromino piece:

- exactly four orthogonally connected cells;
- one Shape;
- one rotation;
- one affinity;
- one Grade;
- one source Engine;
- one unique persistent ID while buffered or placed.

The seven canonical Shapes are:

```text
I O T L J S Z
```

Reflection does not change Shape identity. Rotation is free while the Block remains loose.

### 7.2 Loose Block Rules

A Loose Block may be:

- buffered;
- manually placed;
- moved;
- rotated;
- returned to buffer;
- assigned to a Stencil;
- selected for Analyze;
- bound as part of one Pattern;
- submitted and consumed.

Before Bind or Submission, rearrangement has no resource penalty.

### 7.3 Block Grade

Each Shape has a persistent Grade:

```text
Grade = 1, 2, 3, ...
```

Base material value:

```text
BlockValue(grade) =
    4 × 2^(grade - 1)
```

A Grade increase affects:

- future generated Blocks;
- existing buffered Blocks;
- existing Loose Blocks;
- Pattern material value;
- live Field output;
- Submission reward;
- visual intensity.

Bound Engine cells retain their Engine identity and do not retroactively change topology when a Grade changes.

### 7.4 Affinities

Launch affinities:

- Neutral
- Fire
- Water
- Nature
- Heavy
- Blood
- Poison

Affinity primarily matters for:

- Fractures;
- Recipe material constraints;
- Engine output traits;
- later Grand Recipes.

Affinity does not change tetromino geometry.

### 7.5 Live Field Output

Loose Blocks generate a modest amount of Ash while placed.

Let:

- `V` = sum of selected or global Block values;
- `A` = orthogonal cell edges shared between different Loose Blocks;
- `N` = number of Loose Blocks.

For the whole live Field:

```text
ContactRate =
    min(0.40, 0.06 × A / max(1, N))

LiveAshPerSecond =
    V × (1 + ContactRate)
```

This gives compact arrangements a small passive advantage while waiting without making passive output more important than Recipe progression.

Bound Engines have their own production formulas and do not count as Loose Blocks in this calculation.

---

## 8. Engines and Block Production

### 8.1 Engine Definition

An Engine is a bound Pattern.

Binding:

- preserves the Pattern's exact Field coordinates and topology;
- converts its Loose Blocks into crystallized Engine cells;
- records its Pattern ID, Quality, affinities, and constituent Shapes;
- removes those Blocks from loose inventory permanently;
- begins the Engine's persistent effect.

An Engine is not a submitted set. The selected Blocks remain as infrastructure.

### 8.2 Bindability

Not every Recipe is bindable.

Each Pattern declares one of:

- `BindRequired` — first copy must become an Engine;
- `BindOptional` — player may bind one copy or submit it;
- `SubmitOnly` — never becomes an Engine;
- `GrandBind` — one campaign-level Engine may be created.

A player may normally own one Engine per bindable Pattern. Later Recast upgrades may raise this limit.

### 8.3 Engine Output

An Engine may produce:

- one Shape;
- a weighted set of Shapes;
- alternating Shapes;
- affinity-modified Blocks;
- Ash;
- Shards at a very low rate;
- Blueprint fill speed;
- a Field rule rather than physical Blocks.

Each Engine definition lists its output explicitly.

### 8.4 Production Rate

Let:

- `B` = Engine base Blocks per minute;
- `L` = Engine Level;
- `Qb` = Quality at binding in `0..1`;
- `M` = Shape or Recipe mastery multiplier;
- `G` = global speed multiplier;
- `T` = Engine topology-trait multiplier.

```text
BindQualityMultiplier =
    0.75 + 0.50 × Qb

LevelMultiplier =
    1.28^(L - 1)

BlocksPerMinute =
    B
    × BindQualityMultiplier
    × LevelMultiplier
    × M
    × G
    × T
```

A Perfectly bound Engine therefore produces `1.25×` its base rate before Level and other bonuses. A minimum-valid Engine produces no less than `0.75×`.

### 8.5 Buffer

Each Shape has a Block buffer.

Initial targets:

```text
PerShapeBuffer = 3
GlobalBuffer = 12
```

When either relevant cap is full, production pauses without wasting progress.

Offline production fills buffers and locked Stencils up to the offline cap.

### 8.6 Engine Level

Engine experience is earned by submitting Recipes linked to that Engine.

Suggested threshold:

```text
EngineXpRequired(level) =
    round(12 × 3.5^(level - 1))
```

Level-up effects:

- production speed;
- output quantity at milestone levels;
- one Engine evolution choice at Levels `3`, `6`, and `10`.

### 8.7 Engine Evolution

An Engine evolution choice should alter play rather than add only a multiplier.

Examples:

| Evolution | Effect |
|---|---|
| Rapid | Faster cycle; lower buffer efficiency |
| Dense | Slower cycle; generated Blocks gain extra Recipe material value |
| Echo | Every `N`th output duplicates |
| Linked | Gains production from adjacent Engine boundary |
| Solitary | Gains production when no other Engine is within a target radius |
| Precise | Generated Blocks gain bonus against Fractures |
| Memory | Automatically fills the Engine's mastered Stencil |

### 8.8 Engine Rebinding

The player may replace an Engine with a higher-quality reconstruction after unlocking Rebinding.

Requirements:

- a complete valid replacement Pattern;
- a Shard cost;
- confirmation showing old and new rate;
- old Engine dissolves only after the new Engine commit is durable.

No duplicate first-discovery rewards are granted.

---

## 9. Placement, Blueprints, and Stencils

### 9.1 Manual Placement

Placing a Block:

- removes one matching Block from buffer;
- occupies four valid surveyed cells;
- may not overlap Engine, Loose Block, wall, or void cells;
- immediately updates topology metrics and Pattern hints.

Removing a Loose Block returns it to the appropriate buffer unless the buffer is full. Overflow is held in a temporary return queue until space exists.

### 9.2 Blueprint Slots

A Blueprint Slot is a ghost Block placement.

It records:

- Shape;
- rotation;
- position;
- affinity requirement;
- minimum Grade;
- fill priority;
- optional Recipe or Stencil ownership.

Blueprints cost no Block and may be edited freely.

### 9.3 Automatic Fill

When a matching Block enters buffer, the auto-fill resolver may place it into the highest-priority eligible Blueprint Slot.

Deterministic order:

1. locked tutorial or recovery slot;
2. player-pinned Stencil;
3. active Commission Stencil;
4. ordinary Stencil priority;
5. buffer.

Auto-fill never chooses a rotation or position not explicitly approved by the player.

### 9.4 Stencils

A Stencil is a saved set of Blueprint Slots plus optional Recipe metadata.

A Stencil may be created from:

- a discovered Pattern;
- a submitted selection;
- a bound Engine;
- a manually selected region.

The player can choose whether Submission:

- preserves the Stencil and refills the same geometry;
- deletes the Stencil;
- converts the Stencil to a new Recipe variant.

### 9.5 Why Stencils Matter

Stencils turn discovery into idle automation:

```text
discover manually
→ save the successful geometry
→ submit the physical Blocks
→ Blocks disappear
→ Engines regenerate the required Shapes
→ the Stencil visibly refills over time
→ repeat manually or auto-submit after Mastery
```

This is the intended bridge between spatial puzzle play and incremental play.

---

## 10. Pattern Discovery

### 10.1 Discovery Principle

The player should discover **rules expressed by geometry**, not arbitrary password-like secrets.

A Pattern may depend on:

- Shape counts;
- connected components;
- inter-Block edge contact;
- bounding-box density;
- holes;
- symmetry;
- aspect ratio;
- branch count;
- component separation;
- landmark contact;
- Fracture coverage;
- affinity relationships;
- negative space;
- sequence of prior Submissions.

### 10.2 Analyze

The player may select `2–24` Loose Blocks and press **Analyze**.

The analyzer returns one of:

- a newly discovered Pattern;
- one or more known valid Recipes;
- a near-match with the most important unmet condition;
- no resonance, with a concise reason.

Obvious launch Patterns may also trigger automatic `RESONANCE DETECTED` prompts after placement. The final discovery still requires player acknowledgment.

### 10.3 Candidate Selection

To avoid exhaustive subset search, discovery uses:

- the explicit player selection;
- the connected component containing the latest Block;
- one bounded neighborhood around a Fracture or anchor;
- one active Stencil;
- one current Commission region.

The runtime does not search all subsets of all Field Blocks.

### 10.4 Codex and Rumors

The Codex contains:

- discovered Pattern definitions;
- best Quality record;
- first-discovery layout;
- Engine binding status;
- Submission count;
- Mastery;
- saved Stencils;
- undiscovered rumors.

A rumor reveals constraints progressively.

Example:

```text
THE EMPTY EYE

Hint 1: The shape must be connected.
Hint 2: Darkness must remain inside it.
Hint 3: The enclosed void must not touch the outside.
```

Hints unlock through normal play, failed Analyze attempts, or Insight. Ads never reveal them.

### 10.5 Discovery Fairness

Every authored Pattern must satisfy:

- at least three valid arrangements under currently unlocked Shapes;
- at least one valid arrangement without a rare affinity;
- a deterministic hint path;
- a bounded maximum selection size;
- a content validator with positive and negative examples.

Grand Recipes may be stricter but must expose their full requirements once unlocked.

### 10.6 Launch Motif Families

| Motif | Core idea |
|---|---|
| Seal | exact fill of a bounded region |
| Compression | one connected component; maximize shared edges |
| Spine | long connected structure with high aspect ratio |
| Hook | turn around or precisely cover an L-like feature |
| Branch | connected skeleton with multiple endpoints |
| Weave | alternating S/Z or affinity adjacency |
| Hollow | connected structure enclosing one or more holes |
| Mirror | reflection or rotational symmetry |
| Bridge | connect two anchors efficiently |
| Constellation | multiple separated balanced components |
| Orbit | separated components at a target radius around a landmark |
| Prism | use many Shapes or affinities under adjacency constraints |
| Negative | empty cells form the relevant silhouette |
| Grand | combine multiple known Motifs in one selection |

---

## 11. Recipe System

### 11.1 Recipe Definition

Every Recipe contains:

```text
RecipeId
DisplayName
Tier
Prerequisites
BindMode
AllowedSelectionSize
MaterialRequirements
TopologyProfile
ValidityThreshold
QualityFunction
WeakpointRules
FirstDiscoveryReward
FirstBindReward
FirstSubmissionReward
RepeatReward
EngineTarget
ShapeMasteryTarget
CommissionEligibility
AutomationMastery
PresentationTier
```

### 11.2 Recipe Types

#### Bind Recipe

The first valid copy becomes or may become an Engine.

#### Upgrade Recipe

Submission grants Engine XP, Shape Mastery, Grade progress, capacity, or production changes.

#### Effect Recipe

Submission triggers a temporary or permanent special effect.

#### Survey Recipe

Submission clears fog, opens a Sector, or activates an anchor.

#### Grand Recipe

Combines known Motifs and advances Recast or the authored ending.

### 11.3 Commissions

The player has up to three active Commissions generated from known Recipes.

A Commission adds:

- required Shape, Grade, affinity, or location;
- a demand multiplier;
- one special reward;
- an expiration measured in completed Submissions rather than wall-clock time.

Commission rotation is deterministic from save seed and completion count.

The player may always submit a known Recipe at base reward even when it is not commissioned.

### 11.4 Demand Multiplier

Launch range:

```text
DemandMultiplier = 1.25 .. 3.00
```

Higher demand may compensate for:

- uncommon Shapes;
- separation requirements;
- a difficult Fracture;
- low-current-production materials;
- a larger selection.

Demand never changes Pattern validity.

### 11.5 Recipe Mastery

Each valid Submission grants Recipe Mastery.

Suggested thresholds:

| Mastery | Unlock |
|---:|---|
| 1 | full Formula and records |
| 3 | save Stencil from preview |
| 5 | auto-fill exact Stencil |
| 10 | conditional auto-submit |
| 20 | one permanent Recipe specialization |

Auto-submit is allowed only for a locked Stencil whose selection and reward are deterministic.

---

## 12. Topology Metrics

### 12.1 Cell and Block Graphs

The resolver derives:

- occupied cell set;
- Block ownership of each cell;
- orthogonal cell adjacency;
- inter-Block shared edges;
- Block adjacency graph;
- connected components;
- bounding box;
- perimeter;
- enclosed voids;
- symmetry overlap;
- component distances;
- landmark contacts.

All Recipe preview, discovery, Submission, tests, and offline automation use the same pure resolver.

### 12.2 Inter-Block Shared Edges

Let:

- `N` = number of selected tetromino Blocks;
- `A` = number of orthogonal cell edges shared by cells belonging to different selected Blocks.

Each tetromino contains exactly three internal edges. For a compact area of `4N` cells, an approximate upper bound for inter-Block contact is:

```text
Amax(N) =
    max(1, 5N - ceil(4 × sqrt(N)))
```

Normalized Cohesion:

```text
Cohesion =
    clamp(A / Amax(N), 0, 1)
```

The quality resolver may use exact authored maxima for small fixed Recipes. The general formula is used for free-form selections.

### 12.3 Components

Two selected Blocks belong to the same component when any occupied cell of one is orthogonally adjacent to any occupied cell of the other through the selected set.

The resolver records:

- component count;
- Block count per component;
- cell area per component;
- nearest gap between components;
- mean nearest-component gap;
- centroid and angular distribution.

### 12.4 Bounding Density

```text
BoundingDensity =
    SelectedCellCount
    / max(1, PlaceableCellsInsideBoundingBox)
```

Permanent void cells inside the box are excluded when the Recipe explicitly allows terrain-aware density.

### 12.5 Symmetry

Symmetry is measured by Jaccard overlap after normalization under:

- horizontal reflection;
- vertical reflection;
- `90°`, `180°`, or `270°` rotation;
- Recipe-specific axes through a landmark.

```text
SymmetryScore =
    max(
        intersection / union
        across allowed transforms
    )
```

### 12.6 Holes

A hole is an empty placeable-cell component that:

- lies inside the selection's bounding flood-fill boundary;
- cannot reach the bounding exterior without crossing selected cells or permanent walls.

Recipes may score:

- number of holes;
- hole area;
- hole silhouette;
- centeredness;
- whether a Fracture lies inside the hole.

---

## 13. Recipe Topology Profiles

### 13.1 Cohesion Profile

Used by Compression, Seal, and dense Engine Recipes.

Hard requirements may include:

- exactly one component;
- minimum `N`;
- no forbidden Shape;
- no uncovered Critical Fracture.

Quality:

```text
CohesionQuality =
    Cohesion^1.60
```

Optional density refinement:

```text
CompactQuality =
    sqrt(
        CohesionQuality
        × BoundingDensity
    )
```

The Recipe declares which form is canonical.

### 13.2 Separation Profile

Used by Twin Stars, Constellation, Orbit, and isolation Engines.

Hard requirements may include:

- exact target component count;
- no inter-component edge contact;
- minimum component size;
- target distance band.

Let:

- `D` = mean nearest-component gap;
- `D0` = target gap;
- `σ` = tolerance;
- `B` = smallest component size divided by largest component size.

```text
DistanceScore =
    exp(
        -0.5 × ((D - D0) / σ)^2
    )

BalanceScore =
    clamp(B, 0, 1)

SeparationQuality =
    sqrt(
        DistanceScore
        × BalanceScore
    )
```

Distance has an ideal range. Moving components infinitely far apart does not create infinite reward.

### 13.3 Silhouette Profile

Used by exact Seals, Crowns, Eyes, and authored glyphs.

The selected cell set is normalized by translation and allowed transforms.

```text
SilhouetteQuality =
    1
```

only when the canonical signatures match. Approximate silhouette matching is not used for launch rewards.

### 13.4 Spine Profile

Typical terms:

- one component;
- aspect ratio;
- endpoint count;
- path efficiency;
- limited thickness.

```text
SpineQuality =
    geometricMean(
        AspectScore,
        EndpointScore,
        PathEfficiency
    )
```

### 13.5 Ring Profile

Typical terms:

- one component;
- target hole count;
- enclosure;
- hole area;
- boundary thickness.

```text
RingQuality =
    geometricMean(
        HoleCountScore,
        EnclosureScore,
        HoleAreaScore
    )
```

### 13.6 Bridge Profile

The selection must touch two named anchors.

```text
BridgeEfficiency =
    ShortestPossibleSelectedCells
    / ActualSelectedCells

BridgeQuality =
    sqrt(
        BridgeEfficiency
        × Cohesion
    )
```

### 13.7 Mirror Profile

```text
MirrorQuality =
    SymmetryScore
```

A Recipe may require balanced Shape or affinity counts across the symmetry axis.

### 13.8 Hybrid Profile

Grand Recipes may combine two or three profile scores through a weighted geometric mean.

```text
HybridQuality =
    product(score_i ^ weight_i)
```

Weights sum to `1`.

A zero required score invalidates the Recipe.

### 13.9 Quality Tiers

| Quality | Tier |
|---:|---|
| `<0.35` | Invalid |
| `0.35–0.59` | Valid |
| `0.60–0.79` | Strong |
| `0.80–0.94` | Masterwork |
| `0.95–1.00` | Perfect |

The thresholds may be overridden only by an authored Recipe and must be visible in its definition.

---

## 14. Fractures and Weakpoints

### 14.1 Purpose

Fractures give the infinite Field local goals and connect Rune Foundry to HLBM's Weakpoint language.

A Fracture is a visible cluster of marked cells with:

- geometry;
- affinity;
- optional critical status;
- one-time or repeatable reward;
- one Sector or Recipe relationship.

### 14.2 Launch Geometry

- Point: one cell.
- Line: two adjacent cells.
- Hook: three cells in an L.
- Fork: three or four branching cells.
- Seam: cells crossing a Sector or anchor boundary.
- Core: four-cell tetromino-shaped Weakpoint.

### 14.3 Resolution

#### Covered

All Fracture cells contain selected Blocks.

#### Matched

All Fracture cells are covered by matching-affinity Blocks.

#### Precise

One matching-affinity Block covers the complete Fracture.

### 14.4 Reward Multiplier

Let:

- `M` = Matched Fractures in the selection;
- `P` = Precise Fractures.

```text
WeakpointMultiplier =
    min(
        2.50,
        1 + 0.20M + 0.55P
    )
```

### 14.5 Fracture Consequence

On successful Submission:

- one-time Fractures are cleared;
- selected Blocks still disappear;
- the cleared cells become ordinary placeable cells or reveal a feature;
- Sector fog, an anchor, an Engine evolution, or a Commission may unlock.

A Fracture is not cleared by merely placing Blocks over it. Submission is the commitment.

### 14.6 Separation Weakpoints

Some Fractures invert the usual rule.

Examples:

- Orbit: components must remain separated around a central Weakpoint.
- Split Seal: two Fracture halves must be solved by different components.
- Empty Core: no selected Block may occupy the central Weakpoint; the selection must enclose it.

The Recipe card explicitly states the relationship.

---

## 15. Submission

### 15.1 Canonical Rule

> **Every Loose Block selected for a successful Submission is consumed and removed from the Field.**

There is no ordinary Submission mode that leaves selected Blocks behind.

Exceptions:

- Bind is a distinct action, not Submission.
- A Stencil may remain as ghost Blueprint Slots.
- a temporary afterimage may remain for presentation only.
- permanent Engine or landmark cells are never selected as consumable Blocks.

### 15.2 Selection

A Submission selection may come from:

- manual lasso;
- clicking a detected Pattern;
- a locked Stencil;
- an active Commission;
- a Fracture region.

The preview highlights exact Block IDs to be consumed.

Blocks outside the selection are unaffected even when adjacent.

### 15.3 Preview

The preview must show:

- Recipe and Quality tier;
- selected Block count and Shapes;
- average Grade;
- topology metrics;
- Fracture result;
- live Ash/s lost when Blocks disappear;
- Ash burst;
- Shards;
- Insight if first discovery;
- Engine XP and Shape Mastery;
- permanent effect;
- Stencil behavior after Submission;
- exact empty region after removal.

### 15.4 Quality Multiplier

For normalized Quality `Q`:

```text
QualityMultiplier =
    1 + 1.75 × Q^2
```

Range:

```text
Q = 0.35 → ×1.21
Q = 0.60 → ×1.63
Q = 0.80 → ×2.12
Q = 0.95 → ×2.58
Q = 1.00 → ×2.75
```

### 15.5 Material Power

```text
MaterialPower =
    sum(BlockValue_i)

ScaleFactor =
    N^0.30
```

where `N` is selected Block count.

### 15.6 Submission Power

```text
SubmissionPower =
    MaterialPower
    × ScaleFactor
    × QualityMultiplier
    × WeakpointMultiplier
    × DemandMultiplier
```

### 15.7 Ash Burst

Initial tuning:

```text
AshBurst =
    round(
        60 × SubmissionPower
    )
```

The coefficient is a tuning constant. The prototype should target a first Submission burst equal to roughly `3–6` minutes of current live production.

### 15.8 Shards

```text
ShardGain =
    floor(
        RecipeTier
        × sqrt(SubmissionPower)
        × (0.75 + 0.50Q)
    )
```

Minimum valid Submission grants at least `1` Shard unless the Recipe is explicitly tutorial-only.

### 15.9 Insight

Insight is granted primarily for first discovery.

```text
FirstDiscoveryInsight =
    2 × RecipeTier
    + ceil(N / 4)
```

Perfect first discovery may grant one additional Insight.

Repeat submissions do not ordinarily grant Insight.

### 15.10 Engine XP and Shape Mastery

```text
EngineXp =
    floor(
        N
        × AverageGrade
        × (0.50 + Q)
        × DemandMultiplier
    )

ShapeMasteryXp(shape) =
    SubmittedCount(shape)
    × AverageSubmittedGrade(shape)
    × (0.50 + Q)
```

A Recipe declares the target Engine. If no Engine target exists, XP is converted to Recipe Mastery.

### 15.11 Live Output Loss

The preview displays the exact change in live Field production after selected Blocks disappear.

This creates a real timing tradeoff:

- submitting now grants a permanent upgrade and empty space;
- waiting preserves temporary output and may improve Quality;
- adding more Blocks may raise Scale and contact;
- a Commission may expire after another Submission.

### 15.12 Atomic Submission Boundary

Submission is one durable transaction:

1. validate Recipe against current immutable selection;
2. freeze rewards and all target IDs;
3. remove selected Loose Blocks;
4. clear eligible Fractures;
5. grant resources and progression;
6. update Mastery, Commission, Stencil, and discovery records;
7. save atomically;
8. play presentation from frozen before/after data.

Restart may replay presentation only if it is harmless. It may never duplicate rewards or restore consumed Blocks.

### 15.13 Confirmation and Undo

- The preview is reversible.
- Confirmed Submission is irreversible.
- There is no post-commit Undo.
- The confirmation is skipped only for mastered auto-submit Stencils explicitly enabled by the player.
- High-value or first-time Submissions always require confirmation.

### 15.14 Presentation

A standard Submission sequence:

1. selected Blocks receive one clear outline;
2. shared edges illuminate according to the active topology profile;
3. Fractures resolve;
4. Blocks collapse, fragment, or fold toward a focal point;
5. the selected Blocks vanish;
6. the empty cells briefly preserve the silhouette as an afterimage;
7. rewards count upward;
8. the upgraded Engine or system responds;
9. Blueprint Slots reappear if the Stencil was preserved.

Duration targets:

| Tier | Duration |
|---|---:|
| Valid | `0.55–0.80s` |
| Strong | `0.75–1.00s` |
| Masterwork | `0.95–1.30s` |
| Perfect / first discovery | `1.30–2.00s` |
| Grand Recipe | `2.00–3.50s` |

---

## 16. Connected and Separated Submission Examples

### 16.1 Compression Press

Requirements:

- `4–10` Blocks;
- exactly one component;
- no permanent void inside the selected bounding box;
- Cohesion Quality at least `0.35`.

Primary objective:

```text
maximize shared edges
```

Effects:

- high Cohesion multiplier;
- XP to the linked Compact Engine;
- O and I Shape Mastery;
- Perfect result may grant `Compression Memory`, making Stencil refill faster.

### 16.2 Twin Stars

Requirements:

- exactly two components;
- equal Block count;
- no shared edges;
- mean nearest gap target `4` cells with tolerance `1.5`.

Primary objective:

```text
separate evenly, but not infinitely far
```

Effects:

- buffer-capacity upgrade;
- isolated Engine trait;
- O or T Block Grade progress;
- Masterwork result unlocks a two-Stencil parallel fill rule.

### 16.3 Hollow Crucible

Requirements:

- one component;
- exactly one enclosed hole;
- hole area `4–12` cells;
- minimum Cohesion.

Effects:

- every `N`th generated Block duplicates;
- Fire or Poison affinity progression;
- hole silhouette recorded in Codex.

### 16.4 Bridge of Ash

Requirements:

- selection touches Anchor A and Anchor B;
- one component;
- no Engine cell selected;
- efficient path.

Effects:

- new Sector Survey;
- Engine bonus can propagate between both anchor regions;
- I and L/J Mastery.

### 16.5 Sevenfold Prism

Requirements:

- at least one of all seven Shapes;
- one component;
- no same-Shape Block adjacency;
- minimum symmetry.

Effects:

- affinity system expansion;
- wildcard production;
- Grand Recipe progress.

---

## 17. Engine Binding

### 17.1 Bind Preview

Binding preview shows:

- Pattern name;
- permanent cells;
- bind Quality;
- Engine output;
- rate;
- Field Load;
- Engine trait;
- future upgrade Recipe;
- whether the Pattern can ever be bound again.

### 17.2 Bind Consequence

On confirm:

- selected Loose Blocks become Engine cells;
- they are not consumed;
- they stop contributing Loose Field output;
- they begin Engine production;
- the Engine is assigned a stable ID;
- first-bind rewards are granted;
- the Pattern's repeat Recipe becomes available.

### 17.3 Binding Quality

The Engine records `Qb`, its Quality at binding.

Production multiplier:

```text
0.75 + 0.50Qb
```

Quality cannot be improved by later upgrade Submissions. Rebinding is the improvement path.

### 17.4 Engine Topology Traits

The Pattern profile determines the Engine's positional preference.

| Profile | Typical Engine rule |
|---|---|
| Cohesion | gains from shared Engine boundaries |
| Separation | gains when no Engine is within target radius |
| Ring | gains from preserving its enclosed void |
| Bridge | propagates bonuses between distant zones |
| Mirror | copies part of a paired Engine's output |
| Fracture | improves matching-affinity Blocks |
| Grand | global rule change |

This makes the placement of persistent Engines matter without applying one universal adjacency rule.

### 17.5 Engine Capacity

Each Engine consumes Field Load according to size and tier.

```text
EngineLoad =
    ceil(BlockCount / 4)
    + RecipeTier
```

The Heart Engine has zero load.

Capacity upgrades come from:

- Submission;
- Fracture resolution;
- Recast;
- specific Engines.

---

## 18. Economy and Upgrades

### 18.1 Resources

| Resource | Primary source | Primary use |
|---|---|---|
| Ash | live Loose Blocks, Engines, Submission burst | Engine Levels, Survey, buffer, ordinary upgrades |
| Shards | Submission, Fractures, Commissions | Engine evolution, Grade, Field Load, automation |
| Insight | first Pattern discovery, Grand Recipes | hints, Codex branches, discovery tools, permanent unlocks |
| Blocks | Engine production | placement, Bind, Submission |
| Proofs | Recast | global permanent progression |

### 18.2 Engine Upgrade Cost

Suggested Ash cost:

```text
EngineUpgradeCost(level, tier) =
    round(
        25
        × 3.2^(level - 1)
        × 2^(tier - 1)
    )
```

XP and Ash are both required. This prevents pure waiting from replacing Recipe play.

### 18.3 Block Grade

Grade progress is earned through Shape Mastery and targeted Recipes.

Suggested threshold:

```text
GradeXpRequired(grade) =
    round(
        40 × 5^(grade - 1)
    )
```

Grade increases BlockValue by `×2`.

### 18.4 Shape Mastery

Each Shape has a persistent Mastery track.

Mastery can improve:

- its Engines' production speed;
- buffer capacity;
- auto-fill priority;
- Fracture effectiveness;
- one Shape-specific trait.

Example traits:

| Shape | Example identity |
|---|---|
| I | bridge efficiency and long-distance Stencils |
| O | compact density and buffer efficiency |
| T | branching and multi-output Engines |
| L/J | cornering, hooks, Fractures |
| S/Z | alternating weave and affinity chains |

### 18.5 Special Effects

A Recipe may grant a bounded special effect.

Examples:

- **Vacuum:** empty cells created by Submission generate Ash for `30s`.
- **Echo:** next Engine cycle duplicates one Block.
- **Overdrive:** target Engine speed `×2` for `5m`.
- **Memory:** preserved Stencil refills before ordinary buffer.
- **Compression:** next compact Submission treats one missing shared edge as present.
- **Orbit:** separated components gain temporary live output.
- **Catalyst:** blocks adjacent to a cleared Fracture gain temporary Grade value.
- **Reflow:** move one bound Engine after confirmation without Rebind cost.

Special effects must not create hidden compounding loops without caps.

### 18.6 Progression Burst Budget

Ordinary Submission target:

```text
2–6 minutes of current production
```

Masterwork target:

```text
5–12 minutes
```

Perfect first-time or Commission target:

```text
10–25 minutes
```

Grand Recipe may exceed these ranges because it closes a chapter.

---

## 19. Automation and Idle Progress

### 19.1 Offline Production

Offline progress may:

- advance Engine cycles;
- fill Block buffers;
- fill approved Stencil Slots;
- complete a Recipe Stencil to `READY`;
- advance timed effects within their documented rules.

Offline progress may not:

- discover a new Pattern;
- bind an Engine;
- submit a first-time Recipe;
- choose between multiple valid selections;
- spend Insight;
- Recast.

### 19.2 Offline Cap

Launch target:

```text
BaseOfflineCap = 8 hours
```

Permanent upgrades may raise the cap.

### 19.3 Stencil Auto-Fill

Auto-fill requires:

- discovered Recipe;
- saved Stencil;
- Recipe Mastery `≥5`;
- explicit enable;
- valid surveyed cells;
- available Blocks.

### 19.4 Auto-Submit

Auto-submit requires:

- Recipe Mastery `≥10`;
- a locked exact Stencil;
- no first-time reward;
- no unresolved Fracture choice;
- no alternative valid selection;
- explicit minimum Quality;
- explicit reserve rules for each Shape.

The player can specify:

```text
Do not auto-submit if buffer for any required Shape would fall below X.
```

### 19.5 Production Priorities

The player may set Engine output priority:

- balanced;
- active Commission;
- selected Recipe;
- selected Stencil;
- manual per-Shape weights.

The UI shows estimated time to:

- one missing Block;
- Stencil completion;
- Recipe readiness;
- buffer saturation.

### 19.6 Idle Failure Prevention

The game must avoid:

- filling the Field with unapproved placements;
- consuming Blocks needed for a discovery plan;
- submitting lower Quality than the configured threshold;
- overflowing buffers without clear notice;
- silently pausing all Engines due to one global cap.

---

## 20. Recast and Long-Term Progression

### 20.1 Recast Unlock

First Recast requires:

- all seven Shapes unlocked;
- at least `7` bound Engines;
- at least `12` discovered Recipes;
- at least `3` Masterwork Submissions;
- one Grand Recipe;
- one resolved Signature Fracture.

### 20.2 Recast Effect

Recast:

- archives the current Field snapshot;
- clears Loose Blocks, Stencils, ordinary buffers, temporary effects, and non-foundational Engines;
- preserves the Codex, Pattern records, Shape Mastery, Block Grades, accessibility settings, and monetization state;
- converts selected Engines and achievements into Proofs;
- begins a new 4×4 Cradle with faster reconstruction.

The archived Field remains viewable.

### 20.3 Proof Gain

Suggested formula:

```text
Proofs =
    floor(
        sqrt(UniqueRecipes)
        × (1 + PerfectSubmissions)^0.40
        × (1 + TotalEngineLevels)^0.30
        × GrandRecipeFactor
    )
```

The exact tuning must be simulated.

### 20.4 Recast Permanent Effects

Proofs may unlock:

- additional starting Blocks;
- faster Heart Engine;
- more Engine carryover;
- wider starting Survey;
- second active Commission;
- additional Stencil;
- automatic known-Pattern analysis;
- higher Grade floor;
- advanced Pattern families.

### 20.5 First Authored Ending

The first ending should require approximately:

- `21–28` discovered Recipes;
- all seven Shape Engines represented;
- multiple connected and separated Masterwork records;
- at least three Recasts;
- one final Grand Pattern using Engines as landmarks and Loose Blocks as consumable material.

The final Submission reveals that the Foundry's output is becoming the Rune supply used by the Delver in HLBM.

### 20.6 Endless Mode

After the ending:

- Sectors continue deterministically;
- Recipe tiers scale;
- daily seeds unlock;
- Pattern code sharing unlocks;
- public score focuses on Quality and discovery, not purchased boosts.

---

## 21. Web UX and Presentation

### 21.1 Desktop Layout

Recommended default:

- top: Ash, Shards, Insight, Field Load, buffer;
- center: zoomable Field;
- left: Block palette, rotation, Stencils;
- right: active Recipe/Commission, metrics, preview, Codex hints;
- bottom: Engine production queue and timeline.

The Field remains the visual hero.

### 21.2 Mobile Layout

Mobile uses:

- full-screen Field;
- collapsible bottom Block tray;
- one context sheet for Recipe and preview;
- pinch zoom;
- one-finger place;
- two-finger pan;
- explicit rotation buttons;
- large `ANALYZE`, `BIND`, and `SUBMIT` actions.

No hover-only information.

### 21.3 Recipe Focus

Focusing a Recipe:

- colors valid candidate Blocks;
- shows required topology;
- displays the active Quality meter;
- indicates whether contact should increase or decrease;
- highlights relevant Fractures;
- shows missing Shapes and ETA.

Examples:

```text
COMPRESSION
One component
Shared contact: 9 / 12
Quality: 0.82 · Masterwork
```

```text
TWIN STARS
Two components
Gap: 3.2 / target 4.0
Balance: 100%
Quality: 0.91 · Masterwork
```

### 21.4 Discovery Feedback

Near-match states use specific language:

- `One more shared edge would reach Masterwork.`
- `The inner void still touches the outside.`
- `Three components found; this rumor asks for two.`
- `The right half is not mirrored.`
- `The Fire Hook is covered, but not by one Block.`

### 21.5 Submission Clarity

The confirm button must state consumption:

```text
SUBMIT 6 BLOCKS
```

not merely `SUBMIT`.

The preview shows a red or ash outline around every Block that will disappear.

### 21.6 Large Field Navigation

Zoom levels:

- Block view: exact cells, rotations, Fractures.
- Pattern view: selections, Stencils, Engine auras.
- Engine view: persistent factory topology and output.
- Atlas view: Sectors, landmarks, archived Submission afterimages.

Search and jump targets:

- active Commission;
- incomplete Stencil;
- full buffer source;
- Ready Pattern;
- Fracture;
- Engine.

### 21.7 Accessibility

Required:

- color-independent Shape and affinity symbols;
- reduced motion;
- reduced flash;
- scalable text;
- keyboard navigation;
- visible focus;
- high-contrast Pattern outlines;
- no audio-only timing information;
- exact numeric mode for formulas.

---

## 22. Monetization and Distribution

### 22.1 Principles

The game is complete without ads.

Rewarded ads may:

- add `50%` to already-calculated offline Block production;
- activate `×2` Engine speed for `10m`;
- advance one known Stencil by a bounded amount.

Rewarded ads may not:

- discover a Pattern;
- satisfy Analyze;
- create a Block arrangement;
- Bind an Engine;
- submit Blocks;
- grant Insight, Proofs, Perfect Quality, or first-time rewards;
- alter public score validity.

### 22.2 Interstitials

No forced interstitial is required for the owned-site build.

Portal builds may use sparse chapter-transition interstitials only if required by platform policy and never:

- during placement;
- during Analyze;
- before Submission confirmation;
- during Pattern discovery presentation;
- more than once per documented cooldown.

### 22.3 HLBM Conversion

The HLBM call to action appears only after meaningful engagement:

- first Recast;
- first ending;
- optional Codex lore;
- owned-site menu after a minimum play threshold.

It does not cover the Field during ordinary play.

---

## 23. Save, Offline, and Integrity

### 23.1 Save Envelope

The save includes:

- schema version;
- content version;
- deterministic seed;
- currencies;
- Block Grades and Shape Mastery;
- buffers;
- Engine states and exact cells;
- Loose Blocks and exact cells;
- Blueprints and Stencils;
- surveyed Sectors;
- Fractures;
- Codex, Recipe, Commission, and Mastery state;
- Recast records;
- timestamps;
- transaction ledger;
- checksum.

### 23.2 Save Frequency

Save after:

- Block placement or removal;
- Blueprint or Stencil change;
- Pattern discovery;
- Bind;
- Submission;
- Engine upgrade;
- Grade increase;
- Sector reveal;
- Recast;
- app visibility loss;
- periodic idle checkpoint.

### 23.3 Atomic Bind

Bind is atomic:

1. validate Pattern and IDs;
2. freeze Engine definition and Quality;
3. convert Loose Blocks to Engine cells;
4. grant rewards;
5. update Codex and capacity;
6. save;
7. present.

### 23.4 Atomic Submission

Submission follows §15.12.

A stable transaction ID prevents duplicate rewards.

### 23.5 Offline Equivalence

The offline simulator must produce the same buffers and Stencil completion as online simulation within deterministic rounding contracts.

It advances event-to-event rather than frame-by-frame.

### 23.6 Clock Handling

Use trusted monotonic session time while active and persisted wall-clock delta on return.

Clamp:

- negative delta to zero;
- absurd future delta to configured maximum;
- offline progress to cap.

### 23.7 Export and Reset

Provide:

- copyable compressed export;
- import with schema validation;
- hard reset behind typed confirmation;
- archived Field gallery independent of active save where technically feasible.

---

## 24. Technical Architecture

### 24.1 Default Stack

Recommended:

- TypeScript;
- Vite;
- Canvas 2D renderer for Phase A (WebGL evaluated in Phase B+ only if measured rendering performance requires it);
- IndexedDB primary save with localStorage recovery metadata;
- Web Worker background entry points for offline simulation and heavy analysis when profiling demonstrates need;
- no mandatory server for core play.

### 24.2 Dependency Direction & Package Boundaries

Canonical dependency rules:

```text
                 content
                    │
                    ▼
core ◄──────── application ◄──────── ui
                    ▲
                    │
                 platform

tools ────────────► core/content
```

Future Workers:
```text
workers ──────────► core/content
```

- `core` → pure deterministic domain; imports nothing outside core; knows nothing about storage, clocks, analytics, Worker RPC, DOM, or browser infrastructure;
- `content` → may import core types/contracts; does not depend on UI/platform;
- `application` → orchestrates domain operations; defines side-effect ports/interfaces when needed; may import core + content;
- `ui` → dispatches application actions and renders state; may import application and core types; must not implement game rules;
- `platform` → implements application-side ports using browser APIs; owns browser side effects; is NOT a parent or child layer of UI;
- `main.ts` → composition root that wires application, platform, and UI together;
- `workers` → alternate execution environments (not architectural layers) calling canonical core/content algorithms; materialized when offloading/offline features are implemented;
- `tools` → may import core + content; executable balance/geometry tooling lives in `tools/` and reuses canonical `src/core` algorithms;
- `tests` → may exercise any relevant production module.

Target Architecture Map:

```text
src/core/       (coordinates, shapes, blocks, engines, field, topology, patterns, recipes, submission, progression, economy, offline, save)
src/content/    (sectors, fractures, patterns, recipes, commissions, progression)
src/application/(actions, state)
src/platform/   (storage, clock, worker-adapter, analytics)
src/workers/    (geometry-analysis.worker.ts, offline-simulation.worker.ts — materialized when implemented)
src/ui/         (renderer [Canvas 2D], camera, input, overlays, codex, recipe-panel, submission-preview, accessibility, styles)
tools/          (balance-sim, pattern-validator, sector-validator, save-migrator)
tests/          (unit, property, content, actions, persistence, equivalence, integration)
```

### 24.3 Pure Actions

Consequential actions are typed and pure before commit:

```text
PlaceBlock
MoveBlock
ReturnBlock
PlaceBlueprint
SaveStencil
AnalyzeSelection
BindPattern
SubmitRecipe
UpgradeEngine
ChooseEvolution
SurveySector
Recast
```

### 24.4 Geometry Resolver

One canonical resolver computes all topology metrics.

It receives immutable:

- terrain mask;
- selected Block cell sets;
- Engine masks when relevant;
- anchors;
- Fractures;
- Recipe profile.

It returns immutable:

- validity;
- Quality;
- metrics;
- near-match reasons;
- canonical signature;
- reward inputs.

UI never reimplements geometry formulas.

### 24.5 Pattern Signatures

Exact silhouette signatures are canonicalized by:

1. collecting occupied cells;
2. translating minimum coordinate to origin;
3. generating allowed rotations/reflections;
4. sorting coordinates;
5. selecting lexicographically smallest representation.

Topology Patterns use metric predicates rather than exact signatures.

### 24.6 Spatial Index

Use chunked sparse maps and per-chunk indexes for:

- occupied cells;
- Block IDs;
- Engine IDs;
- Blueprint IDs;
- features;
- dirty regions.

A placement invalidates only nearby Pattern caches.

### 24.7 Performance Targets

Desktop:

- `60fps` ordinary camera and placement;
- Analyze of `24` selected Blocks under `16ms` main-thread budget or Worker result under `50ms`;
- load `5,000` visible cells without interaction hitch;
- save commit under `100ms` median.

Mobile:

- `30fps` minimum under ordinary load;
- responsive placement under `80ms`;
- no unbounded DOM node per cell.

---

## 25. QA, Balance, and Analytics

### 25.1 Formula Tests

Test:

- BlockValue;
- production;
- Cohesion and Amax;
- components;
- distances;
- symmetry;
- holes;
- Quality tiers;
- SubmissionPower;
- Ash, Shards, XP;
- Grade and Engine thresholds;
- Recast.

### 25.2 Geometry Property Tests

Properties:

- translation does not change Quality;
- allowed rotation does not change exact signature;
- adding a shared edge cannot lower pure Cohesion Quality;
- moving separated components infinitely far does not exceed target-distance score;
- Submission selection never includes Engine cells;
- selected Blocks are all removed exactly once;
- unselected Blocks never move or disappear;
- Stencil preservation creates ghosts, not physical Blocks.

### 25.3 Content Tests

Every Recipe includes:

- at least one valid fixture;
- at least one invalid near-match;
- one minimum-Quality case;
- one Perfect case when Perfect is possible;
- hint coverage;
- reward bounds;
- no impossible current-progression requirements.

### 25.4 Balance Bot Profiles

Simulate:

- optimizer favoring compact Recipes;
- optimizer favoring separated Recipes;
- discovery-focused player;
- repetitive lowest-effort player;
- idle player using Stencils;
- manual active player;
- no-ad player;
- ad-using player;
- poor-topology player;
- Perfect-quality player.

No single early Recipe should exceed:

```text
40% of optimal total progression
```

across the first two hours.

### 25.5 Analytics Events

Key events:

```text
first_block_placed
heart_seal_detected
first_engine_bound
pattern_analyzed
pattern_discovered
recipe_near_match
recipe_ready
submission_previewed
submission_confirmed
submission_quality
blocks_consumed
stencil_saved
stencil_refilled
engine_level_up
block_grade_up
fracture_matched
fracture_precise
sector_surveyed
recast
ending_reached
```

### 25.6 Product Gates

#### First Bind Gate

- At least `80%` of new players bind the Heart Seal without external explanation.
- Median time under `6m`.

#### Submission Comprehension Gate

After first Submission, at least `85%` of testers correctly answer:

> What disappeared, and what stayed?

Correct answer:

> Submitted Loose Blocks disappeared; the bound Engine stayed.

#### Topology Gate

By 25 minutes, at least `70%` of testers can explain why Compression wants contact and Twin Stars wants separation.

#### Discovery Gate

At least `60%` of testers intentionally alter a layout in response to a rumor or near-match clue.

#### Idle Gate

Returning testers understand which Stencil filled and why.

#### Fun Gate

Prototype does not proceed to full campaign unless testers voluntarily:

- rebuild one submitted Pattern;
- improve a prior Quality score;
- or pursue one undiscovered rumor.

---

## 26. Development Scope

### 26.1 Phase A — Core Fun Prototype

Implement only:

- 4×4 Cradle;
- `I/O/L/J` Blocks;
- Heart Seal discovery and Bind;
- one Heart Engine;
- Block buffer and timed generation;
- manual placement and return;
- Analyze;
- Compression Recipe;
- Twin Stars Recipe;
- live Cohesion and Separation meters;
- Submission preview;
- selected Blocks disappearing;
- Ash, Shards, Engine XP;
- one preserved Stencil;
- save/load;
- one short Submission animation.

Do **not** implement:

- ads;
- Recast;
- full affinities;
- large Sector generation;
- all seven Shapes;
- Grand Recipes;
- complex automation.

Prototype question:

> Is it satisfying to preserve the first discovered Pattern as a generator, then repeatedly rebuild and consume spatially optimized copies to improve it?

### 26.2 Phase B — Public Vertical Slice

Add:

- all seven Shapes;
- `6–8` Recipes across at least four topology profiles;
- first Fracture;
- irregular Sector expansion;
- three Engines;
- Shape Mastery and one Grade increase;
- Recipe Commissions;
- three Stencils;
- offline progress;
- first Masterwork and Perfect presentation;
- 60–120 minutes of structured play.

### 26.3 Phase C — First-Ending Campaign

Add:

- full launch Recipe catalog;
- Engine evolution;
- advanced Fractures;
- Grand Recipes;
- Recast;
- archived Field gallery;
- authored ending;
- endless unlock;
- analytics and balance harness.

### 26.4 Phase D — Monetization and Distribution

Only after retention and fun gates:

- rewarded ads;
- owned-site conversion;
- portal SDK builds;
- platform policy variants;
- public Pattern code sharing.

### 26.5 Explicit Scope Cuts

Cut before weakening the core loop:

- real-time multiplayer;
- user-authored scripting;
- dynamic economy marketplace;
- physics-based Block movement;
- 3D renderer;
- synchronous server requirement;
- procedural hidden Recipes without validated hints;
- free-form auto-placement AI;
- forced interstitial pacing.

---

## 27. Locked Decisions and Open Tuning Questions

### 27.1 Locked Decisions

- The Field starts as a 4×4 Cradle and can expand without a small fixed rectangle.
- Blocks are tetromino pieces occupying four cells.
- First successful copies of bindable Patterns may become persistent Engines.
- Submitted Loose Blocks always disappear.
- Stencils may remain after Blocks disappear.
- Connected contact is the default bonus for compact Recipes.
- Some named Recipes explicitly reward separation or other topology.
- Recipe discovery comes from building and analyzing shapes.
- Hints prevent blind hidden-recipe guessing.
- Engines generate future Blocks.
- Submission upgrades Engines, Blocks, Field rules, or progression.
- Offline simulation never invents a layout or first discovery.
- The prototype must validate Bind → Generate → Arrange → Submit → Disappear → Upgrade before broader systems.

### 27.2 Prototype Tuning Questions

- Should the Heart Engine produce a weighted random Shape or a deterministic rotation?
- Is the first buffer `8`, `12`, or `16` Blocks?
- Does live Field Ash create a useful timing tradeoff or unnecessary clutter?
- Should Analyze be manual-only after the tutorial, or should obvious Patterns auto-prompt?
- Is `0.95` the correct Perfect threshold?
- Should Rebinding preserve Engine Level?
- How many active Commissions avoid choice overload?
- Should separated Recipes use exact target distance or a broad valid band?
- Does Field Load need to count Stencils as heavily as Engines?
- At what Mastery should auto-submit unlock?

### 27.3 Final Product Test

The product succeeds only if the player can truthfully say:

> I discovered how a shape works, left its first form behind as a machine, then rebuilt and sacrificed better versions because their geometry changed what I earned.

---

# Appendix A — Initial Recipe Catalog

## A.1 Heart Seal

| Field | Value |
|---|---|
| Tier | 0 |
| Bind | Required |
| Material | Starter `I/O/L/J` |
| Topology | exact 4×4 fill |
| Engine | Heart Engine |
| Output | deterministic rotating `I/O/L/J` |
| First reward | Codex, first Survey, Block buffers |

## A.2 Compression Press

| Field | Value |
|---|---|
| Tier | 1 |
| Bind | Optional |
| Material | any `4–10` Blocks |
| Topology | one component, Cohesion |
| Engine | Compact Press |
| Repeat reward | Compact Engine XP, O/I Mastery |
| Perfect effect | Compression Memory |

## A.3 Long Current

| Field | Value |
|---|---|
| Tier | 1 |
| Bind | Optional |
| Material | at least three I-dominant Blocks |
| Topology | Spine |
| Engine | Current Engine |
| Repeat reward | I Grade progress, Survey range |
| Special | efficient Bridges |

## A.4 Twin Stars

| Field | Value |
|---|---|
| Tier | 1 |
| Bind | Optional |
| Material | even Block count |
| Topology | two equal separated components |
| Engine | Binary Array |
| Repeat reward | buffer and parallel Stencil upgrades |
| Special | isolated Engine evolution |

## A.5 Hook Lock

| Field | Value |
|---|---|
| Tier | 1 |
| Bind | Submit-only first, bindable upgrade later |
| Material | L/J with matching affinity |
| Topology | Precise Hook Fracture |
| Reward | L/J Mastery, Fracture Lens |
| Special | clear first locked Sector |

## A.6 Branch Memory

| Field | Value |
|---|---|
| Tier | 2 |
| Bind | Optional |
| Material | T-dominant |
| Topology | Branch with three endpoints |
| Engine | Branch Engine |
| Reward | multi-output production |

## A.7 Weave Loom

| Field | Value |
|---|---|
| Tier | 2 |
| Bind | Optional |
| Material | alternating S/Z |
| Topology | connected weave |
| Engine | Weave Loom |
| Reward | S/Z production and affinity alternation |

## A.8 Hollow Crucible

| Field | Value |
|---|---|
| Tier | 2 |
| Bind | Optional |
| Material | any |
| Topology | one enclosed hole |
| Engine | Hollow Crucible |
| Reward | duplication and Fire/Poison progression |

## A.9 Mirror Furnace

| Field | Value |
|---|---|
| Tier | 2 |
| Bind | Optional |
| Material | balanced halves |
| Topology | reflection symmetry |
| Engine | Mirror Furnace |
| Reward | copy part of paired Engine output |

## A.10 Bridge of Ash

| Field | Value |
|---|---|
| Tier | 2 |
| Bind | Submit-only |
| Material | I/L/J favored |
| Topology | touches two anchors |
| Reward | Survey and network propagation |

## A.11 Fourfold Constellation

| Field | Value |
|---|---|
| Tier | 3 |
| Bind | Optional |
| Material | four balanced components |
| Topology | target-distance separation around landmark |
| Engine | Constellation Array |
| Reward | global buffer and isolated production |

## A.12 Sevenfold Prism

| Field | Value |
|---|---|
| Tier | 3 |
| Bind | GrandBind |
| Material | all seven Shapes |
| Topology | connected, no same-Shape contact, symmetry |
| Engine | Prism Engine |
| Reward | wildcard production and Grand Recipe access |

---

# Appendix B — Worked Submission Examples

## B.1 Perfect Four-Block Compression

Assume:

```text
N = 4
all Blocks Grade 1
MaterialPower = 4 × 4 = 16
Cohesion = 1.00
Q = 1.00
WeakpointMultiplier = 1.00
DemandMultiplier = 1.00
```

Then:

```text
ScaleFactor = 4^0.30 ≈ 1.516
QualityMultiplier = 2.75

SubmissionPower =
    16 × 1.516 × 2.75
    ≈ 66.7

AshBurst =
    round(60 × 66.7)
    ≈ 4,002

ShardGain =
    floor(
        1 × sqrt(66.7) × 1.25
    )
    = 10
```

All four selected Blocks disappear. A preserved Stencil may remain and begin refilling.

## B.2 Valid but Loose Compression

Assume the same material with:

```text
Q = 0.50
QualityMultiplier =
    1 + 1.75 × 0.25
    = 1.4375
```

```text
SubmissionPower ≈
    16 × 1.516 × 1.4375
    ≈ 34.9

AshBurst ≈ 2,094
```

The player receives roughly half the Perfect burst and less Engine XP.

## B.3 Twin Stars at Ideal Distance

Assume:

```text
N = 6
two components of 3 Blocks
no shared edges between components
D = D0
BalanceScore = 1
Q = 1
```

The selection receives the full separated topology multiplier even though global Cohesion is low. The Recipe, not a universal adjacency rule, determines Quality.

## B.4 Submission Removes a Bridge

If selected Loose Blocks were the only live connection between two loose clusters:

- the selected bridge Blocks disappear;
- the remaining clusters become disconnected;
- their live contact output recalculates;
- Engines and terrain remain;
- no automatic movement occurs;
- a preserved Bridge Stencil may refill the gap later.

---

# Appendix C — Opening Pacing Targets

| Milestone | Target |
|---|---:|
| First Block placement | `<30s` |
| Heart Seal detected | `2–4m` |
| Heart Engine bound | `3–6m` |
| First generated Block | `<30s` after Bind |
| First consumptive Submission | `8–15m` |
| First saved Stencil | `12–20m` |
| First connected versus separated choice | `15–25m` |
| First Fracture | `25–45m` |
| First new Engine beyond Heart | `30–60m` |
| First Grade increase | `45–90m` |
| First Recast | `5–10h` active |
| First ending | `12–20h` active |

---

# Appendix D — Prototype Acceptance Checklist

The Phase A prototype is acceptable only when all statements are true:

- A new player understands the first 4×4 task without a paragraph of instructions.
- The player understands that Bind preserves Blocks as an Engine.
- The player understands that Submission consumes selected Loose Blocks.
- Moving one Block to add contact visibly improves Compression reward.
- Moving components apart visibly improves Twin Stars reward within its target range.
- The player voluntarily rebuilds at least one submitted Pattern.
- The empty space after Submission feels useful rather than punitive.
- Engine production creates anticipation for the next spatial plan.
- A preserved Stencil makes the idle loop legible.
- No panel is required to explain why a Recipe is valid or invalid.
