# Sixfold

Sixfold (`sixfold`) is a competitive, 100-roll weighted-dice game. TypeScript, HTML/CSS/SVG, Vite, a small Node HTTP server, and a persistent SQLite leaderboard. No cloud account, external assets, or service credentials.

## Run locally

Use **Node.js 22.16+** (tested with 26.4.0). From this directory:

```sh
npm install
npm run dev
```

After installation, **`npm run dev` is the only startup command**. It serves the browser client, API, and database at **http://localhost:5173** by default. If that port is busy, development startup tries the next available port (up to 20 additional ports) and prints the actual URL. Open the URL printed by the new command. Keep the command running while playing. The development server listens on all IPv4 interfaces and prints a **Network** URL at startup. To play on a phone connected to the same Wi-Fi, open that URL (for example, `http://192.168.1.185:5173`). On the phone, `localhost` refers to the phone itself, so use the computer's network address instead.

If the Network URL cannot connect, check that the computer's firewall permits incoming Node.js connections and that the Wi-Fi is not a guest network that isolates devices. Restart the server after changing its host or port configuration.

For the built client:

```sh
npm run build
npm start
```

`HOST`, `PORT`, and `DB_PATH` can override the bind address, port, and database file. Example: `PORT=5174 DB_PATH=./data/demo.sqlite npm run dev`. An explicit `PORT` and all `npm start` runs require that exact port; a conflict exits cleanly with instructions to stop the existing server or choose a different port. Use `HOST=127.0.0.1 npm run dev` for access only from this computer. `npm start` binds to loopback by default; use `HOST=0.0.0.0 npm start` for network access to the built client. All records live in the SQLite files under `data/`; keep this directory to preserve games and scores across server restarts. A browser cookie identifies the player. Clearing that cookie creates a new player; it does not remove the previous record.

## Play

The initial selected amount is 10 G. Enter any exact whole amount. Tap any target to add that amount; wagers on the same target combine. The amount field accepts exact whole numbers. The + / − buttons and the ↑ / ↓ keys while the amount control is focused change the selected amount by 5 G, down to 1 G. Clicking or tapping a placed chip adds another bet to its target. **Right-click a target or chip** to cancel the target’s entire draft wager; Delete/Backspace removes the focused target’s wager too. Three chip shortcuts beside the amount recall the last three distinct successfully placed amounts, newest first. Selecting a shortcut changes the amount without placing a wager. History persists in this browser across refreshes and restarts; unused slots stay empty until you place bets. Remove a wager and place a smaller amount to reduce it. Draft edits spend no Gold.

Each run starts with **100 G and 100 rolls**. Every settled Roll counts, including losses and break-even wagers. Shake does not consume or restore rolls. Your wagers can use your full available bankroll. After roll 100, the final balance becomes the run’s score and betting stops. The leaderboard keeps each player’s best completed score; temporary peaks never post. A bankruptcy before roll 100 ends the run without submitting a score. A results popup opens after either ending. On completion it shows the final score, personal best, and whether this is a first record, improvement, tie, or lower score. It survives refresh. Set your leaderboard name and choose **Confirm & play again** to save the name and start with 100 G and zero rolls used in one retry-safe action. Early bankruptcy shows that no score was posted. The separate New run button is removed. In Settings, the red **Restart run** button also lets you abandon an unfinished run after confirmation. It discards current progress and bets without submitting a score, and preserves your completed leaderboard record.

**Roll** commits the draft. **Shake** costs no Gold but starts locked on every fresh board. Any nonzero settled gain or loss unlocks one Shake; break-even rolls and draft edits do not count. Shaking changes the probabilities, clears the draft, and locks Shake again. A Jackpot reset and restarting at zero Gold also lock the new board. Hovering or focusing a group highlights its numbers; selected groups stay highlighted. Odds and the Jackpot target are hidden. **Tilt 1–6** is a prominent gold control on the table. Higher means the odds lean toward fewer numbers, without identifying those numbers. Tap it to open the guide’s low/high Tilt explanation. A winning sole wager on the least likely number pays **Jackpot ×24 on every board**, regardless of its probability; the lowest number breaks ties. Any additional positive target removes Jackpot eligibility. A highlighted Rolls remaining card counts down from 100. The Jackpot target stays hidden. A Jackpot hit keeps earned Gold and automatically Shakes. A new run retains the previous best completed score.

The leaderboard is a compact rank, name, and score list on the right on wide screens, with your own row highlighted. On smaller screens, the trophy button opens the tower from the right. The gear button opens Settings for nickname, sound, motion, and the developer **Show probabilities** switch. Probability visibility saves in this browser and defaults to off. A gameplay guide opens for a saved player with no previous roll and no dismissed guide; it stays dismissed across refreshes and restarts. The separate **How to play** sidebar control reopens it at any time; Settings contains no guide link. The guide contains the complete rules and preference descriptions: wagering and editing, payouts, starting odds with a 2% floor, random transfers, Tilt, Shake, Jackpot, persistence, and keyboard controls. It includes an expandable example and small-bet play hints, with a white reading surface and serif text. Tab/Enter/Space operate the controls; **R and S work directly after placing a bet, including while a target button has focus**. They pause in text fields, editable text, and open dialogs, and ignore modifier combinations, key repeats, and composition. System reduced-motion preferences and the game's Reduce motion setting skip die movement. Sound defaults to on after a game interaction and uses procedural Web Audio fanfares, impact sounds, and coin chimes. A saved mute preference stays muted; switching sound off also stops scheduled notes.

## Configuration and code

- [`src/config.ts`](src/config.ts): all prototype defaults, the explicit board mapping, payout multipliers, and UI timing. Coverage is derived from this one mapping: top **1 red / 3 black / 5 red**; bottom **2 black / 4 red / 6 black**.
- [`server/rules.ts`](server/rules.ts): pure wager validation, sampling, settlement, transfer, and Jackpot rules. Animations cannot change results.
- [`server/store.ts`](server/store.ts): SQLite transactions, sessions, records, and idempotency receipts.
- [`server/http.ts`](server/http.ts): same-origin JSON API. No endpoint accepts authoritative balances, probabilities, or scores.
- [`src/main.ts`](src/main.ts) and [`src/style.css`](src/style.css): DOM interface, presentation, and responsive layout.
- [`tests`](tests): automated rule, persistence, concurrency, and HTTP checks.
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md): executed checks and browser observations.

## Probability model

Fresh boards use a symmetric Dirichlet(1,1,1,1,1,1) draw, scaled to reserve a 2% minimum for each face: `p[i] = 0.02 + 0.88 × w[i]`. All six weights vary; there is no fixed template. After a non-Jackpot payout, a uniform random rate transfers part of the rolled face's probability above 2%. The range follows the pre-roll Tilt: levels 1–6 use **4–8%, 4.2–8.4%, 4.4–8.8%, 4.6–9.2%, 4.8–9.6%, and 5–10%**, respectively. A new five-way Dirichlet draw splits the transfer among the other faces. Misses preserve the board. Bet size and overlapping payouts do not affect the update.

The transfer curve is flatter: the mean rises from 6% at Tilt 1 to 7.5% at Tilt 6. The old middle band is split in two; old levels 4 and 5 become levels 5 and 6, with their concentration boundaries preserved. In 10,000 seeded starts per policy, the new Tilt 5 lasts a median three rolls when betting the initially strongest face and four with rotating group bets; Tilt 6 lasts two and four, respectively. Full coverage changes the board on every roll and produces two-roll medians at both upper levels. These are pacing targets, not guaranteed minimums. Reproduce the comparison with `npm run test:balance`.

Tilt uses Shannon entropy and converts the effective number of outcomes into six levels. It reveals concentration, not a favored face, group probability, or expected profit. See [the probability model](docs/PROBABILITY_MODEL.md) for formulas, level boundaries, and tuning results.

The server persists a single Shake entitlement. A settled nonzero result unlocks it; later break-even rolls do not revoke it, and gains followed by losses still count even if the balance returns to its previous value. A manual or automatic reset consumes it. Ending a run disables Shake. The 100-roll competition migration resets the old endless-game saves, player sessions, scores, and action receipts exactly once. New saves persist normally across subsequent server restarts. Schema version 2 adds the previous personal best used by the results popup, preserving all competition players, scores, and receipts. Legacy completed runs compare against their saved best because their earlier best was not recorded. Browser sound, motion, and developer-display preferences remain local.

## Implementation decisions

[`spec.md`](spec.md) describes the current implementation, including the board mapping, hidden odds, earned Shake, tuned transfers, keyboard behavior, and storage rules. Configuration is defined in `src/config.ts`, with settlement and bankroll validation in `server/rules.ts`. Three separate cards—Bankroll, highlighted Rolls remaining, and On the table—sit to the left, the felt table occupies the center, and the compact leaderboard sits to the right. The best-score panel, Available readout, progress meter, and repeated leaderboard explanations are removed. On the table shows only the draft total; Edit bets, Clear, and the Jackpot availability message are removed. Small screens use a right-side leaderboard drawer. The red and black color bets have matching fills, separated from the number grid by a small felt gap. Number glyphs are centered using Canvas ink measurements rather than the SVG text box, including the descending 3, 4, and 5. The surrounding UI uses flat balance panels, aligned wager controls, quiet utility buttons, and a leaderboard with consistent columns and fine row dividers.

Wagers appear as round casino chips with varied positions, rotations, and colors. Each addition tosses a chip onto the target, displaying up to five chips; the top chip shows the total wager. Existing chip positions stay stable through unrelated UI updates. Fixed grid tracks and overlaid effects keep the table from resizing. All three left cards share label-over-value formatting, padding, spacing, and numeral typography, while Rolls remaining retains its highlighted background. Bankroll and On the table use smaller G units aligned to the numeral baseline. Their fixed-height value rows fit full exact numbers by reducing the numeral size, including during animation and viewport resizing. A six-faced CSS die tumbles before revealing the server's committed outcome. Shake instead slides the old die away and brings in a fresh one; Jackpot resets use the same replacement after the celebration. Starting a new run also replaces the die, counts the bankroll back to 100 G, and fades/slides the three cards into their refreshed state over about 800 ms. Gameplay stays locked during that transition. Reduced motion applies the reset immediately. The guide retains a visible close control when jumping to the Tilt explanation. Net-positive wins add a large gain banner, 40 celebration particles (64 for a Jackpot), expanded coin flights, and a layered fanfare. Paying targets glow and show their returns. Break-even and net-loss returns retain their accurate result labels without a victory banner. Reduced motion skips movement and particle effects. Large chip labels are abbreviated; the target's accessible name and tooltip retain the exact wager.

Gold, wagers, returns, records, and revisions use **BigInt** internally and canonical decimal **strings** in JSON and SQLite. Scores sort by decimal string length, then lexical value, so ranking works beyond both JavaScript's safe integer range and SQLite's 64-bit integer range. No gameplay score cap is imposed. Probability values use unrounded IEEE-754 doubles; developer labels show up to two decimals when enabled. Hidden values are omitted from target labels and accessible names. This is presentation hiding: the API still returns the odds to the client. Labels never feed settlement. The outcome sampler uses the stored weights' sum to absorb floating-point roundoff; it does not smooth the probabilities.

The server generates cryptographic random numbers and anonymous 256-bit session cookies, storing only their hashes. An action carries its expected revision and a unique request ID. A SQLite `BEGIN IMMEDIATE` transaction checks the revision, settles, increments the roll count, updates the best completed score only on roll 100, and stores the complete response together. Reusing an ID with the same request returns the original receipt; reusing it for different data is rejected. Stale requests return the latest board without settling. Receipts are retained indefinitely for retry safety.

Uncommitted drafts belong to the current tab and clear on refresh, settlement, or Shake. The active game and last settled result are durable. The client saves a pending action in session storage before sending it, and recovers the same request after a network interruption or reload. Cross-tab updates invalidate the draft. Clients refresh state and the leaderboard every five seconds and on window focus.

The leaderboard shows the top 50 players by their best **final Gold after 100 rolls**, with stable player-ID ordering for ties. A player has no ranked score until completing all 100 rolls. A final score below 100 G, including zero on roll 100, is valid; bankruptcy earlier posts nothing. Later unfinished or lower-scoring runs do not replace a completed best. Names need not be unique. The results popup restarts ended runs; Settings can discard an active run after confirmation.

## Checks

```sh
npm test
npm run build
npm run test:balance
```

Run `npm run audit:strategies` for the offline strategy audit. It verifies full coverage and the always-available Jackpot expectation, then compares blind number bets, the old hedge-to-12% strategy, and informed expected-return selection over 100 rolls. See [the current rules and historical findings](docs/PROBABILITY_MODEL.md#can-a-player-reliably-farm-gold). This audit uses production settlement without accessing player data.

Browser regression tests use Playwright and start their own in-memory fixture server on an available port:

```sh
npx playwright install chromium
npm run test:ui
```

To use an existing Chrome/Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path instead of downloading a browser. The UI suite covers click/keyboard betting followed by R, S eligibility, disabled and pending actions, shortcut guards, the complete guide, and final-roll submission, reload, locked controls, and restarting at desktop/mobile widths.

The tests use isolated temporary databases and injected randomness; neither a test endpoint nor a client-controlled random seed exists in the playable server. Tests never modify the normal game database. The offline balance script also uses the actual probability rules without touching any database. An optional `npm run preview:fixture` command serves deterministic browser cases on a separate in-memory test server; see the verification report for instructions.

This is a local prototype. It has no account recovery, moderation, rate limiting, public deployment configuration, or receipt-retention cleanup. Browser inspection uses Chromium; physical phone/Safari/Firefox coverage is not claimed. See the verification report for exact checks and screenshots.

Implementation references: [Node SQLite](https://nodejs.org/api/sqlite.html), [Vite middleware API](https://vite.dev/guide/api-javascript).
