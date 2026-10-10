# Client-side migration verification — October 10, 2026

Sixfold has been locally verified as a static browser game under `/sixfold/`. This report supersedes the earlier server-release reports and screenshot iterations. It records local checks, not GitHub Pages publication.

## Architecture and persistence

`src/game/rules.ts` preserves the existing payout, probability, transfer, Tilt, and Jackpot formulas. `src/game/run.ts` supplies pure run transitions and exact personal-record ordering. `src/game/random.ts` uses Web Crypto on the former RNG’s uniform 48-bit grid. `src/save.ts` validates and stores a version-1 JSON save at `sixfold:save:v1`; Gold and scores remain exact decimal strings with `bigint` arithmetic.

Settled state, settings, records, and completion receipt persist together before animation starts. Tests cover refresh during roll and final-roll animations, completion deduplication through repeated reloads, early bankruptcy versus a valid final zero, probability-assisted exclusion, named restart, preserved settings and records, navigation preference journaling without overwriting a newer run, adjacent 81-digit scores, stable ties, stale run revisions, rapid inputs, and two same-origin tabs. Malformed/incompatible data recovers without touching neighboring project keys, and blocked/quota-limited storage leaves play and restart available with a save warning.

The browser UI retains the board, controls, input guards, die/replacement animations, rewards, procedural audio, and seven-language guide. The leaderboard now displays this browser’s best 10 eligible completed runs.

## Commands and results

- `npm run build`: TypeScript check and Vite static build passed, with base `/sixfold/` and multi-page serving rather than an SPA fallback.
- `npm test`: **49 tests passed** — the 36 existing rule regressions plus 13 focused save/run/randomness tests.
- `npm run test:ui`: **26 Chromium tests passed** against the production build, including gameplay, controls, hold-to-remove, restart, saves, personal records, storage failure, and static navigation.
- `npm run test:balance`: seeded pacing comparison completed successfully. The configured curve retains the documented Tilt 5/6 group-play medians of four/four chances and full-coverage medians of two/two.
- `npm run audit:strategies`: current 100-roll strategy audit and its assertions completed successfully; the rules and balance constants were not changed.
- `git diff --check`: passed.

The UI suite checks production assets, favicon, About navigation and links back to the game under `/sixfold/`. After the static page loads, ordinary rolls, nickname changes, and restart work with browser networking disabled and issue **zero network requests**. Every UI test also rejects gameplay API requests and checks page errors. The site consists of actual static pages and assets; no backend or rewrite is needed.

Desktop and mobile emulation cover 1280 px desktop, 390 and 320 px phones, 320 × 568 portrait, short landscape layouts, intermediate widths, and all seven guide languages. Assertions check overflow, fixed card heights, exact large-value labels, keyboard/dialog guards, touch and mouse holds, and committed animation interruption. Current desktop/mobile screenshots were visually inspected. These checks do not claim physical-device testing, Safari/Firefox testing, or a live Pages deployment.

## Current screenshots

These captures use synthetic local test data. Only six current examples are retained; the earlier redundant iterations are removed.

- [Desktop game](screenshots/game-desktop.png)
- [Mobile game](screenshots/game-mobile.png)
- [Personal records on mobile](screenshots/personal-records-mobile.png)
- [Run results](screenshots/run-results-desktop.png)
- [Mobile guide](screenshots/guide-mobile.png)
- [Mobile Settings](screenshots/settings-mobile.png)

## Publication boundary

The intended URL is `https://Dongho9601.github.io/sixfold/`. README documents later publishing-source choices. No workflow, repository setting, homepage, domain, commit, or push was changed. Local databases and backups remain ignored and untouched. See [PUBLIC_RELEASE_REVIEW.md](PUBLIC_RELEASE_REVIEW.md) for the history inspection and the separate project-license choice.
