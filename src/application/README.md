# Application Layer (`src/application`)

The `application` directory orchestrates game interactions, typed consequential actions, and session state container logic.

## Responsibilities
- **`actions`**: Typed consequential handlers for placement/Return, selection, Pattern analysis, Bind, Submit, Engine Extract, production, and Shape Grade upgrades.
- **`state`**: Application session container, current active selection, UI focus mode, transaction history.

## Strict Rules
- **Dependency Rules**: May import `core` and `content`. Must NOT import from `ui` or `platform`.
- **Side-Effect Ports**: Defines side-effect ports/interfaces (e.g. storage, clock, analytics sinks) when needed by application orchestration.
- **Pure Actions**: Actions validate inputs against `core` rules before committing state changes.
- **No Direct UI/Platform References**: Does not import DOM elements, Canvas rendering routines, or browser platform side-effect adapters directly.
