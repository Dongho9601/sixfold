# Repository Architecture & Directory Structure

> **Game Title:** HL;BM — Rune Foundry  
> **Document Status:** Authoritative repository architecture specification  
> **Last Updated:** 2026-08-09  

---

## 1. Directory Structure

### 1.1 Physical Repository Scaffold (Current State)

The physical repository reflects **what exists now** with a clean, minimal scaffold representing implemented responsibilities without empty placeholder directories, `.gitkeep` files, or un-implemented Worker scripts:

```text
hold_less_be_more_rune_foundry/
├── Docs/
│   ├── spec.md                       # Canonical game specification (Authoritative)
│   ├── directory_structure.md        # Repository architecture guide (This document)
│   ├── rune_foundry_plan.md          # Implementation phases and task breakdown
│   └── rune_foundry_analytics.md     # Analytics telemetry schema and event contracts
├── public/                           # Static public web assets host
├── src/
│   ├── core/                         # Pure deterministic game model (0 DOM/UI dependencies)
│   │   ├── README.md                 # Core domain responsibilities & rules
│   │   └── index.ts                  # Core package export barrel
│   ├── content/                      # Declarative authored content data
│   │   ├── README.md                 # Authored content responsibilities & rules
│   │   └── index.ts                  # Content package export barrel
│   ├── application/                  # Orchestration and typed action dispatchers
│   │   ├── README.md                 # Application layer responsibilities & rules
│   │   └── index.ts                  # Application package export barrel
│   ├── platform/                     # Browser-specific infrastructure & adapters
│   │   ├── README.md                 # Platform infrastructure responsibilities & rules
│   │   └── index.ts                  # Platform package export barrel
│   ├── ui/                           # Visual presentation, rendering, and input handling
│   │   ├── README.md                 # UI layer responsibilities & rules
│   │   └── index.ts                  # UI package export barrel
│   ├── main.ts                       # Browser composition root & entry point
│   └── vite-env.d.ts                # Vite environment type declarations
├── tools/                            # Standalone non-runtime CLI development tools
│   └── README.md                     # Tools responsibilities & rules
├── tests/                            # Comprehensive test suites
│   └── README.md                     # Testing suites guide
├── index.html                        # Vite HTML entry point
├── package.json                      # Dependency manifest and npm scripts
├── tsconfig.json                     # TypeScript compiler configuration & path aliases
├── vite.config.ts                    # Vite build tool configuration
└── README.md                         # Project overview
```

### 1.2 Target Architecture Map (Intended Systems Locations)

As features are implemented, new modules will be placed strictly within the following documented architectural locations:

```text
src/
├── core/
│   ├── coordinates/                  # Grid math, chunk bounds, vector translations
│   ├── shapes/                       # Tetromino matrices, rotations, cell masks
│   ├── blocks/                       # Loose Block state, BlockValue formulas, grade tiers, buffers
│   ├── engines/                      # Bound Engine state, output rates, level XP, evolution traits
│   ├── field/                        # Sparse chunked Field state, cell layers, Field Load capacity
│   ├── topology/                     # Canonical geometry resolver (Cohesion, components, holes, symmetry)
│   ├── patterns/                     # Pattern evaluation predicates, motifs, candidate selection
│   ├── recipes/                      # Recipe validity, Quality tier formulas (0..1), demand multipliers
│   ├── submission/                   # Atomic submission transaction, Ash bursts, Shards & Insight rewards
│   ├── progression/                  # Shape Mastery, Recast mechanics, Proof gains, ending rules
│   ├── economy/                      # Pure resource formulas (Ash, Shards, Insight, Proofs)
│   ├── offline/                      # Event-to-event deterministic offline progress resolver
│   └── save/                         # Save envelope schema, serialization contracts, checksums
├── content/
│   ├── sectors/                      # Authored Sector chunk masks, survey gates, voids, landmarks
│   ├── fractures/                    # Fracture weakpoint definitions (Point, Line, Hook, Fork, Core)
│   ├── patterns/                     # Authored Pattern definitions, Codex rumors, hint progressions
│   ├── recipes/                      # Authored Recipe catalog (A.1 Heart Seal .. A.12 Sevenfold Prism)
│   ├── commissions/                  # Commission templates and demand rotation tables
│   └── progression/                  # Shape Mastery trait trees, evolution trees, Recast gates
├── application/
│   ├── actions/                      # Typed consequential action handlers (PlaceBlock, SubmitRecipe, etc.)
│   └── state/                        # Session state container, active selection, view mode
├── platform/
│   ├── storage/                      # IndexedDB persistence adapter & localStorage recovery
│   ├── clock/                        # Monotonic session timer & wall-clock delta handler
│   ├── worker-adapter/               # Worker thread message passing & RPC bridges
│   └── analytics/                    # Telemetry dispatcher implementing spec event schema
├── workers/                          # Materialized only when off-thread Worker functionality is implemented
│   ├── geometry-analysis.worker.ts   # Off-thread heavy geometry analysis worker (when profiling demonstrates need)
│   └── offline-simulation.worker.ts   # Off-thread long offline simulation worker (Phase B)
├── ui/
│   ├── renderer/                     # Canvas 2D view layer for terrain, engines, blocks, ghosts
│   ├── camera/                       # Zoom levels (Block/Pattern/Engine/Atlas), viewport panning
│   ├── input/                        # Mouse/touch/gesture handlers, shortcut bindings, drag-drop
│   ├── overlays/                     # Live Cohesion/Separation quality meters, resonance traces
│   ├── codex/                        # Codex UI panel, rumor hint view, stencil browser
│   ├── recipe-panel/                 # Active Recipe focus, metrics, missing block ETAs
│   ├── submission-preview/           # Irreversible consumption confirmation modal & before/after view
│   ├── accessibility/                # High-contrast mode, reduced motion, text indicators, focus navigation
│   └── styles/                       # CSS design tokens, themes, layout stylesheets
tools/
├── balance-sim/                      # Deterministic economy and pacing simulator tool
├── pattern-validator/                # Topology metrics and Pattern/Recipe fixture validator tool
├── sector-validator/                 # Sector mask and layout integrity checker tool
└── save-migrator/                    # Save schema migration tool
tests/
├── unit/                             # Core formula unit tests
├── property/                         # Geometry invariant & property tests
├── content/                          # Recipe and Pattern content fixture tests
├── actions/                          # Typed action handler and transaction boundary tests
├── persistence/                      # IndexedDB/localStorage serialization & migration tests
├── equivalence/                      # Online vs offline simulation equivalence tests
└── integration/                      # Full loop integration tests
Docs/
└── Balance/                          # Pacing milestone targets and tolerance datasets (e.g. rune_foundry_targets.json)
```

---

## 2. Purpose of Major Directories

| Major Directory | Primary Purpose | Key Constraint |
|---|---|---|
| `Docs/` | Project documentation, specification, balance targets, and art guidelines. | `Docs/spec.md` is the authoritative product source of truth. |
| `public/` | Public asset host for static web files (audio, fonts, textures). | Raw static files; no code execution. |
| `src/core/` | Pure deterministic game rules, state definitions, geometry resolvers, and formulas. | Zero DOM, Canvas, IndexedDB, or Worker dependencies. Knows nothing about browser infrastructure; defines zero side-effect abstractions. |
| `src/content/` | Authored data for Patterns, Recipes, Sectors, Fractures, and Progression. | Declarative data structures referencing `core` types. Does not depend on UI/platform. |
| `src/application/` | Orchestrates session state and dispatches typed consequential actions. Defines side-effect ports/interfaces when needed. | Executes domain logic; may import `core` and `content`. Must NOT import UI or platform. |
| `src/platform/` | Browser-specific infrastructure & adapters (IndexedDB, localStorage, Workers, Clocks). | Implements application-side ports using browser APIs. Provides browser adapters rather than gameplay services; NOT a parent or child layer of UI. |
| `src/ui/` | Renderer (Canvas 2D), camera, input controllers, panels, overlays, codex, and accessibility. | Presentation only; consumes state via `@application`, dispatches actions, owns no gameplay math. |
| `src/workers/` (Target) | Materialized entry points for off-thread geometry analysis and offline simulation workers. | Alternate execution environments for canonical core logic, not architectural layers. Must call `@core` resolvers. |
| `tools/` | Standalone CLI tools for balance testing, pattern/sector validation, and save migration. | Run via Node/tsx; executable tooling home; imports canonical `@core` and `@content` logic. |
| `tests/` | Automated test suites (unit, property, content, actions, persistence, equivalence, integration). | Exercises any relevant production module without requiring full browser DOM where possible. |

---

## 3. Dependency-Direction Rules

To keep the codebase maintainable, prevent circular dependencies, and enforce single-responsibility boundaries, code dependencies flow strictly according to the canonical dependency model:

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

### Strict Architectural Invariants

1. **Core Domain Isolation (`src/core`):**
   - Pure deterministic domain model. Knows NOTHING about storage, clocks, analytics, Worker RPC, DOM, or browser infrastructure.
   - Defines zero side-effect ports or platform abstractions.
   - Must NOT import from `src/content`, `src/application`, `src/platform`, `src/workers`, or `src/ui`. `core` imports nothing outside core.
2. **Content Data (`src/content`):**
   - Declarative authored content. May import types, schemas, and enums from `src/core`.
   - Must NOT import from `src/application`, `src/platform`, `src/workers`, or `src/ui`. Does not depend on UI/platform.
3. **Application Orchestration (`src/application`):**
   - Orchestrates domain operations and session state.
   - Defines side-effect ports/interfaces (e.g. `SaveStore`, `Clock`, `AnalyticsSink`) when they are actually needed.
   - May import from `src/core` and `src/content`. Must NOT import from `src/ui` or `src/platform`.
4. **Platform Infrastructure (`src/platform`):**
   - Implements side-effect ports defined by `src/application` using browser APIs (IndexedDB, localStorage, Web Worker RPC, monotonic clocks, performance APIs).
   - Owns browser-specific side effects.
   - Is NOT a parent or child layer of UI; provides browser adapters rather than gameplay services.
5. **User Interface (`src/ui`):**
   - Renders state provided by `@application` or `@core`. Dispatches actions via `@application`.
   - May import from `src/application` and `src/core` types where useful.
   - Must NOT implement game rules. UI never calculates topology metrics, Recipe validity, Quality scores, economy, or rewards independently.
6. **Composition Root (`src/main.ts`):**
   - Acts as the browser composition root that wires `application`, `platform`, and `ui` implementations together.
7. **Non-Runtime Tools (`tools/`):**
   - May import from `src/core` and `src/content`.
   - Executable tooling lives under `tools/`, while canonical formulas themselves live under `src/core/`.
8. **Workers (`src/workers/` — Target Architecture):**
   - Alternate execution environments for canonical core logic, not architectural layers.
   - May import `src/core` and `src/content`. Materialized only when off-thread Worker functionality is implemented.
9. **Tests (`tests/`):**
   - May exercise any relevant production module.

---

## 4. Locked Architectural Decisions

### 4.1 Renderer Strategy
- **Phase A:** Use **Canvas 2D** renderer.
- **Phase B+:** Benchmark actual devices and visible-Field workloads. Migrate or add WebGL only if measured rendering performance requires it.
- **Abstraction:** Do not build a generalized Canvas/WebGL abstraction layer now.
- **Performance Optimizations:** Use viewport culling and limited redraw / dirty-region strategies when justified by measurement before renderer migration.

### 4.2 Worker Strategy
- **Ordinary Analyze:** Executed as a synchronous canonical core geometry resolver on the main thread.
- **Offline Simulation:** Worker-ready / Worker execution as appropriate (Phase B feature).
- **Large Geometry Analysis:** Worker execution only when profiling demonstrates a real need.
- **No Premature Physical Scaffold:** Worker files and directory are removed from physical scaffold until implemented. Intended locations remain mapped in Target Architecture.
- **Equivalence:** The exact same canonical core resolver functions are callable both synchronously and from a Worker.

### 4.3 Side-Effect Contract Ownership Strategy
- **No Platform Contracts in Core:** `src/core` defines pure domain data and rules; it contains zero storage, clock, analytics, or RPC interfaces.
- **Application Port Ownership:** Side-effect ports/interfaces belong to `src/application` at the time they are required.
- **Platform Adapters:** `src/platform` implements application ports using browser APIs.
- **Composition Root:** `src/main.ts` wires platform implementations into application state and UI triggers.

### 4.4 Tooling & Canonical Formulas Strategy
- **Executable Home:** `tools/` (`tools/balance-sim/`, `tools/pattern-validator/`, `tools/sector-validator/`, `tools/save-migrator/`) is the sole intended executable tooling location.
- **Canonical Formulas:** Formulas live exclusively in `src/core/`. Tools import production core logic to ensure zero formula drift.
- **Documentation & Datasets:** `Docs/Balance/` is reserved for milestone targets (`rune_foundry_targets.json`), methodology, and simulation analysis artifacts.

---

## 5. Development Phasing Roadmap

The directory structure is designed to remain stable as development progresses from Phase A prototype through Phase D distribution:

- **Phase A (Core Fun Prototype):**
  Uses `src/core` (coordinates, shapes, blocks, engines, field, topology, recipes, submission, save), `src/content` (starter recipes A.1–A.2), `src/application` (basic actions, state), `src/platform` (localStorage/IndexedDB), and `src/ui` (Canvas 2D grid renderer, submission preview, basic HUD).
- **Phase B (Public Vertical Slice):**
  Fills `src/content/fractures`, `src/content/sectors`, `src/content/commissions`, expands `src/core/offline`, materializes `src/workers` for offline processing, and expands `src/ui/codex`.
- **Phase C (First-Ending Campaign):**
  Expands `src/core/progression` (Recast mechanics, Proofs), `src/content/recipes` (Grand Recipes A.11–A.12), `tools/balance-sim`, and `src/ui/codex` (ending sequences, archived field gallery).
- **Phase D (Monetization & Distribution):**
  Adds `src/platform/analytics` integrations, optional rewarded ad wrappers, portal SDK adapters, and export code sharing in `src/ui/codex`.
