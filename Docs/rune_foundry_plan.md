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
   - Sparse 2D coordinate grid & chunk representation.
   - Tetromino shape matrices (`I`, `O`, `L`, `J`), rotations, and cell offsets.
   - Loose Block state, placed cells, and Shape buffers.
   - Pure geometry resolver computing Cohesion, component count, and edge contact.
   - Pattern evaluator for initial Patterns (Heart Seal, Compression Press, Twin Stars).
   - Atomic Engine Binding and consumptive Submission transactions.
   - Base Ash burst, Shards, and Engine XP formulas.
2. **Authored Starter Content (`src/content/`):**
   - Opening Cradle Sector.
   - Starter Pattern & Recipe definitions (Heart Seal, Compression Press, Twin Stars).
3. **Application State & Actions (`src/application/`):**
   - Action dispatchers (`PlaceBlock`, `MoveBlock`, `RotateBlock`, `ReturnBlock`, `AnalyzeSelection`, `BindEngine`, `SubmitRecipe`).
   - Session state container.
4. **Platform Infrastructure (`src/platform/`):**
   - Local save adapter (IndexedDB / localStorage fallback).
   - Monotonic session clock.
5. **Canvas 2D Renderer & UI (`src/ui/`):**
   - Sparse Field Canvas 2D renderer with pan and zoom camera.
   - Interactive Block placement, rotation, and selection controls.
   - Submission preview modal showing consumption count and payout.
   - Basic HUD displaying Ash, Shards, buffers, and active Recipe state.

### Dependency Ordering
$$\text{Core Math \& Domain} \longrightarrow \text{Application Actions} \longrightarrow \text{Storage \& Canvas UI} \longrightarrow \text{Playable Core}$$

### Exit Criteria
- The game runs in the browser via `npm run dev`.
- Player can place starter Blocks in the 4×4 Cradle to discover and Bind the Heart Engine.
- Bound Heart Engine generates new Blocks into buffers over time.
- Player can place generated Blocks and Submit them to Compression Press or Twin Stars.
- **Submitted Loose Blocks are consumed and disappear from the board.**
- Game state persists across browser reloads.

---

## Pass 2 — Gameplay and UX Iteration

### Goal
Play the live browser game, evaluate feel, and fix weaknesses in loop pacing, spatial legibility, and player feedback.

### Major Deliverables
1. **Pacing & Balance Tuning:**
   - Calibrate Engine generation intervals and buffer caps.
   - Balance Ash burst amounts and upgrade costs to ensure meaningful progression decisions.
2. **UX & Spatial Feedback:**
   - Enhance spatial feedback for Quality tiers (Valid, Strong, Masterwork, Perfect).
   - Clear visual distinction between Loose Blocks, Bound Engine cells, and empty space.
   - Explicit consumption confirmation prompts (`SUBMIT X BLOCKS`).
   - Near-match feedback tuning in the Pattern Analyzer.
3. **Board Interaction & Navigation:**
   - Refine camera pan/zoom smoothness and touch gestures for mobile devices.
   - Implement block drag-and-drop and hotkey shortcuts.

### Exit Criteria
- Playability testing confirms that new players immediately understand that **Bind keeps Blocks as an Engine** while **Submit consumes Loose Blocks**.
- Connected vs. separated topology choices feel distinct and visually intuitive.
- Early game loop (5–30 minutes) is engaging, clear, and free of UI friction.

---

## Pass 3 — Full Progression and Content

### Goal
Implement all remaining intended product systems, spatial pattern families, and campaign progression.

### Major Deliverables
1. **Full Shape & Pattern Expansion (`src/content/`):**
   - Add remaining 3 tetromino shapes (`T`, `S`, `Z`).
   - Implement all spatial pattern profiles: Spines, Hollow Rings, Symmetry, Bridges, Fractures, and Grand Patterns.
2. **Engines, Evolutions & Mastery:**
   - Engine leveling, Rebinding, and evolution trait choices.
   - Persistent Shape Mastery tracks and Block Grade upgrades.
3. **Field Expansion & Weakpoints:**
   - Procedural Sector masks, voids, landmarks, and Survey gates.
   - Fracture resolution mechanics (Point, Line, Hook, Core Weakpoints).
4. **Automation & Stencils:**
   - Stencil saving from preview or selection.
   - Stencil auto-fill from buffers and offline production resolver.
5. **Recast & Authored Ending:**
   - Recast (prestige) mechanic, Proof gains, and permanent perk tree.
   - Climax Grand Pattern, authored ending sequence, and post-game Endless mode.

### Exit Criteria
- Full 10–15 hour campaign arc is playable end-to-end from opening Cradle to authored ending.
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
   - Edge-case save corruption recovery and schema migration tests.
   - Lightweight telemetry event dispatching (`src/platform/analytics/`).
4. **Release Deployment:**
   - Production Vite bundle build validation (`npm run build`).
   - Deployment setup for web hosting.

### Exit Criteria
- Clean production build passes all tests (`npm test` / `npm run build`).
- Maintains 60 FPS on desktop and 30+ FPS on target mobile devices.
- Ready for public web release.
