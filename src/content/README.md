# Authored Content (`src/content`)

The `content` directory contains declarative authored game data for **HL;BM — Rune Foundry**.

## Responsibilities
- **`sectors`**: Authored Sector masks, survey gate thresholds, voids, and landmarks.
- **`fractures`**: Spatial Fracture Weakpoint definitions (Point, Line, Hook, Fork, Core).
- **`patterns`**: Authored Pattern catalogs, rumors, hint tiers, and candidate criteria.
- **`recipes`**: Authored Recipe definitions, Quality profiles, and rewards.
- **`progression`**: Authored Engine evolution options, Block Grade thresholds, and Recast milestones.

## Strict Rules
- **Data-first**: Content is specified declaratively using pure TypeScript data structures.
- **Depends on core types**: May import core types/contracts from `src/core`.
- **No UI/Platform dependencies**: Must NOT depend on `ui`, `platform`, or `application`. Content definitions contain no visual rendering logic or DOM calls.
