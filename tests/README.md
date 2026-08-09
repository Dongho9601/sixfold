# Testing Suites (`tests/`)

The `tests` directory contains automated test suites for **HL;BM — Rune Foundry**.

## Test Focus Areas
- **Unit Tests:** Core domain formulas (`BlockValue`, production rates, `Cohesion`, `SubmissionPower`, XP/Shards thresholds).
- **Geometry Property Tests:** Spatial invariant verification (translation invariance, rotation equivalence, component bounds).
- **Action & Loop Integration Tests:** Action dispatching, atomic Bind/Submit execution, and save persistence.

## Dependency Rules
- May exercise any relevant production module.
