# Platform & Infrastructure (`src/platform`)

The `platform` directory isolates browser-specific APIs and infrastructure mechanisms.

## Responsibilities
- **`storage`**: IndexedDB save store implementation and localStorage recovery metadata.
- **`clock`**: Monotonic clock adapter, session timers, wall-clock delta calculation with bounds.
- **`worker-adapter`**: Message-passing and RPC wrappers for Web Worker geometry and offline jobs.
- **`analytics`**: Event telemetry dispatcher conforming to `Docs/rune_foundry_analytics.md`.

## Strict Rules
- **Dependency Rules**: Implements side-effect ports required by `application`. Owns browser-specific side effects. Is NOT a parent or child layer of UI.
- **Encapsulate browser APIs**: All browser interactions (IndexedDB, localStorage, Web Workers, navigator) are contained here.
- **Browser Adapters**: Provides browser infrastructure adapters rather than gameplay services; does not inject browser types into `core`.
