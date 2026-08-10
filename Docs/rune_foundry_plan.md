# HL;BM — Rune Foundry Production Plan

> **Practical Production Plan**  
> **Target:** Browser-native TypeScript implementation  
> **Reference Specification:** `Docs/spec.md`

---

## Plan Overview

This plan outlines four sequential production passes to build **HL;BM — Rune Foundry**. 

Rather than building disposable prototype code, **Pass 1** builds the actual production architecture and playable core loop. Subsequent passes refine gameplay, expand content depth, and apply release polish.

---

## Pass 1 — Complete Playable Core

### Goal
Implement the production software architecture and playable core loop so the game is meaningfully playable in the browser.

### Major Deliverables
1. **Core Domain Model (`src/core/`):**
   - Simple sparse 2D coordinate grid representation (`Map<string, Cell>`).
   - All seven tetromino matrices (`I`, `O`, `T`, `L`, `J`, `S`, `Z`), rotations, and cell offsets.
   - Loose Block state, placed cells, and Shape buffers.
   - Pure geometry resolver computing Cohesion, component count, and edge contact.
   - Pattern evaluator for initial Patterns (Heart Seal, Compression Press, Twin Stars).
   - Atomic Pattern Bind and ordinary Engine Submit transactions.
   - Engine power, Shard submission, and Shape Grade formulas; no Engine XP/Level.
2. **Authored Starter Content (`src/content/`):**
   - Opening Cradle Sector.
   - Starter Pattern & Recipe definitions (Heart Seal, Compression Press, Twin Stars).
3. **Application State & Actions (`src/application/`):**
   - Action dispatchers (`PlaceBlock`, `ReturnBlock`, `AnalyzeSelection` fallback, `BindEngine`, `SubmitEngine`) with placement treated as a commit rather than editor movement.
   - Session state container.
4. **Platform Infrastructure (`src/platform/`):**
   - Versioned localStorage save adapter with safe malformed-state fallback.
   - Monotonic session clock.
5. **Canvas 2D Renderer & UI (`src/ui/`):**
   - Sparse Field Canvas 2D renderer with pan and zoom camera.
   - Snapping Shape ghost placement/rotation, physical-code shortcuts, click/Shift/box selection.
   - Compact, distinct Pattern Bind and Engine Submit actions with exact consumption and payout previews.
   - Legible minimal HUD plus collapsible goal/Recipe/Grade sidebar.

### Dependency Ordering
$$\text{Core Math \& Domain} \longrightarrow \text{Application Actions} \longrightarrow \text{Storage \& Canvas UI} \longrightarrow \text{Playable Core}$$

### Exit Criteria
- The game runs in the browser via `npm run dev`.
- Player can place starter Blocks in the 4×4 Cradle to discover and Bind the Heart Engine.
- Heart and ordinary Engines generate independent deterministic randomized 7-bags into uncapped inventory.
- Player can Bind Compression/Twin Stars, Submit ordinary Engines for Shards, and upgrade Shape Grades.
- **Submitted Engine constituents are consumed and disappear from the board.**
- Game state persists across browser reloads.

---

## Pass 2 — Gameplay and UX Iteration

### Goal
Play the live browser game, evaluate feel, and fix weaknesses in loop pacing, spatial legibility, and player feedback.

### Major Deliverables
1. **Core Loop Revision:**
   - Replace buffer balancing/caps with persisted per-Engine shuffled 7-bags.
   - Support the foundational non-submittable Heart plus 0..N submittable ordinary Engines.
2. **Core Interaction Contract:**
   - Physical `Digit1..Digit7`/Numpad codes activate a snapping grid ghost; `KeyR` rotates; repeat activation toggles placement off.
   - Remove ordinary left-drag movement from gameplay. Right/middle/Space+left pan, the wheel zooms, and a 450 ms Loose Block hold Returns it.
   - Keep click/Shift+click and add empty-Field rectangle selection; Engine cells are excluded.
3. **Field-First Spatial Feedback:**
   - Evaluate bounded local candidates automatically after placement/Return.
   - Highlight missing geometry and trace valid Patterns on the Field.
   - Distinguish Loose tetromino silhouettes from crystallized Bound Engine structures.
   - Show each Engine's actual next random Shape and progress locally; remove full/blocked state.
   - Surface Pattern Bind and selected-Engine Submit with exact consumption and payout.
4. **Board Presentation:**
   - Refine camera pan/zoom and establish the two-finger mobile contract.
   - Keep a larger minimal resource/Shape HUD and add a quiet Recipe/onboarding/Grade sidebar.

### Exit Criteria
- Playability testing confirms that new players understand that **Bind creates production** while **Submit sacrifices an Engine for Grade progression**.
- Connected vs. separated topology choices feel distinct and visually intuitive.
- Early game loop (5–30 minutes) is engaging, clear, and free of editor-like placement friction.

---

## Pass 3 — Full Progression and Content

### Goal
Implement all remaining intended product systems, spatial pattern families, and campaign progression.

### Major Deliverables
1. **Pattern Expansion (`src/content/`):**
   - Implement all spatial pattern profiles: Spines, Hollow Rings, Symmetry, Bridges, Fractures, and Grand Patterns.
2. **Engine Evolutions:**
   - Evaluate Rebinding and focused Engine trait choices only if they create distinct decisions.
3. **Field Expansion & Weakpoints:**
   - Sector expansion, voids, landmarks, and Survey gates.
   - Fracture resolution mechanics (Point, Line, Hook, Fork, Core Weakpoints).
4. **Automation & Stencils:**
   - Stencil saving from preview or selection.
   - Stencil auto-fill from buffers and offline production resolver.
5. **Recast & Authored Ending:**
   - Recast (prestige) mechanic, Proof gains, and permanent perk tree.
   - Climax Grand Pattern, authored ending sequence, and post-game Endless mode.

### Exit Criteria
- Full campaign arc is playable end-to-end from opening Cradle to authored ending.
- Stencils successfully refill after Submission without auto-discovering or placing outside player design.
- Recast smoothly resets Field state while retaining Codex and Proof upgrades.

---

## Pass 4 — Polish and Release

### Goal
Apply final audiovisual polish, accessibility compliance, performance profiling, and build verification.

### Major Deliverables
1. **Audiovisual Polish:**
   - Block placement, Bind crystallization, and Submission collapse animations.
   - Sound effects for placement, Pattern resonance, Submission bursts, and UI actions.
2. **Accessibility & Compatibility:**
   - Colorblind shape icon overlays, high-contrast mode, and reduced motion option.
   - Full keyboard navigation support.
   - Mobile browser UI responsive pass.
3. **Quality & Performance:**
   - Canvas 2D viewport culling and rendering optimizations.
   - Edge-case save corruption recovery tests.
   - Lightweight telemetry event dispatching (`src/platform/analytics/`).
4. **Release Deployment:**
   - Production Vite bundle build validation (`npm run build`).
   - Deployment setup for web hosting.

### Exit Criteria
- Clean production build passes all tests (`npm test` / `npm run build`).
- Maintains 60 FPS on desktop and 30+ FPS on target mobile devices.
- Ready for public web release.
