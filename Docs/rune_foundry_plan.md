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
- Heart and ordinary Engines generate independent deterministic randomized 7-bags into Shape buffers; Pass 2 adds the shared Stock backpressure rule.
- Player can Bind Compression/Twin Stars, Submit ordinary Engines for Shards, and upgrade Shape Grades.
- **Submitted Engine constituents are consumed and disappear from the board.**
- Game state persists across browser reloads.

---

## Pass 2 — Core Progression Redesign

### Goal
Revise the live core loop so spatial production, Power connectivity, resource pacing, and authored progression create meaningful Keep-versus-Submit decisions.

### Major Deliverables
1. **Limited Field and Expansion:**
   - Replace unlimited placement with a set of unlocked 4×4 chunks.
   - Start with roughly an 8×8 opening field around the Heart Cradle.
   - Add Frontier Seal activation as the authored expansion path; allow non-rectangular unlocked layouts.
2. **Heart-Rooted Power:**
   - Make the Heart Engine the Power root and gate ordinary production on orthogonal Bound-cell reachability.
   - Preserve partial progress while unpowered without disconnected-time backlog or catch-up.
   - Keep numerical Power capacity deferred.
3. **Production and Stock Pacing:**
   - Retain deterministic per-Engine shuffled 7-bags.
   - Lower BaseRate to about 3.5 Blocks/minute so the initial Heart produces roughly one Block every 12–16 seconds.
   - Add a global Buffered Block Stock capacity of about 12 with explicit full-stock pausing.
4. **Directed Progression and Economy:**
   - Add authored NOW/NEXT Foundry Directives.
   - Keep Shards for repeatable Shape Grades and add Core only for milestone progression.
   - Author the early Heart → Compression → Submit → Grade → Powered Engine → Core → Frontier → Twin Stars sequence.
5. **Core Interaction Contract:**
   - Physical `Digit1..Digit7`/Numpad codes activate a snapping grid ghost; `KeyR` rotates; repeat activation toggles placement off.
   - Remove ordinary left-drag movement from gameplay. Right/middle/Space+left pan, the wheel zooms, and a 450 ms Loose Block hold Returns it.
   - Keep click/Shift+click and add empty-Field rectangle selection; Engine cells are excluded.
6. **Field-First Spatial Feedback:**
   - Evaluate bounded local candidates automatically after placement/Return.
   - Highlight missing geometry and trace valid Patterns on the Field.
   - Distinguish Loose tetromino silhouettes from crystallized Bound Engine structures.
   - Show each Engine's actual next random Shape, Power state, and local progress.
   - Show locked frontier cells, valid expansion targets, and Stock-full pause state.
   - Surface Pattern Bind and selected-Engine Submit with exact consumption and payout.
7. **Board Presentation and Asset Reuse:**
   - Refine camera pan/zoom and establish the two-finger mobile contract.
   - Keep a larger minimal resource/Shape HUD and add a quiet Recipe/onboarding/Grade sidebar.
   - Reuse copied HLBM visual language for Shards, Core, Heart, Power, Frontier, and Directives while keeping board geometry procedural.

### Exit Criteria
- Playability testing confirms that new players understand that **Bind creates production** while **Submit sacrifices an Engine for Grade progression**.
- The opening 8×8 field has a deterministic, buildable Frontier Seal route to a chosen adjacent 4×4 chunk.
- A kept ordinary Engine produces only when Heart-connected; submitting a bridge visibly disconnects downstream Engines without catch-up output.
- Heart production lands at roughly one Block every 12–16 seconds and pauses cleanly at Stock 12.
- NOW/NEXT Directives provide an obvious goal through the first expansion and Twin Stars milestone.
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
   - Extend Frontier chunk expansion beyond the first Seal, then add Sector masks, voids, landmarks, and Survey gates.
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
