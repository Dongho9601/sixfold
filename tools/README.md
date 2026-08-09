# Non-Runtime Tools (`tools/`)

The `tools` directory contains standalone development and validation scripts.

## Tools
- **`balance-sim`**: Deterministic economy and pacing simulator.
- **`pattern-validator`**: Topology metrics and Pattern / Recipe fixture validator.
- **`sector-validator`**: Sector layout mask, void integrity, and survey gate checker.
- **`save-migrator`**: Save schema validation and migration script.

## Strict Rules
- **Dependency Rules**: May import `core` and `content`.
- **Single Canonical Source**: Executable balance/geometry tooling lives under `tools/`, while canonical formulas themselves live under `src/core/`. Tools must import canonical domain rules and geometry resolvers from `@core` and `@content` and must never duplicate gameplay formulas.
