# User Interface (`src/ui`)

The `ui` directory manages presentation, camera navigation, user input, overlays, and accessibility controls.

## Responsibilities
- **`renderer`**: Canvas 2D view layer rendering world cells, terrain, engines, loose blocks, blueprint ghosts, and selection highlights.
- **`camera`**: World-to-screen transformations, panning, zoom steps (Block, Pattern, Engine, Atlas view).
- **`input`**: Pointer, touch, gesture, keyboard binding, and block placement controllers.
- **`overlays`**: Live Cohesion/Separation quality meters, resonance traces, fracture indicators.
- **`codex`**: Discovered Pattern library view, rumors, hints, and saved Stencil browser.
- **`inspector`**: Compact current-goal, Recipe, contextual action, Engine inspection, and Shape Grade sidebar.
- **`renderer`**: Exact Submit/Extract silhouettes, Engine-local production state, snapping ghosts, and rectangle selection.
- **`accessibility`**: High-contrast mode, reduced motion/flash settings, symbol-based shape indicators, keyboard focus navigation.
- **`styles`**: CSS design tokens, typography, layout styles, and theme variables.

## Strict Rules
- **Dependency Rules**: May import `application` and `core` types where useful. Must NOT implement game rules.
- **No Rule Ownership**: UI components render state provided by `@application` or `@core`. UI must never independently calculate topology, Recipe validity, Quality, economy, or rewards.
- **Action Dispatching**: User interactions trigger typed action dispatches via `@application`.
