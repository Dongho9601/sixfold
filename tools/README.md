# Non-Runtime Tools (`tools/`)

The `tools` directory contains standalone developer and validation scripts.

## Responsibilities
- Standalone CLI utilities for content validation, geometry fixture verification, and balance checks.

## Strict Rules
- **Dependency Rules**: May import `core` and `content`.
- **Single Canonical Source**: Executable developer tooling lives under `tools/`, while canonical formulas themselves live under `src/core/`. Tools must import canonical domain rules and geometry resolvers from `@core` and `@content` and must never duplicate gameplay formulas.
