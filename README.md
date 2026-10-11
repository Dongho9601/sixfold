# Sixfold

A free hobby browser game about discovering changing odds on a six-sided die. Start with 100 Gold and play up to 100 rolls. Bet on numbers, rows, columns, or colors; observe Tilt, earn a free Shake, and find the hidden ×24 Jackpot. Gold has no monetary value. There are no ads, payments, accounts, or shared rankings.

Everything runs in the browser. The personal leaderboard keeps this browser’s best 10 eligible completed runs, ranked by final Gold after roll 100. Enabling Show probabilities excludes that run from records, even if hidden again. Earlier bankruptcy records no score. Tilt displays two lines: a smaller white Tilt N above an uppercase description, using six descriptions from NEARLY EVEN to EXTREME BIAS, and animates changes. BOARD NET tracks cumulative returns minus settled bets on the current die and resets when Shake, Jackpot, or restart supplies a fresh die. The phone table fills the available viewport height. Settings links to the creator’s website, and the seven-language guide and About page explain the current rules and browser saves.

## Local development

Use Node.js 22.16 or later and npm. Node is only a development and test dependency.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/sixfold/`. For another device on your local network, use `npm run dev -- --host 0.0.0.0` and Vite’s network URL.

```sh
npm run build    # Type-check, then build static files into dist/
npm run preview  # Preview dist/, normally http://localhost:4173/sixfold/
```

The build is static HTML, JavaScript, CSS, and SVG. It needs no production Node process, database, environment variables, API, or routing rewrites. Vite preview is a local verification tool. `package.json` stays `private: true`; npm publication is outside this project’s setup.

## Tests

```sh
npm test                    # Rules, run transitions, exact arithmetic and save recovery
npx playwright install chromium  # One-time browser setup for UI tests
npm run test:ui             # Build, then test dist/ under /sixfold/ in Chromium
npm run test:balance        # Seeded probability-pacing comparison
npm run audit:strategies    # Seeded strategy audit with current settlement rules
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing compatible Chromium executable. Browser tests use isolated contexts and synthetic browser saves; they never open existing local databases or personal browser data. Generated screenshots live in ignored `test-results/`. See [verification](docs/VERIFICATION.md) for results and limitations.

## Saves and personal records

The versioned `localStorage` key `sixfold:save:v1` contains the settled run, settings, and best 10 completed records. Gold, wagers, payouts, scores, and revisions use exact decimal strings at the storage boundary and `bigint` for arithmetic. Probability values retain their unrounded precision. Settlement and the completion receipt save together before animation starts; reload resumes the committed board without rolling or recording it again. Equal scores retain completion order, with a stable run-ID fallback.

The saved board starting bankroll preserves BOARD NET across refreshes and tabs. Existing version-1 saves without this field initialize it to their current bankroll, so the new counter starts at zero while preserving progress and records.

Restart discards the current run and draft while retaining records, name, sound/motion preferences, guide preferences, and recent bet amounts. Unrolled draft bets clear on reload. Saves belong to this browser and origin; development, preview, and the hosted site have separate saves. Clearing Sixfold’s data or the browser’s site data loses that progress. There is no synchronization or export/import.

If storage is blocked or full, play continues in memory with a brief save warning. Malformed or incompatible data starts a fresh run, preserving the first unreadable value under `sixfold:save:recovery` when possible. Sixfold reads and writes only its own keys and never calls `localStorage.clear()`. A temporary `sixfold:settings:pending:v1` journal preserves last-second preference edits during navigation without rewriting run state. Same-origin tabs use storage events and revision checks; Web Locks serializes normal writes where available. Old local SQLite data and backups are ignored and left untouched; they are not imported into this new browser-save format.

## Later GitHub Pages setup

The intended project site is **https://Dongho9601.github.io/sixfold/** from `Dongho9601/sixfold`. Vite’s base is `/sixfold/`; the game, About page, and favicon use that project path. The personal homepage is a separate repository and does not need changes.

This checkout adds no CI or deployment workflow and does not publish anything. After reviewing and committing the changes in a later pass, make the repository public and choose a Pages publishing source in this repository’s **Settings → Pages**. Either publish the contents of a locally built `dist/` to the root of a dedicated publishing branch, or separately authorize a future Actions workflow that builds and uploads `dist/`. Do not select the source documentation directory as the site output. The build includes `.nojekyll` for branch-based static publishing. No custom domain or `CNAME` is configured here. [GitHub’s publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) explains the source choices; [Vite’s Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) documents the project-site base path.

## Repository notes

- [Game specification](docs/spec.md) and [probability model](docs/PROBABILITY_MODEL.md) describe the mechanics and balance experiments.
- `src/game/` contains pure rules and run transitions plus browser randomness; `src/save.ts` handles versioned browser persistence; `src/main.ts` presents the game.
- [Credits](CREDITS.md) preserve the design references and dependency attribution. No project license exists; selecting an open-source license is a separate owner choice.
- The [public-release review](docs/PUBLIC_RELEASE_REVIEW.md) records the tracked-tree/history inspection. Generated output, dependencies, local data, credentials, logs, and machine files are ignored.
