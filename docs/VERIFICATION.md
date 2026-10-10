# Verification report

Verified on October 9, 2026, using Node 26.4.0 and the available Chrome browser tools. The normal game is served at `http://localhost:5173`. Browser QA used both the Vite development client and the built production client.

## Automated checks actually run

`npm test`: **34 passing tests**, zero failures. Coverage includes:

- All 13 bet targets against all six outcomes, with the task's replacement mapping.
- Ordinary hit, complete miss, full-coverage break-even, net-loss win, and overlapping number/row/column/color returns.
- Exactly one outcome sample and one ordinary transfer; amount independence; both worked transfer examples; uniform-board and low-probability ordinary wins.
- Every additional target removing Jackpot eligibility, inactive zero wagers, internal-probability tie-breaking, missed Jackpot attempts, and forced Shake.
- A sole 10 G Jackpot from 100 G: **240 G returned, +230 G net, 330 G settled**, followed by a fresh permutation.
- 100,000 probability transfers preserving positive, finite values and a sum within `1e-10` of one.
- Invalid wagers, overspending, invalid requests/nicknames, rejected score submission, and session validation.
- SQLite reopening, free repeated Shake, preserved personal best, bankruptcy restart, and retry safety for all action types.
- Concurrent duplicate HTTP Rolls, stale revisions, request-ID reuse with altered data, lost-response recovery, a restarted HTTP server, and two independent sessions.
- Exact Gold beyond `2^53` and SQLite's 64-bit integer range, including 81-digit values, settlement, JSON, storage, and numerical leaderboard ordering.

`npm run build`: passed TypeScript checking and Vite production build. The final client is approximately 23.8 kB JavaScript and 21.6 kB CSS before compression. `git diff --check` passed. Dependency installation reported zero known vulnerabilities.

## Browser checks actually performed

| Check | Observed result |
|---|---|
| Desktop, 1280×800 | Board, amount selector, Roll/Shake, last result, and footer fit; document dimensions 1280×800. |
| Mobile, 390×844 | Responsive board and trophy drawer worked; document dimensions 390×844. |
| All targets | Added 1 G to each target: 13 G draft, 87 G available, 100 G settled. |
| Draft editing | Reduced individual wagers, removed wagers, and cleared the complete draft. |
| Overlapping wagers | Placed and rolled combinations of numbers, rows, columns, and colors. |
| Coverage | Left column selection highlighted exactly 1 and 2. Keyboard focus and selected group highlights were inspected. |
| Overspending | A 999 G addition against 100 G was rejected with an available-Gold message; draft stayed zero. |
| Full coverage | Six 10 G wagers returned 60 G, kept 100 G settled, and visibly moved the rolled number's probability. |
| Shake | Cleared the draft, changed the distribution, and kept settled Gold. |
| Shared leaderboard | Separate cookie sessions at `localhost` and `127.0.0.1` were named Desktop Player and Mobile Player; both clients displayed both records from the same backend. |
| Refresh and actual server restart | Stopped the development server and started the production server using the same SQLite file. Compared browser-visible Gold, all six probabilities, and the last result before and after; all matched. Nicknames and leaderboard also survived. |
| Jackpot fixture | Added Black to a sole marked-number wager and saw eligibility disappear; removed Black, rolled 6, saw 330 G, 240 G return, +230 G net, and a new marker on 5. |
| Keyboard and reduced motion | Used Enter to place/roll wagers and restart. Enabled Reduce motion in Settings; computed die animation was `none`, and settlement completed. |
| Bankruptcy | Lost the fixture's 330 G; restart restored 100 G while the best remained 330 G. |
| Large Gold fixture | Entered and wagered `9,007,199,254,740,993`. An ordinary ×6 hit displayed `54,043,195,528,445,958 G`, with exact `+45,035,996,273,704,965 G` net. |
| Settings | Saved nicknames and toggled sound and reduced motion. |
| Runtime logs | No browser errors in the inspected desktop or mobile sessions after final production reload. |

Browser review caught and fixed excessive desktop height, small mobile group labels, a missing mobile Settings accessible name, group-wager label overlap, and large personal-best text colliding with the board. Large wager drafts open the editing tray so the full integer remains easy to inspect. Expanded trays and unusually long values may require ordinary vertical scrolling.

## Reproduce deterministic UI cases

The optional test server is separate from normal play. It uses an in-memory database, an injected RNG, and `qa.localhost` to isolate its cookie from the normal game. There are no debug endpoints or selectable seeds in the normal backend.

```sh
npm run preview:fixture
```

Open `http://qa.localhost:5174`, wager 10 G only on 6, then Roll. The first Roll hits Jackpot and the forced Shake moves the marker to 5. Restart this fixture process between deterministic runs.

For the large-integer case, stop the fixture process and run:

```sh
SCENARIO=large npm run preview:fixture
```

Reload the fixture page, wager the displayed `9007199254740993` G on 1, and Roll. Test fixture scores do not enter the normal leaderboard. Both fixture processes were stopped after verification.

## Screenshots

- [Desktop with overlapping draft wagers](screenshots/desktop.jpg)
- [Mobile with column coverage highlighted](screenshots/mobile.jpg)
- [Shared leaderboard](screenshots/leaderboard.jpg)
- [Jackpot result and fresh board](screenshots/jackpot-desktop.jpg) — captured during fixture QA, before minor final spacing refinements.

## Limits

The sketch attachment was not available; its listed arrangement was followed. Browser verification used desktop Chromium with viewport resizing, not a physical touch device. Safari, Firefox, screen-reader speech, and OS-level reduced-motion emulation were not tested; reduced motion was exercised through the game's own setting. Sound controls and procedural audio calls worked without errors; subjective audio quality was not measured. Network-loss replay and stale-request behavior were exercised in automated HTTP tests rather than by disconnecting a live browser mid-Roll.
