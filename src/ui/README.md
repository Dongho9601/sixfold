# User Interface (`src/ui`)

The `ui` directory manages presentation, camera navigation, user input, overlays, and accessibility controls.

## Responsibilities
- **`renderer`**: Canvas 2D view layer rendering world cells, terrain, engines, loose blocks, blueprint ghosts, and selection highlights. (Phase A locked: Canvas 2D; WebGL evaluated in Phase B+ only if measured performance requires it).
- **`camera`**: World-to-screen transformations, panning, zoom steps (Block, Pattern, Engine, Atlas view).
- **`input`**: Pointer, touch, gesture, keyboard binding, and block placement controllers.
- **`overlays`**: Live Cohesion/Separation quality meters, resonance traces, fracture indicators.
- **`codex`**: Discovered Pattern library view, rumors, hints, and saved Stencil browser.
- **`recipe-panel`**: Active Recipe metrics, Commission trackers, missing shape ETAs.
- **`submission-preview`**: Irreversible consumption preview modal, resource burst breakdown, before/after visual feedback.
- **`accessibility`**: High-contrast mode, reduced motion/flash settings, symbol-based shape/affinity indicators, keyboard focus navigation.
- **`styles`**: CSS design tokens, typography, layout styles, and theme variables.

## Strict Rules
- **Dependency Rules**: May import `application` and `core` types where useful. Must NOT implement game rules.
- **No Rule Ownership**: UI components render state provided by `@application` or `@core`. UI must never independently calculate topology, Recipe validity, Quality, economy, or rewards.
- **Action Dispatching**: User interactions trigger typed action dispatches via `@application`.
