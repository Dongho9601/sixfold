# Sixfold

A free hobby browser game about discovering changing odds on a six-sided die. Start with 100 Gold and play up to 100 rolls. Bet on numbers, rows, columns, or colors; observe Tilt, earn a free Shake, and find the hidden ×24 Jackpot. Gold has no monetary value. There are no ads, payments, accounts, or shared rankings.

Every fresh board starts at **Tilt 3, 4, 5, or 6**, including new runs, Shake, and automatic Jackpot replacements. Tilt 1 and 2 are reached through ordinary paying rolls that redistribute the board’s probabilities. Fresh boards retain the random distribution of the higher levels; those four starting levels are not equally likely. Saved boards keep their existing odds when reopened.

Everything runs in the browser. The personal leaderboard keeps this browser’s best 10 eligible completed runs, ranked by final Gold after roll 100. Enabling Show probabilities excludes that run from records, even if hidden again. Earlier bankruptcy records no score. Tilt displays two lines: a smaller white Tilt N above an uppercase description, using six descriptions from NEARLY EVEN to EXTREME BIAS, and animates changes. A ▲ beside the description indicates increased bias (lower entropy) after the latest roll; ▼ indicates decreased bias (higher entropy), and - indicates unchanged entropy. The arrows track unrounded probabilities even when the Tilt level stays the same. Shake, Jackpot, restart, and reload show - until another roll. BOARD NET tracks cumulative returns minus settled bets on the current die and resets when Shake, Jackpot, or restart supplies a fresh die.

The phone table fills the available viewport height. On touch devices in the phone layout, tapping Bet amount opens an in-game numeric keypad over the game, keeping the board stationary without invoking the browser’s native keyboard. The 10%, 20%, and 30% buttons fill the amount from the current bankroll, rounded down to whole Gold with a minimum of 1 G. Done applies the amount; the close button cancels the edit. Desktop input remains directly editable. Settings includes a saved “Swap Roll and Shake on mobile” switch, which reverses the mobile buttons while retaining the desktop order. Settings also links to the creator’s website, and the seven-language guide and About page explain the current rules and browser saves.

The first visit starts a guided tutorial **on the actual game board**. The existing cells, tossed chips, three-dimensional die, bankroll counters, Bet amount, Roll dice and Shake controls do all the playing. A bright ivory instruction panel sits above the board, with a Tutorial label, step count and five-part progress line. A gold outline and tap marker identify the next real control; unavailable betting cells recede. When the bets are ready, the prompt switches to rolling and the actual Roll dice button becomes the focus. Place a number bet, add a row/column/color, roll and see the payout, use Shake, and try a guided Jackpot before starting the real run. Short landscape layouts place the same panel above the existing action controls beside the board. The coaching shares the guide’s seven languages and supports normal keyboard and touch controls, with its pulse disabled by reduced motion.

Tutorial play temporarily supplies in-memory practice state to the existing game renderer and action/animation path. The real run, its randomness, draft bets, amount, chip positions, recent amounts and personal records are preserved. Skip or Escape exits; leaving during a roll safely finishes its presentation before restoring the saved game. Finishing or skipping saves the current `tutorialVersion` (2). Existing saves default it to 0 without losing progress. Version 1 dismissals are also offered the more visible version once. An ended run shows its results first. Refresh during unfinished practice starts the first step again.

**Help** keeps How to play and Replay tutorial available at any time. The guide presents eight slides in all seven languages, illustrated with screenshots of the actual game. The main explanation comes before the screenshot; captions and further guidance follow it. Desktop and phone layouts use their own captures. The coverage slide compares real 10 G bets on Number 3, the middle column, Odds, and Red, including the game’s own coverage highlights and chips. Tilt uses cropped screenshots of its actual indicator, and settlement, Shake, Jackpot, and completion use staged game states that match their explanations. View full size opens the displayed image. Back/Next buttons, left/right arrow keys, Home/End, and horizontal touch swipes navigate the slides. Tapping Tilt opens its slide directly. Full rules opens the complete reference; returning keeps the current slide. Opening How to play during practice preserves the lesson and returns focus to it. The reading area scrolls while navigation stays visible, preserving 18px body text. Screenshots load as their slides become visible. The guide and tutorial share the saved language preference and respect reduced motion.

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

The build is static HTML, JavaScript, CSS, SVG, and JPEG guide screenshots. It needs no production Node process, database, environment variables, API, or routing rewrites. Vite preview is a local verification tool. `package.json` stays `private: true`; npm publication is outside this project’s setup.

Regenerate the guide’s screenshots with `npm run capture:guide`. The capture script opens the production game in isolated Chromium contexts, stages example saves, places real bets and rolls through the UI, and checks the pictured states. It writes the desktop/phone images and capture manifest in `public/guide/`, updates intrinsic image dimensions in `src/guide-images.ts`, and rebuilds the static output. It does not access a player’s existing browser save.

Captures leave space around the pictured controls and labels. Coverage examples include the complete table frame so chips extending past a cell remain visible. The capture manifest records each crop and its margin.

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

Restart discards the current run and draft while retaining records, name, sound/motion preferences, mobile button order, guide preferences, and recent bet amounts. Unrolled draft bets clear on reload. Saves belong to this browser and origin; development, preview, and the hosted site have separate saves. Clearing Sixfold’s data or the browser’s site data loses that progress. There is no synchronization or export/import.

If storage is blocked or full, play continues in memory with a brief save warning. Malformed or incompatible data starts a fresh run, preserving the first unreadable value under `sixfold:save:recovery` when possible. Sixfold reads and writes only its own keys and never calls `localStorage.clear()`. A temporary `sixfold:settings:pending:v1` journal preserves last-second preference edits during navigation without rewriting run state. Same-origin tabs use storage events and revision checks; Web Locks serializes normal writes where available. Old local SQLite data and backups are ignored and left untouched; they are not imported into this new browser-save format.

## Later GitHub Pages setup

The intended project site is **https://Dongho9601.github.io/sixfold/** from `Dongho9601/sixfold`. Vite’s base is `/sixfold/`; the game, About page, and favicon use that project path. The personal homepage is a separate repository and does not need changes.

This checkout adds no CI or deployment workflow and does not publish anything. After reviewing and committing the changes in a later pass, make the repository public and choose a Pages publishing source in this repository’s **Settings → Pages**. Either publish the contents of a locally built `dist/` to the root of a dedicated publishing branch, or separately authorize a future Actions workflow that builds and uploads `dist/`. Do not select the source documentation directory as the site output. The build includes `.nojekyll` for branch-based static publishing. No custom domain or `CNAME` is configured here. [GitHub’s publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) explains the source choices; [Vite’s Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) documents the project-site base path.

## Repository notes

- [Game specification](docs/spec.md) and [probability model](docs/PROBABILITY_MODEL.md) describe the mechanics and balance experiments.
- `src/game/` contains pure rules and run transitions plus browser randomness; `src/save.ts` handles versioned browser persistence; `src/main.ts` presents the game.
- [Credits](CREDITS.md) preserve the design references and dependency attribution. No project license exists; selecting an open-source license is a separate owner choice.
- The [public-release review](docs/PUBLIC_RELEASE_REVIEW.md) records the tracked-tree/history inspection. Generated output, dependencies, local data, credentials, logs, and machine files are ignored.
