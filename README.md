# Sixfold

Sixfold (`sixfold`) is a playable, endless weighted-dice game. TypeScript, HTML/CSS/SVG, Vite, a small Node HTTP server, and a persistent SQLite leaderboard. No cloud account, external assets, or service credentials.

## Run locally

Use **Node.js 22.16+** (tested with 26.4.0). From this directory:

```sh
npm install
npm run dev
```

After installation, **`npm run dev` is the only startup command**. It serves the browser client, API, and database at **http://localhost:5173**. Keep the command running while playing. The server binds to loopback by default.

For the built client:

```sh
npm run build
npm start
```

`PORT` and `DB_PATH` can override the port and database file. Example: `PORT=5174 DB_PATH=./data/demo.sqlite npm run dev`. All records live in the SQLite files under `data/`; keep this directory to preserve games and scores across server restarts. A browser cookie identifies the player. Clearing that cookie creates a new player; it does not remove the previous record.

## Play

The initial selected amount is 10 G. Tap any target to add that amount; wagers on the same target combine. The amount field accepts exact whole numbers. Arrow buttons change the selected amount by 5 G, down to 1 G. **Edit bets** exposes reduction and removal controls; **Clear** clears all wagers without spending Gold.

**Roll** commits the draft. **Shake** is free and unlimited; it changes the probabilities and clears the draft. Hovering or focusing a group highlights its numbers; selected groups stay highlighted. A sole wager on the marked number qualifies for Jackpot ×24. A Jackpot hit keeps earned Gold and automatically Shakes. At zero Gold, **Start again** restores 100 G and keeps the previous best.

Use the left leaderboard rail (the trophy button on mobile) and Settings for nickname, sound, motion, and rules. Tab/Enter operate the controls; R and S work when focus is outside buttons or text fields. System reduced-motion preferences and the game's Reduce motion setting skip die movement. Sound starts muted and uses procedural Web Audio tones.

## Configuration and code

- [`src/config.ts`](src/config.ts): all prototype defaults, the explicit board mapping, payout multipliers, and UI timing. Coverage is derived from this one mapping: top **1 red / 3 black / 5 red**; bottom **2 black / 4 red / 6 black**.
- [`server/rules.ts`](server/rules.ts): pure wager validation, sampling, settlement, transfer, and Jackpot rules. Animations cannot change results.
- [`server/store.ts`](server/store.ts): SQLite transactions, sessions, records, and idempotency receipts.
- [`server/http.ts`](server/http.ts): same-origin JSON API. No endpoint accepts authoritative balances, probabilities, or scores.
- [`src/main.ts`](src/main.ts) and [`src/style.css`](src/style.css): DOM interface, presentation, and responsive layout.
- [`tests`](tests): automated rule, persistence, concurrency, and HTTP checks.
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md): executed checks and browser observations.

## Implementation decisions

The supplied `spec.md` is retained unchanged. The task's explicit board mapping overrides Section 3; row, column, and color coverage and tests use the replacement mapping. The hand-drawn image was not available in the task files, so the interface follows the arrangement described in the task: left leaderboard rail, Gold above the die, center board with edge group bets, Red/Black below, then amount/Roll/Shake.

Gold, wagers, returns, records, and revisions use **BigInt** internally and canonical decimal **strings** in JSON and SQLite. Scores sort by decimal string length, then lexical value, so ranking works beyond both JavaScript's safe integer range and SQLite's 64-bit integer range. No gameplay score cap is imposed. Probability values use unrounded IEEE-754 doubles; labels show up to two decimals. Labels never feed settlement. The outcome sampler uses the stored weights' sum to absorb floating-point roundoff; it does not smooth the probabilities.

The server generates cryptographic random numbers and anonymous 256-bit session cookies, storing only their hashes. An action carries its expected revision and a unique request ID. A SQLite `BEGIN IMMEDIATE` transaction checks the revision, settles, updates the best score, and stores the complete response together. Reusing an ID with the same request returns the original receipt; reusing it for different data is rejected. Stale requests return the latest board without settling. Receipts are retained indefinitely for retry safety.

Uncommitted drafts belong to the current tab and clear on refresh, settlement, or Shake. The active game and last settled result are durable. The client saves a pending action in session storage before sending it, and recovers the same request after a network interruption or reload. Cross-tab updates invalidate the draft. Clients refresh state and the open leaderboard every five seconds and on window focus.

The leaderboard shows the top 50 players by highest settled Gold, with stable player-ID ordering for ties. Best Gold starts at 100. Names need not be unique. Existing players remain in the database even when outside the visible top 50. Restart is available only at zero Gold.

## Checks

```sh
npm test
npm run build
```

The tests use isolated temporary databases and injected randomness; neither a test endpoint nor a client-controlled random seed exists in the playable server. Tests never modify the normal game database. An optional `npm run preview:fixture` command serves deterministic browser cases on a separate in-memory test server; see the verification report for instructions.

This is a local prototype. It has no account recovery, moderation, rate limiting, public deployment configuration, or receipt-retention cleanup. Browser inspection uses Chromium; physical phone/Safari/Firefox coverage is not claimed. See the verification report for exact checks and screenshots.

Implementation references: [Node SQLite](https://nodejs.org/api/sqlite.html), [Vite middleware API](https://vite.dev/guide/api-javascript).
