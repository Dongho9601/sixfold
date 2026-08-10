# Repository Architecture & Directory Structure

> **Game Title:** HL;BM — Rune Foundry  
> **Document Status:** Authoritative repository architecture specification  
> **Last Updated:** 2026-08-09  

---

## 1. Physical Repository Scaffold

The physical repository reflects what exists now with a clean, minimal scaffold:

```text
hold_less_be_more_rune_foundry/
├── Docs/
│   ├── spec.md                       # Canonical game specification (Authoritative)
│   ├── directory_structure.md        # Repository architecture guide (This document)
│   ├── rune_foundry_plan.md          # Four-pass production plan
│   └── rune_foundry_analytics.md     # Analytics telemetry event contracts
├── public/                           # Static public web assets host
├── src/
│   ├── core/                         # Pure deterministic game model (0 DOM/UI dependencies)
│   │   ├── README.md
│   │   └── index.ts
│   ├── content/                      # Declarative authored content data
│   │   ├── README.md
│   │   └── index.ts
│   ├── application/                  # Orchestration and typed action dispatchers
│   │   ├── README.md
│   │   └── index.ts
│   ├── platform/                     # Browser-specific infrastructure & adapters
│   │   ├── README.md
│   │   └── index.ts
│   ├── ui/                           # Visual presentation, rendering, and input handling
│   │   ├── README.md
│   │   └── index.ts
│   ├── main.ts                       # Browser composition root & entry point
│   └── vite-env.d.ts                 # Vite environment type declarations
├── tools/                            # Standalone developer CLI tools
│   └── README.md
├── tests/                            # Test suites
│   └── README.md
├── index.html                        # Vite HTML entry point
├── package.json                      # Dependency manifest and npm scripts
├── tsconfig.json                     # TypeScript compiler configuration & path aliases
├── vite.config.ts                    # Vite build tool configuration
└── README.md                         # Project overview
```

---

## 2. Directory Responsibilities

| Directory | Responsibility | Key Invariant |
|---|---|---|
| `src/core` | Pure deterministic game rules, geometry math, state definitions, and resource formulas. | **Zero** DOM, Canvas, IndexedDB, or UI dependencies. Imports nothing outside `core`. |
| `src/content` | Declarative authored data (starter patterns, recipes, sectors, fractures). | Data structures referencing `core` types. No UI/platform dependencies. |
| `src/application` | Session state container, action dispatchers, transaction orchestration. | Imports `core` and `content`. Defines side-effect ports when needed. Does NOT import UI or platform. |
| `src/platform` | Browser infrastructure (versioned localStorage storage, session clocks, analytics). | Implements application side-effect ports using browser APIs. NOT a parent or child layer of UI. |
| `src/ui` | Canvas 2D renderer, camera controls, input handlers, overlay HUDs, previews. | Presentation only. Consumes state and dispatches actions via `@application`. **UI never calculates gameplay math.** |
| `tools/` | Standalone CLI scripts for development and validation. | Run via Node/tsx. Imports canonical logic from `@core` and `@content`. |
| `tests/` | Automated test suites for domain math, actions, and persistence. | Exercises production modules directly. |

---

## 3. Dependency Invariants

Code dependencies flow strictly inward:

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

### Strict Rules
1. **Core Isolation:** `src/core` is pure TypeScript. It has zero browser API, DOM, or UI imports. All gameplay rules and formulas live exclusively in `src/core`.
2. **UI Rule Exclusion:** `src/ui` renders state and collects user input. UI components **never** compute topology metrics, Recipe validity, Quality scores, or rewards independently.
3. **Composition Root:** `src/main.ts` wires platform implementations, application state, and UI rendering together at browser launch.
