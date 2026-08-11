# Application Layer (`src/application`)

The `application` directory orchestrates game interactions, typed consequential actions, and session state container logic.

## Responsibilities
- **`actions`**: Typed consequential handlers for placement/Return, selection, Pattern analysis, Pattern Bind, Engine Submit, production, and Shape Grade upgrades.
- **`state`**: Application session container, current active selection, UI focus mode, transaction history.

## Strict Rules
- **Dependency Rules**: May import `core` and `content`. Must NOT import from `ui` or `platform`.
- **Side-Effect Ports**: Defines side-effect ports/interfaces (e.g. storage, clock, analytics sinks) when needed by application orchestration.
- **Pure Actions**: Actions validate inputs against `core` rules before committing state changes.
- **No Direct UI/Platform References**: Does not import DOM elements, Canvas rendering routines, or browser platform side-effect adapters directly.

## Pass 3A migration

Legacy saves without `unlockedChunks` receive the canonical opening field. Any
active legacy Block outside that field is preserved by adding the stable,
globally aligned 4x4 chunk containing each off-opening occupied cell. Blocks
are not deleted or relocated during migration.
