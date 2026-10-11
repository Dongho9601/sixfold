# Interface and browser-save verification — October 10, 2026

Sixfold has been locally verified as a static browser game under `/sixfold/`. This report supersedes the earlier server-release reports and screenshot iterations. It records local checks, not GitHub Pages publication.

## Architecture and persistence

`src/game/rules.ts` preserves the existing payout, probability, transfer, Tilt, and Jackpot formulas. `src/game/run.ts` supplies pure run transitions and exact personal-record ordering. `src/game/random.ts` uses Web Crypto on the former RNG’s uniform 48-bit grid. `src/save.ts` validates and stores a version-1 JSON save at `sixfold:save:v1`; Gold and scores remain exact decimal strings with `bigint` arithmetic.

Settled state, settings, records, and completion receipt persist together before animation starts. Tests cover refresh during roll and final-roll animations, completion deduplication through repeated reloads, early bankruptcy versus a valid final zero, probability-assisted exclusion, named restart, preserved settings and records, navigation preference journaling without overwriting a newer run, adjacent 81-digit scores, stable ties, stale run revisions, rapid inputs, and two same-origin tabs. Malformed/incompatible data recovers without touching neighboring project keys, and blocked/quota-limited storage leaves play and restart available with a save warning.

The browser UI retains the board, controls, input guards, die/replacement animations, rewards, procedural audio, and seven-language guide. The leaderboard displays this browser’s best 10 eligible completed runs. Tilt displays a smaller white Tilt N heading above the larger uppercase description, from NEARLY EVEN to EXTREME BIAS, animating a changed description while respecting reduced motion. BOARD NET accumulates exact net income on the current die, persists across reloads, and resets on Shake, Jackpot replacement, or restart. Older saves initialize the new baseline without discarding progress or records. Settings links to the creator’s website, and About and all seven guide languages describe the current rules.

## Commands and results

- `npm run build`: TypeScript check and Vite static build passed, with base `/sixfold/` and multi-page serving rather than an SPA fallback.
- `npm test`: **51 tests passed** — the 36 rule regressions plus 15 save/run/randomness tests, including accumulated board net, resets, reloads, and legacy-save recovery.
- `npm run test:ui`: **27 Chromium tests passed** against the production build, including gameplay, controls, hold-to-remove, restart, saves, personal records, storage failure, static navigation, all six Tilt descriptions beneath a smaller white level heading at five desktop/mobile sizes, descriptive Tilt animation, and reduced motion.
- The migration’s earlier `npm run test:balance` comparison and `npm run audit:strategies` audit passed. Probability generation, transfer rates, sampling, and payout rules are unchanged in this interface update; those two simulations were not rerun.
- `git diff --check`: passed.

The UI suite checks production assets, favicon, About navigation and links back to the game under `/sixfold/`. After the static page loads, ordinary rolls, nickname changes, and restart work with browser networking disabled and issue **zero network requests**. Every UI test also rejects gameplay API requests and checks page errors. The site consists of actual static pages and assets; no backend or rewrite is needed.

Desktop and mobile emulation cover 1280 px desktop, 390 and 320 px phones, nine phone viewports from 320 × 568 through 430 × 932 portrait and 568 × 320 through 932 × 430 landscape, intermediate widths, and all seven guide languages. Assertions check overflow, use of portrait viewport height, stable betting cells, feedback clear of the footer, fixed card heights, exact large-value labels, keyboard/dialog guards, touch and mouse holds, and committed animation interruption. Current desktop/mobile screenshots were visually inspected, including the longest Tilt label and the website link near the top of Settings on a 320 × 568 screen. These checks do not claim physical-device testing, Safari/Firefox testing, or a live Pages deployment.

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
