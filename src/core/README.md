# Core Domain (`src/core`)

The `core` directory contains the pure, deterministic game model for **HL;BM — Rune Foundry**.

## Responsibilities
- **`coordinates`**: Chunked sparse grid math, cell bounds, vector translation/rotation helpers.
- **`shapes`**: Tetromino definitions (`I`, `O`, `T`, `L`, `J`, `S`, `Z`), orientation matrices, cell masks.
- **`blocks`**: Loose Block state, Grade power scaling (`BlockValue`), affinities, per-Shape buffers.
- **`engines`**: Bound Engine state, production rate formulas, Level XP thresholds, evolution traits, rebinding.
- **`field`**: Chunked sparse Field state, cell layers (terrain, engine, loose block, blueprint, overlay), Field Load limits.
- **`topology`**: Canonical geometry resolver (connected components, inter-Block shared edges, Cohesion, bounding density, symmetry, holes, distance, aspect ratio, bridges).
- **`patterns`**: Spatial pattern evaluation predicates, motif definitions, candidate selection, silhouette canonicalization.
- **`recipes`**: Recipe validity predicates, Quality tier formulas (`0..1`), demand multipliers, mastery thresholds.
- **`submission`**: Atomic submission transaction rules, material power, Ash bursts, Shard gains, Insight grants.
- **`progression`**: Shape Mastery, Recast mechanics, Proof gain formulas, milestones, ending criteria.
- **`economy`**: Pure currency math for Ash, Shards, Insight, Proofs.
- **`offline`**: Deterministic event-driven offline progress resolution and cap handling.
- **`save`**: Save envelope schema definitions, serialization contracts, transaction ledger, atomic checksums.

## Strict Rules
- **Pure Deterministic Domain**: `core` knows nothing about storage, clocks, analytics, Worker RPC, DOM, or browser infrastructure. Defines zero side-effect ports or platform abstractions.
- **Zero Outside Imports**: `core` imports nothing outside core (never imports `application`, `ui`, `platform`, or `workers`).
- **No UI/DOM/Platform dependencies**: Zero imports from `window`, `document`, Canvas, WebGL, CSS, UI components, IndexedDB, localStorage, or Worker APIs.
- **Single Source of Truth**: All game rules, geometry math, and formulas live exclusively in `core`.
