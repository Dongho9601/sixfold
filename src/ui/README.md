# User Interface (`src/ui`)

The `ui` directory manages presentation, camera navigation, user input, overlays, and accessibility controls.

## Responsibilities
- **`renderer`**: Canvas 2D view layer rendering the forge environment, world cells, Engines, loose Runes, blueprint ghosts, hover, and selection highlights.
- **`camera`**: World-to-screen transformations, panning, zoom steps (Block, Pattern, Engine, Atlas view).
- **`input`**: Pointer, touch, gesture, keyboard binding, and block placement controllers.
- **`hud`**: Persistent resource/status rail and keyboard-accessible Rune stock tray.
- **`inspector`**: Directive progress, selected Rune/assembly actions, Engine inspection, Recipes, and Rune Grades.
- **`assets`**: One-time preload/cache for optional Canvas image assets with procedural fallbacks.
- **`glyphs`**: Shared geometric Shape and action markup.
- **`theme.css`**: CSS design tokens, responsive layout, typography, states, and reduced-motion handling.

## Strict Rules
- **Dependency Rules**: May import `application` and `core` types where useful. Must NOT implement game rules.
- **No Rule Ownership**: UI components render state provided by `@application` or `@core`. UI must never independently calculate topology, Recipe validity, Quality, economy, or rewards.
- **Action Dispatching**: User interactions trigger typed action dispatches via `@application`.
