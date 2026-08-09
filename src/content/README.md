# Authored Content (`src/content`)

The `content` directory contains declarative authored game data for **HL;BM — Rune Foundry**.

## Responsibilities
- **`sectors`**: Authored Sector chunk masks, survey gate thresholds, voids, landmarks, and fog layouts.
- **`fractures`**: Fracture definitions (Point, Line, Hook, Fork, Seam, Core) and Weakpoint rules.
- **`patterns`**: Authored Pattern catalogs, rumors, hint tiers, and candidate criteria.
- **`recipes`**: Authored Recipe definitions (A.1 Heart Seal through A.12 Sevenfold Prism, Quality profiles, rewards).
- **`commissions`**: Commission templates, demand multipliers, and rotation parameters.
- **`progression`**: Authored Shape Mastery traits, Engine evolution options, and Recast milestones.

## Strict Rules
- **Data-first**: Content is specified declaratively using pure TypeScript data structures.
- **Depends on core types**: May import core types/contracts from `src/core`.
- **No UI/Platform dependencies**: Must NOT depend on `ui`, `platform`, `application`, or `workers`. Content definitions contain no visual rendering logic or DOM calls.
