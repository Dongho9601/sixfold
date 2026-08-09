# Testing Suites (`tests/`)

The `tests` directory contains all test suites for **HL;BM — Rune Foundry**.

## Test Categories
- **`unit`**: Unit tests for core domain formulas (`BlockValue`, production rates, `Cohesion`, `SubmissionPower`, XP/Shards thresholds).
- **`property`**: Geometry property tests (translation invariance, rotation equivalence, non-decreasing cohesion on edge addition, bounding distance caps).
- **`content`**: Recipe and Pattern content fixture tests (valid/invalid fixtures, near-matches, hint coverage).
- **`actions`**: Typed action execution and transaction boundary tests (`PlaceBlock`, `BindPattern`, `SubmitRecipe`).
- **`persistence`**: IndexedDB and localStorage serialization, schema migration, and recovery metadata tests.
- **`equivalence`**: Deterministic online vs offline simulation equivalence tests.
- **`integration`**: Full loop integration tests (Cradle → Bind Heart Seal → Generate → Place → Submit → Upgrade).

## Dependency Rules
- May exercise any relevant production module.
