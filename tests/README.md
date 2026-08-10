# Testing Suites (`tests/`)

The `tests` directory contains automated test suites for **HL;BM — Rune Foundry**.

## Test Focus Areas
- **Unit Tests:** Core domain formulas (`BlockValue`, EnginePower, production rates, Cohesion, and Shard rewards).
- **Geometry Property Tests:** Spatial invariant verification (translation invariance, rotation equivalence, component bounds).
- **Action & Loop Integration Tests:** Pointer intent, atomic Pattern Bind/Engine Submit execution, Grade snapshots, and save migration.

## Dependency Rules
- May exercise any relevant production module.
