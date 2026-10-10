# Sixfold

Sixfold (`sixfold`) is a playable, endless weighted-dice game. TypeScript, HTML/CSS/SVG, Vite, a small Node HTTP server, and a persistent SQLite leaderboard. No cloud account, external assets, or service credentials.

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

The initial selected amount is 10 G. Enter any exact whole amount. Tap any target to add that amount; wagers on the same target combine. The amount field accepts exact whole numbers. The + / − buttons and the ↑ / ↓ keys while the amount control is focused change the selected amount by 5 G, down to 1 G. **Right-click a target** to cancel its entire draft wager. **Edit bets** exposes reduction and removal controls for touch and keyboard users; **Clear** clears all wagers without spending Gold.

Your wagers can use your full available bankroll.

**Roll** commits the draft. **Shake** costs no Gold but starts locked on every fresh board. Any nonzero settled gain or loss unlocks one Shake; break-even rolls and draft edits do not count. Shaking changes the probabilities, clears the draft, and locks Shake again. A Jackpot reset and restarting at zero Gold also lock the new board. Hovering or focusing a group highlights its numbers; selected groups stay highlighted. Odds and the Jackpot target are hidden. **Tilt 1–5** is a prominent gold control on the table. Higher means the odds lean toward fewer numbers, without identifying those numbers. Tap it to open the guide’s low/high Tilt explanation. A sole wager on the least likely number qualifies for Jackpot ×24; the lowest number breaks ties. A Jackpot hit keeps earned Gold and automatically Shakes. At zero Gold, **Start again** restores 100 G and keeps the previous best.

The leaderboard is a persistent tower on the right on wide screens, with your rank highlighted and progress toward the next player. On smaller screens, the trophy button opens the tower from the right. The gear button opens Settings for nickname, sound, motion, and the developer **Show probabilities** switch. Probability visibility saves in this browser and defaults to off. A gameplay guide opens for a saved player with no previous roll and no dismissed guide; it stays dismissed across refreshes and restarts. **How to play**, also linked from Settings, reopens it at any time. The guide contains the complete rules and preference descriptions: wagering and editing, payouts, starting odds with a 2% floor, random transfers, Tilt, Shake, Jackpot, persistence, and keyboard controls. It includes an expandable example and small-bet play hints, with a white reading surface and serif text. Tab/Enter/Space operate the controls; **R and S work directly after placing a bet, including while a target button has focus**. They pause in text fields, editable text, and open dialogs, and ignore modifier combinations, key repeats, and composition. System reduced-motion preferences and the game's Reduce motion setting skip die movement. Sound defaults to on after a game interaction and uses procedural Web Audio fanfares, impact sounds, and coin chimes. A saved mute preference stays muted; switching sound off also stops scheduled notes.

## Configuration and code

- [`src/config.ts`](src/config.ts): all prototype defaults, the explicit board mapping, payout multipliers, and UI timing. Coverage is derived from this one mapping: top **1 red / 3 black / 5 red**; bottom **2 black / 4 red / 6 black**.
- [`server/rules.ts`](server/rules.ts): pure wager validation, sampling, settlement, transfer, and Jackpot rules. Animations cannot change results.
- [`server/store.ts`](server/store.ts): SQLite transactions, sessions, records, and idempotency receipts.
- [`server/http.ts`](server/http.ts): same-origin JSON API. No endpoint accepts authoritative balances, probabilities, or scores.
- [`src/main.ts`](src/main.ts) and [`src/style.css`](src/style.css): DOM interface, presentation, and responsive layout.
- [`tests`](tests): automated rule, persistence, concurrency, and HTTP checks.
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md): executed checks and browser observations.

## Probability model

Fresh boards use a symmetric Dirichlet(1,1,1,1,1,1) draw, scaled to reserve a 2% minimum for each face: `p[i] = 0.02 + 0.88 × w[i]`. All six weights vary; there is no fixed template. After a non-Jackpot payout, a uniform random rate transfers part of the rolled face's probability above 2%. The range follows the pre-roll Tilt: levels 1–5 use **6–12%, 9–18%, 12–24%, 15–30%, and 18–36%**, respectively. A new five-way Dirichlet draw splits the transfer among the other faces. Misses preserve the board. Bet size and overlapping payouts do not affect the update.

These rates are 1.5× the preceding tuning (3× the original baseline), following the request for quicker progression. The comparison uses 10,000 seeded boards per policy. With rotating small group bets, the median first Tilt change is five rolls and arrival at Tilt 1 is 16 rolls, down from six and 23. Within 20 rolls, 69.0% of tested boards reach Tilt 1. The initially strongest face remains at or above a 30% chance for a median 13 rolls, down from 21. This measures pacing and opportunity duration, not proven human enjoyment. Reproduce it with `npm run test:balance`; the model document records assumptions and alternatives.

Tilt uses Shannon entropy and converts the effective number of outcomes into five coarse levels. It reveals concentration, not a favored face, group probability, or expected profit. See [the probability model](docs/PROBABILITY_MODEL.md) for formulas, level boundaries, examples, and tuning rationale.

The server persists a single Shake entitlement. A settled nonzero result unlocks it; later break-even rolls do not revoke it, and gains followed by losses still count even if the balance returns to its previous value. A manual or automatic reset consumes it. Database migration preserves existing balances and odds, starts existing players locked, and leaves old boards below the new floor intact until their next reset.

## Implementation decisions

[`spec.md`](spec.md) describes the current implementation, including the board mapping, hidden odds, earned Shake, tuned transfers, keyboard behavior, and storage rules. Configuration is defined in `src/config.ts`, with settlement and bankroll validation in `server/rules.ts`. Separate Bankroll and Personal Best panels sit to the left, the felt table occupies the center, and the leaderboard tower sits to the right. Small screens use a right-side leaderboard drawer. The red and black color bets have matching fills, separated from the number grid by a small felt gap. Number glyphs are centered using Canvas ink measurements rather than the SVG text box, including the descending 3, 4, and 5. The surrounding UI uses flat balance panels, aligned wager controls, quiet utility buttons, and a leaderboard with consistent columns and fine row dividers.

Wagers appear as round casino chips with varied positions, rotations, and colors. Each addition tosses a chip onto the target, displaying up to five chips; the top chip shows the total wager. Existing chip positions stay stable through unrelated UI updates. Fixed grid tracks, overlaid effects, and a bet editor keep the table from resizing. A six-faced CSS die tumbles before revealing the server's committed outcome. Shake instead slides the old die away and brings in a fresh one; Jackpot resets use the same replacement after the celebration. The guide retains a visible close control when jumping to the Tilt explanation. Net-positive wins add a large gain banner, 40 celebration particles (64 for a Jackpot), expanded coin flights, and a layered fanfare. Paying targets glow and show their returns. Break-even and net-loss returns retain their accurate result labels without a victory banner. Reduced motion skips movement and particle effects. Large chip labels are abbreviated; the target's accessible name, tooltip, and bet editor retain the exact wager.

Gold, wagers, returns, records, and revisions use **BigInt** internally and canonical decimal **strings** in JSON and SQLite. Scores sort by decimal string length, then lexical value, so ranking works beyond both JavaScript's safe integer range and SQLite's 64-bit integer range. No gameplay score cap is imposed. Probability values use unrounded IEEE-754 doubles; developer labels show up to two decimals when enabled. Hidden values are omitted from target labels and accessible names. This is presentation hiding: the API still returns the odds to the client. Labels never feed settlement. The outcome sampler uses the stored weights' sum to absorb floating-point roundoff; it does not smooth the probabilities.

The server generates cryptographic random numbers and anonymous 256-bit session cookies, storing only their hashes. An action carries its expected revision and a unique request ID. A SQLite `BEGIN IMMEDIATE` transaction checks the revision, settles, updates the best score, and stores the complete response together. Reusing an ID with the same request returns the original receipt; reusing it for different data is rejected. Stale requests return the latest board without settling. Receipts are retained indefinitely for retry safety.

Uncommitted drafts belong to the current tab and clear on refresh, settlement, or Shake. The active game and last settled result are durable. The client saves a pending action in session storage before sending it, and recovers the same request after a network interruption or reload. Cross-tab updates invalidate the draft. Clients refresh state and the leaderboard every five seconds and on window focus.

The leaderboard shows the top 50 players by highest settled Gold, with stable player-ID ordering for ties. Best Gold starts at 100. Names need not be unique. Existing players remain in the database even when outside the visible top 50. Restart is available only at zero Gold.

## Checks

```sh
npm test
npm run build
npm run test:balance
```

Browser regression tests use Playwright and start their own in-memory fixture server on an available port:

```sh
npx playwright install chromium
npm run test:ui
```

To use an existing Chrome/Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path instead of downloading a browser. The UI suite covers click/keyboard betting followed by R, S eligibility, disabled and pending actions, shortcut guards, and the complete guide at desktop/mobile widths.

The tests use isolated temporary databases and injected randomness; neither a test endpoint nor a client-controlled random seed exists in the playable server. Tests never modify the normal game database. The offline balance script also uses the actual probability rules without touching any database. An optional `npm run preview:fixture` command serves deterministic browser cases on a separate in-memory test server; see the verification report for instructions.

This is a local prototype. It has no account recovery, moderation, rate limiting, public deployment configuration, or receipt-retention cleanup. Browser inspection uses Chromium; physical phone/Safari/Firefox coverage is not claimed. See the verification report for exact checks and screenshots.

Implementation references: [Node SQLite](https://nodejs.org/api/sqlite.html), [Vite middleware API](https://vite.dev/guide/api-javascript).
