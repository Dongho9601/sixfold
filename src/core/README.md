# Core Domain (`src/core`)

The `core` directory contains the pure, deterministic game model for **HL;BM — Rune Foundry**.

## Responsibilities
- **`coordinates`**: Sparse coordinate grid math (`x, y`), cell bounds, vector translation/rotation helpers.
- **`shapes`**: Tetromino definitions (`I`, `O`, `T`, `L`, `J`, `S`, `Z`), orientation matrices, cell masks.
- **`blocks`**: Loose Block state, Grade power scaling (`BlockValue`), per-Shape buffers.
- **`engines`**: Multiple Bound Engine instances, persisted deterministic shuffled 7-bags, and production rates.
- **`field`**: Sparse Field state, cell layers (terrain, engine, loose block, blueprint, overlay), Field Load limits.
- **`topology`**: Canonical geometry resolver (connected components, inter-Block shared edges, Cohesion, bounding density, symmetry, holes, distance, aspect ratio, bridges).
- **`patterns`**: Spatial pattern evaluation predicates, motif definitions, candidate selection, silhouette canonicalization.
- **`recipes`**: Recipe validity predicates, Quality tier formulas (`0..1`).
- **`submission`**: Atomic Pattern Bind and ordinary Engine Submit/Shard rules.
- **`progression`**: Shape Grade spending and BlockValue scaling; broader campaign progression is deferred.
- **`economy`**: Pure Engine power, Shard reward, and Shape Grade math.
- **`offline`**: Deterministic event-driven offline progress resolution and cap handling.
- **`save`**: Save envelope schema definitions, serialization contracts, transaction ledger, atomic checksums.

## Strict Rules
- **Pure Deterministic Domain**: `core` knows nothing about storage, clocks, analytics, DOM, or browser infrastructure. Defines zero side-effect ports or platform abstractions.
- **Zero Outside Imports**: `core` imports nothing outside core (never imports `application`, `ui`, or `platform`).
- **No UI/DOM/Platform dependencies**: Zero imports from `window`, `document`, Canvas, WebGL, CSS, UI components, IndexedDB, or localStorage.
- **Single Source of Truth**: All game rules, geometry math, and formulas live exclusively in `core`.
