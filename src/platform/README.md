# Platform & Infrastructure (`src/platform`)

The `platform` directory isolates browser-specific APIs and infrastructure mechanisms.

## Responsibilities
- **`storage`**: Versioned localStorage save store with safe fallback on malformed state.
- **`clock`**: Monotonic clock adapter, session timers, wall-clock delta calculation with bounds.
- **`analytics`**: Event telemetry dispatcher conforming to `Docs/rune_foundry_analytics.md`.

## Strict Rules
- **Dependency Rules**: Implements side-effect ports required by `application`. Owns browser-specific side effects. Is NOT a parent or child layer of UI.
- **Encapsulate browser APIs**: All browser interactions (localStorage, navigator, and lifecycle-facing platform hooks) are contained here or at the composition root.
- **Browser Adapters**: Provides browser infrastructure adapters rather than gameplay services; does not inject browser types into `core`.
