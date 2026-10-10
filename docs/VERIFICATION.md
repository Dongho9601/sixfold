# Verification report

## Personal-best bet limit removed — October 9, 2026

Removed the 10% rule from server validation, the amount controls, roll eligibility, Settings, and the first-game guide. The Roll limit label and its hint are gone. Wagers may again use the full available bankroll; the 1 G minimum and existing overspending check remain. The leaderboard, cards, colors, number alignment, and win effects retain their latest design.

Verified: all 34 original tests, the production build, and `git diff --check` passed. In the isolated browser fixture, ↑ raised the amount from 10 to 15 G; a 50 G wager from a 100 G bankroll settled at 1,250 G; a full 1,250 G draft was accepted; adding another 1 G was rejected. No limit text or maximum-value attribute remained. The 320px layout had two accounting values and no horizontal overflow, and no page errors were reported. The previous section and its screenshots record the now-removed limit.

## Leaderboard tower, win celebration, and 10% roll limit — October 9, 2026

Bankroll and Personal Best now occupy separate cards. Red and Black use red and charcoal fills. Every number is centered from its visible SVG glyph bounds, including Georgia's descending 4. A persistent leaderboard tower sits on the right above 1100px; smaller layouts open the same content in a right-side drawer. Stacked ranks highlight the player and show the Gold needed to pass the next competitor. Rank improvements animate upward.

Net-positive wins now show a large gain banner, 40 shower particles (64 for Jackpot), larger bursts and coin flights, plus a layered fanfare, impact sound, and metallic coin notes. Sound defaults to on after interaction while honoring a saved mute preference. Mute stops scheduled notes. Reduced motion skips the moving celebration. Return and net amounts remain separate, and break-even/net-loss payouts do not receive a victory banner.

All wagers in a roll share a cap of **floor(saved Personal Best / 10)**, still bounded by available Gold. The UI shows the limit and rejects additions over it; arrow adjustments stop at it. The server independently enforces the same rule before drawing or writing a receipt. The settled record before the roll determines the cap, so a new best increases the next roll's limit. Existing action receipts remain retry-safe.

Verified in this pass:

- `npm test`: 37 passing tests. New checks cover the exact limit, combined targets, whole-Gold rounding, historical best after losses, available-bankroll limits, 81-digit precision, no sampling on rejection, transaction/receipt integrity, and rejection through HTTP. Existing payout scenarios use an explicit historical best that makes their stakes legal.
- TypeScript and the production build passed. `git diff --check` passed.
- Headless Chrome checked at 1600×1000, 1280×900, 1101×900, 1024×900, 768×900, 390×900, and 320×900. No horizontal overflow was observed. Desktop, mobile, the right-side drawer, and the celebration were visually reviewed.
- Measured visible glyph centers were within 0.51px of their cell centers for all six numbers. Probability visibility remains hidden by default.
- A 100 G record rejected an 11 G single bet and a 6 G + 5 G split. A 6 G + 4 G split was accepted. A deterministic 10 G Jackpot settled at 330 G and raised the displayed limit from 10 G to 33 G; the new 33 G stake was accepted.
- In the synthetic tower fixture, the Jackpot moved the player from rank 6 to rank 3. The right rail stayed visible on wide layouts, the mobile drawer opened against the right edge, and only one leaderboard content tree existed through viewport changes.
- The Jackpot displayed its large banner and at least 40 simultaneous shower particles. Audio instrumentation observed the actual oscillator/buffer source starts for the fanfare. Muting prevented new sound sources, persisted on reload, and reduced motion produced no active movement or banner. Effects cleaned up after settlement. No page errors occurred during the main checks.
- A separately mocked 81-digit browser state verified exact keyboard clamping at the cap, exact wager placement, and no overflow at 320px. Server precision and settlement were checked independently in the automated tests.

Previews: [Desktop tower](screenshots/tower-desktop.png) · [Mobile game](screenshots/tower-mobile.png) · [Win celebration](screenshots/tower-win.png) · [Mobile leaderboard](screenshots/tower-mobile-leaderboard.png).

The tower previews use synthetic opponents in an isolated in-memory fixture: `SCENARIO=tower npm run preview:fixture`. No normal game data was changed. Physical phones, Safari, Firefox, screen-reader speech, and subjective loudspeaker sound quality were not tested. Earlier entries describe previous rules and designs.

## Hidden odds, scattered chips, and first-game guidance — October 9, 2026

The board now centers number and group labels and separates the color bets with 14px of felt on desktop and 12px on mobile. Odds default to hidden, including accessible target names, and a saved developer switch in Settings reveals all 13 probabilities. The Jackpot panel and target marker are removed; settlement rules and win celebrations remain. Round casino chips use varied local positions, rotations, and colors; each addition places another chip, up to five per target, with the total on top. Existing chips keep their positions through unrelated UI updates.

The four preset amount buttons are removed. The wider amount field accepts exact integers and responds to ↑ / ↓ in 5 G steps, with a 1 G minimum. A first-game dialog explains betting and payouts when the saved player has no roll and has not dismissed the guide. Dismissal persists for that player in this browser. Existing roll history suppresses the guide.

Verified in this pass:

- All 34 existing rule, persistence, and HTTP tests passed. TypeScript and the production build passed; `git diff --check` passed.
- Headless Chrome checked at 1280×900, 1024×844, 768×844, 390×844, and 320×844. No horizontal page overflow occurred. Desktop and mobile screenshots were visually reviewed, including the guide and Settings. Mobile uses vertical scrolling.
- ↑ / ↓ changed 10 → 15 → 10, clamped 2 → 1, and preserved exact values through 9,007,199,254,740,993 → 9,007,199,254,740,998 → 9,007,199,254,740,993. Invalid input stayed invalid until corrected. Busy actions disabled the amount control.
- All 13 probability labels and accessible probability descriptions were absent by default, appeared with the developer switch, persisted through reload, and disappeared when switched off. Toggling preserved existing chip positions.
- The guide appeared for a fresh player, stayed dismissed after reload, and did not appear when a saved roll existed even after its local dismissal key was removed.
- Repeated additions placed multiple chips and preserved the exact aggregate wager. All 13 targets accepted wagers at 320px. Editor reduction/removal, right-click cancellation, Clear, and Shake removed the corresponding chips. Reduce motion skipped placement animations.
- The deterministic sole 10 G wager on 6 still returned 240 G and settled at 330 G. Settlement cleared the chips and wagers; free Shake kept the balance. No page errors occurred during the main interaction checks.
- Browser checks caught and fixed a dropped first bet after amount entry: amount changes now update the editor without replacing the board contents during the click.

Previews: [Desktop](screenshots/hidden-odds-desktop.png) · [Mobile](screenshots/hidden-odds-mobile.png) · [First-game guide](screenshots/first-game-guide.png).

Browser QA used the isolated in-memory fixture and did not touch the normal game database. Probability hiding is a presentation choice; the client API still receives the stored odds. Physical phones, Safari, Firefox, and screen-reader speech were not tested. Earlier entries describe superseded designs.

## Casino table and animation refinement — October 9, 2026

The current design uses Balatro-inspired placement: a left information rail, a stationary felt table, and wager/roll controls below it. Bets are coin stacks with a landing animation. The die has six physical faces and a 1.1-second toss with a bounce, shadow, and landing ring. Winning targets glow and show rising returns; coins and sparks accompany the bankroll count-up. Jackpot celebrations use more coins and sparks. The server still settles all results before animation begins.

Verified in this pass:

- `npm test`: all 34 tests passed. `npm run build` and `git diff --check` passed.
- Chrome inspected at its normal desktop size and at 1280×800, 768×800, 390×844, and 320×740. Mobile uses vertical scrolling; 320px and 390px checks showed no horizontal overflow after fixes.
- At 320px, all 13 targets held 1 G wagers with visible odds and coin labels. The board retained its exact document position, width, and height before and after those additions.
- The bet editor opens over the game. Reduction, removal, right-click cancellation, denomination selection, and exact-amount entry worked. The amount, Roll, and Shake controls remain outside the fixed betting grid.
- A motion-enabled sole 10 G wager on 6 returned 240 G, settled at 330 G, and refreshed the Jackpot marker to 5. The final desktop board remained at document top 149px, width 896px, and height 342px before and after the Jackpot. During the celebration the DOM contained nine flying coins and sixteen sparks.
- Captured the die during its tumble. An ordinary 10 G column win showed a +30 G floating return, four flying coins, seven sparks, and the animated balance. Overlapping number/column/color bets returned 110 G from a 30 G stake. A separate net-loss hit reported 5 G return and −5 G net accurately.
- Keyboard Enter on Roll, a complete miss, bankruptcy, restart, free Shake, mobile Settings, and the leaderboard worked. Restart restored 100 G and kept the 495 G record; Shake cleared wagers and kept Gold.
- The separate large-balance fixture wagered exactly 9,007,199,254,740,993 G and returned exactly 54,043,195,528,445,958 G. The mobile board stayed at document top 400px, width 325px, and height 344px through settlement. Compact coin text retains the exact amount in its tooltip, accessible target name, and editor.
- The existing Reduce motion preference skipped roll and celebration movement while still settling correctly. Motion was enabled for animation review, then the fixture preference was restored. A Chrome message-channel listener error appeared during development reloads; no application stack trace or game failure accompanied it.

Previews: [Desktop](screenshots/casino-desktop.jpg) · [Mobile](screenshots/casino-mobile.jpg) · [Jackpot animation frame](screenshots/casino-reward.jpg).

Browser tests used the isolated in-memory fixture, not the normal game database. Physical phones, Safari, Firefox, and subjective sound quality were not tested. Earlier entries below describe superseded designs.


Verified on October 9, 2026, using Node 26.4.0 and the available Chrome browser tools. The normal game is served at `http://localhost:5173`. Browser QA used both the Vite development client and the built production client.

## Minimal board and right-click cancellation — October 9, 2026

Replaced the decorative frame, gradients, gold chips, serif numerals, sidebar, slogans, and repeated labels with a flat green table and larger sans-serif text. Number text is 68–72px on desktop and 58px on mobile; number probabilities are 22px and 19px respectively. Group buttons show their covered numbers, return multiplier, probability, and any wager. Full rules remain in Settings.

Right-click clears the entire draft wager on the clicked target. The handler only intercepts context menus on betting targets, ignores empty targets, and respects the existing busy/pending action guards. Edit bets remains available for touch and keyboard users. The persistent result panel, board outcome ring, legend, and restored last-roll presentation are removed. The current roll still updates the die and Gold, and announces the outcome to assistive technology.

Verified for this pass:

- `npm test`: 34 passing existing tests. Production build and `git diff --check` passed.
- Browser checks at 1280×800, 390×844, and 320×740. Larger text can require vertical scrolling.
- Added 20 G to Number 1 and 10 G to Red. Right-clicking Number 1 removed all 20 G while preserving Red, including with invalid text in the amount field.
- Added 1 G to all 13 targets, then right-clicked each target. Final draft was 0 G, available Gold was 100 G, and Roll was disabled. Right-clicking an empty target was a no-op.
- At 320px, all 13 selected targets had no horizontal text clipping or page overflow; odds stayed visible. Number and column wagers of `9,007,199,254,740,993 G` also wrapped without clipping, and right-click canceled the large number wager.
- Right-clicking Black restored eligibility for a sole Number 6 Jackpot. Keyboard Roll settled the Jackpot at 330 G; a subsequent ordinary hit settled at 380 G. No last-roll panel or outcome marker appeared.
- Mobile draft removal, the header leaderboard button, and Settings worked. No browser warnings or errors were reported in the inspected fixture session.

Current previews: [Desktop](screenshots/refined-desktop.jpg) · [Mobile](screenshots/refined-mobile.jpg).

The requested new reference image or URL was not present in the conversation; the visual direction follows the explicit request for less decoration, larger type, and fewer labels. Earlier entries below describe superseded presentations.

## Roulette-inspired design refinement — October 9, 2026

The board now uses green felt, a connected ivory grid, larger centered numbers, stronger red/black contrast, and gold wager markers. Group odds remain visible after selection. A ring identifies the last rolled number; a star and ×24 identify the Jackpot target. On narrow screens, Roll and the amount selector share a row, with Shake below.

Checks for this refinement:

- `npm test`: all 34 existing tests passed. `npm run build` and `git diff --check` passed.
- Chrome layouts inspected at 1280×800, 768×800, 390×844, and 320×740. The normal large desktop viewport was also visually inspected. Mobile pages use vertical scrolling.
- At 320px, all 13 targets accepted 1 G wagers, all seven group probabilities remained visible, and the inspected target labels had no horizontal clipping. No document horizontal overflow was observed.
- Draft reduction and clearing, overlapping number/column/color wagers, mobile Settings and Leaderboard dialogs, keyboard Enter on Roll, Jackpot eligibility, a 240 G Jackpot return, automatic Shake, and free Shake were exercised in the isolated fixture. Reduced motion remained respected.
- The large-balance fixture exposed a collision in the compact desktop header. Balances and records above 12 digits now use separate rows; the 768px layout was rechecked for overlap. At 390px, number and column wagers of `9,007,199,254,740,993 G` wrapped without clipping, with group odds still visible. The ordinary ×6 result displayed exactly `54,043,195,528,445,958 G`.
- Sampled foreground/background contrast ratios: number text on red 6.11:1; on black 15.73:1; group coverage 7.99:1; selected group coverage 5.82:1; legend against the lightest felt base 5.00:1. These are specific color-pair checks, not a full accessibility audit.
- No warnings or errors appeared in the inspected fixture's browser runtime logs before the fixture restart.

Updated previews: [Desktop](screenshots/roulette-desktop.jpg) · [Mobile](screenshots/roulette-mobile.jpg). Both show overlapping wagers after a deterministic Jackpot. Game rules and server behavior were unchanged.

The earlier verification below records the original implementation; its screenshots and viewport-fit claims describe that earlier design.

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

Reload the fixture page, wager the displayed `9007199254740993` G on 1, and Roll. The result is `54043195528445958` G. Test fixture scores do not enter the normal leaderboard. Both fixture processes were stopped after verification.

## Screenshots

- [Desktop with overlapping draft wagers](screenshots/desktop.jpg)
- [Mobile with column coverage highlighted](screenshots/mobile.jpg)
- [Shared leaderboard](screenshots/leaderboard.jpg)
- [Jackpot result and fresh board](screenshots/jackpot-desktop.jpg) — captured during fixture QA, before minor final spacing refinements.

## Limits

The sketch attachment was not available; its listed arrangement was followed. Browser verification used desktop Chromium with viewport resizing, not a physical touch device. Safari, Firefox, screen-reader speech, and OS-level reduced-motion emulation were not tested; reduced motion was exercised through the game's own setting. Sound controls and procedural audio calls worked without errors; subjective audio quality was not measured. Network-loss replay and stale-request behavior were exercised in automated HTTP tests rather than by disconnecting a live browser mid-Roll.
