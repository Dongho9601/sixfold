# Sixfold — Current Implementation Specification

**Version:** 0.8

**Updated:** October 10, 2026

**Platform:** Web browser

**Status:** Client-side static build prepared for local review. GitHub Pages publication is a later task. The values below describe the current build; balance can be tuned after playtesting.

## 1. Purpose and play loop

Sixfold is a 100-roll game of wagering play Gold on a weighted six-sided die. Each run starts with 100 G; the balance after exactly 100 rolls is its score. A personal leaderboard stores this browser’s best 10 eligible completed runs. There is no wall-clock time limit or limit on new runs. An early bankruptcy ends the run without posting a score.

Each board has hidden, unequal probabilities. Players choose a wager amount, place one or more bets, and Roll. A paying ordinary outcome changes the odds; a complete miss preserves them. The visible **Tilt 1–6** describes how concentrated the probabilities are without identifying a favored number. Players can observe results, adjust their bets, or use an unlocked **Shake** to replace the board.

The intended tension comes from an opportunity that lasts long enough to explore but changes as it pays. Stronger concentration produces faster probability transfers. Neither high Tilt nor a short run of repeated outcomes proves that a particular wager is favorable. A hidden Jackpot offers a larger return for an exclusive wager on the least likely face on every board, regardless of its probability.

This file is the current specification, not the earlier design proposal. Rule constants and coverage are defined in [`src/config.ts`](../src/config.ts); settlement is in [`src/game/rules.ts`](../src/game/rules.ts). The probability model and pacing experiment are explained in [`PROBABILITY_MODEL.md`](PROBABILITY_MODEL.md).

## 2. Board, targets, and payouts

The fixed board has two rows and three columns:

| | 1st 2 | 2nd 2 | 3rd 2 |
|---|---|---|---|
| Odds | 1 — Red | 3 — Black | 5 — Red |
| Evens | 2 — Black | 4 — Red | 6 — Black |

Shake changes probabilities, never positions or colors. All group coverage derives from this mapping.

| Target | ID | Covered outcomes | Total return |
|---|---|---|---:|
| Single number | `n1` … `n6` | That number | ×6 |
| Odds | `row0` | 1, 3, 5 | ×2 |
| Evens | `row1` | 2, 4, 6 | ×2 |
| 1st 2 | `col0` | 1, 2 | ×3 |
| 2nd 2 | `col1` | 3, 4 | ×3 |
| 3rd 2 | `col2` | 5, 6 | ×3 |
| Red | `red` | 1, 4, 5 | ×2 |
| Black | `black` | 2, 3, 6 | ×2 |
| Exclusive Jackpot hit | The current least likely number | See Section 6 | ×24 |

All multipliers include the winning stake. A sole ordinary 10 G number hit returns 60 G, a net gain of 50 G. Overlapping bets are allowed and each matching target pays. Repeated additions to one target combine into one wager.

## 3. Gold and player actions

### 3.1 Bet

Each new run starts with **100 G and zero of 100 rolls used**. Gold and wagers are exact whole numbers, with a minimum positive wager of **1 G** and no gameplay cap. The total draft cannot exceed the settled bankroll. Zero wagers are inactive; borrowing and negative balances are disallowed.

The amount control starts at **10 G**. Players may type any valid whole amount. The + / − buttons and ↑ / ↓ while the amount control is focused adjust it by 5 G, with a floor of 1 G. Clicking a target adds the selected amount. Clicking or tapping a placed chip also adds the selected amount. Holding a target or its chip for 500 ms with a mouse or touch, or right-clicking it, removes the target's entire draft wager; Delete/Backspace removes the focused target's wager. Three chip shortcuts immediately beside the amount recall the last three distinct successfully placed amounts, most recent first. Selecting a shortcut changes the amount without placing a bet or reordering the history. Invalid or unaffordable attempts do not enter history. History persists in browser local storage across refreshes and new runs; unfilled slots remain disabled. Movement beyond 10 px, leaving the target, pointer cancellation, loss of window focus, or a hidden tab cancels the hold gesture. Its release click is suppressed so a removed wager cannot immediately be added back. The two old betting instruction hints are removed. To reduce a bet, remove it and add the smaller amount. Edit bets, Clear, and the draft editor are removed.

Draft edits spend no Gold. The left rail contains three cards: settled Bankroll, highlighted Rolls remaining, and On the table. Available Gold is enforced by validation without a separate readout. Each target shows its coverage, total-return multiplier where applicable, and placed amount. Number payouts are also stated in the board key and table footer. Hovered, focused, and wagered groups highlight their covered numbers.

### 3.2 Roll

Roll requires an unfinished run and at least one positive wager within the bankroll. Every successfully settled roll increments the saved count once, including break-even rolls; invalid actions and blocked repeated inputs do not. Roll 100 posts the final score and disables further Roll and Shake actions. The browser validates the draft, samples exactly one outcome using the current probabilities, and resolves every wager against it. It saves settled state before animating the result. A die animation cannot select or modify an outcome.

Inputs that change the game are disabled while an action is pending or being presented. An action's expected revision prevents another tab from silently changing its committed board. The draft clears after successful settlement.

### 3.3 Shake

Shake costs **0 G**, but each fresh board begins locked. Any settled roll with a **nonzero net gain or loss** unlocks one Shake, including a 1 G change. A paying break-even roll changes probabilities but does not unlock Shake. Draft edits, nickname changes, and refreshes do not qualify.

Once earned, the entitlement stays available until a reset. A later break-even roll does not revoke it, and gains followed by losses still qualify even if the bankroll returns to its earlier amount. Entitlements do not accumulate.

An available Shake samples fresh probabilities, clears draft bets, retains Gold and personal best, and locks again. There is no fee or additional gameplay cooldown. Shake neither consumes nor restores rolls, and is unavailable after the run ends. A Jackpot's automatic reset and a bankruptcy restart also begin locked. The browser transition validates and saves this eligibility; a disabled button is its presentation.

### 3.4 Restart

At zero Gold or after roll 100, a results dialog replaces the separate New run button. Completed runs show final Gold, the personal best, and a first-record, improvement, tie, or below-best comparison. Early bankruptcy explicitly posts no score. The dialog includes a prefilled personal-record name and **Confirm & play again**. Confirmation validates/saves the name and restarts in one revision-guarded local transition; invalid names leave the ended run intact. The restarted run is saved before its transition animation. Escape and the backdrop do not dismiss the results; confirmation closes it and returns focus to the amount control after the transition. The dialog reopens for an ended run after refresh. Starting again restores 100 G, resets the roll count to zero, samples a fresh board, clears the last roll, resets the selected wager to 10 G, and locks Shake. It creates a new run identity while preserving personal records and settings; a plain Settings restart also preserves the nickname. The red **Restart run** button in Settings is available during active or ended runs. It opens a confirmation explaining the loss of current progress and bets, the new 100 G / 100 rolls, and the retained personal records and settings. Cancel, Escape, or clicking the backdrop returns to Settings without changing state; Cancel receives initial focus. Confirm closes both dialogs and restarts. Restart is disabled while an action is pending. Abandoning an unfinished run never submits its balance as a score. The client presents a fresh-die replacement, bankroll count to 100 G, and staggered card fade/slide before releasing the controls; reduced motion skips this roughly 800 ms transition. An early bankruptcy submits no score; bankruptcy on roll 100 submits a valid zero score.

## 4. Fresh probabilities and Tilt

### 4.1 Fresh boards

A new game, manual Shake, or Jackpot reset draws a symmetric Dirichlet(1,1,1,1,1,1) vector and reserves a 2% floor for every face:

```text
x[i] = -ln(1 - u[i])                 six independent uniform draws
w[i] = x[i] / sum(x)
p[i] = 0.02 + 0.88 × w[i]
```

All six probabilities vary. There is no fixed template or favored face. Each fresh probability is at least 2% and can approach 90%; their sum is 1, subject to floating-point roundoff. The generator clamps only RNG endpoints to avoid degenerate exponential weights. The browser uses Web Crypto to draw on the same uniform 48-bit grid as the former server generator.

Old local databases and backups are preserved outside version control and are not read or imported by this build. Browser saves persist across refreshes and reopening. The transfer function defensively supports probabilities below the floor by preventing those faces from donating probability.

### 4.2 Hidden odds and visible Tilt

Number probabilities, group probabilities, and the Jackpot target are hidden in ordinary play. Jackpot is available on every board; no availability message appears beneath the table. Settings has a standard **Show probabilities** switch, off at the start of every run, which reveals number and group percentages after confirmation. The confirmation explains that enabling it excludes the current run’s score from the leaderboard permanently for that run, even if the player turns it off later. Cancel, Escape, or the backdrop keeps it off without changing state, with initial focus on Cancel. Confirm saves the setting and exclusion in one revision-guarded local action before displaying odds. The switch is disabled during pending actions and after the run ends. Visibility and exclusion survive reloads, updates from other tabs, and reopening the browser; a new run resets visibility to false and eligibility to true. Shake and Jackpot preserve both flags. Existing completed records remain eligible, and an excluded final score cannot update the saved best. Turning visibility on or off preserves draft bets, Gold, roll count, last roll, and board odds. The setting does not reveal a Jackpot marker or change payouts. A visible status explains exclusion during play and in the results dialog. Hidden percentages are also omitted from target accessible names and tooltips.

All game state and rules are available through browser inspection. Hiding probabilities is a gameplay presentation choice; this personal game has no anti-cheat system.

Tilt is computed from the current unrounded probabilities. Normalize by their stored sum for the calculation, then compute Shannon entropy and its effective number of outcomes:

```text
H = -sum(p[i] × ln(p[i]))
N = exp(H)
```

| Effective outcomes N | Tilt |
|---|---:|
| N ≥ 5.4 | 1 |
| 4.8 ≤ N < 5.4 | 2 |
| 4.5 ≤ N < 4.8 | 3 |
| 4.2 ≤ N < 4.5 | 4 |
| 3.6 ≤ N < 4.2 | 5 |
| N < 3.6 | 6 |

Higher Tilt means concentration on fewer faces. Relabeling faces does not change it. Tilt does not identify those faces, group odds, Jackpot odds, or expected profit. A paying update may change the hidden odds without crossing a level boundary; Tilt can rise, fall, or stay the same.

A prominent gold Tilt control opens How to Play at its Tilt explanation and regains focus when closed. Low levels receive gentler transfers to preserve continuity after the board becomes more even. The old middle band is split at N = 4.5; old levels 4 and 5 become 5 and 6 without changing their boundaries. The fresh-board generator is unchanged.

## 5. Ordinary probability transfers

### 5.1 Trigger and order

After any non-Jackpot roll with at least one paying wager, apply exactly one probability transfer. This includes net-loss and break-even results. Wager size, payout size, and overlapping wins do not affect that transfer. If every wager misses, leave the odds unchanged.

Use the board and Tilt **before** the roll to choose a transfer rate. A new Tilt level affects the next roll, not the one just resolved.

### 5.2 Current transfer rates

Draw a uniform random rate `a` from the applicable range:

| Pre-roll Tilt | Transfer range | Mean |
|---|---:|---:|
| 1 | 4–8% | 6% |
| 2 | 4.2–8.4% | 6.3% |
| 3 | 4.4–8.8% | 6.6% |
| 4 | 4.6–9.2% | 6.9% |
| 5 | 4.8–9.6% | 7.2% |
| 6 | 5–10% | 7.5% |

Draw an independent Dirichlet(1,1,1,1,1) vector `q` for the receiving shares. For rolled face `i`:

```text
delta = a × max(0, p[i] - 0.02)
pNext[i] = p[i] - delta
pNext[j] = p[j] + delta × q[j]       for each j ≠ i
```

The rate applies to the rolled face's probability above the floor, not to the whole board and not as a percentage-point subtraction. The other five receive random shares, with an expected share of one fifth each. Ordinary settlement uses one outcome draw, one rate draw, and five recipient draws. Misses use only the outcome draw; a Jackpot instead uses six fresh-board draws after its outcome.

The transfer preserves total probability and the floor on current-model boards. It does not force every face toward 1/6. A rare paying face becomes rarer, and an exactly even board also changes after a payout.

### 5.3 Arithmetic example

For `[40, 20, 15, 10, 10, 5]%` (Tilt 2), an ordinary payout on face 1 at the mean 6.3% rate transfers `0.063 × (0.40 − 0.02) = 0.02394`, or 2.394 percentage points. Equal recipient shares, which can be injected for a deterministic test, give:

| State | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| Before | 40% | 20% | 15% | 10% | 10% | 5% |
| After paying face 1 | 37.606% | 20.4788% | 15.4788% | 10.4788% | 10.4788% | 5.4788% |
| After another paying face 1 at the same rate/shares | 35.362822% | 20.9274356% | 15.9274356% | 10.9274356% | 10.9274356% | 5.9274356% |

Actual play draws a new rate and recipient shares each time. This example fixes randomness to demonstrate arithmetic.

### 5.4 Pacing rationale

The six-level curve narrows the difference in mean transfer speed from 7.2–21.6% on the former five-level scale to 6–7.5%. The former highest level becomes Tilt 6 and its mean transfer rate falls from 21.6% to 7.5%; old Tilt 4 becomes Tilt 5 and falls from 18% to 7.2%. This extends the chance to use concentrated boards while continuing to update odds after every ordinary paying roll.

The offline comparison uses 10,000 identical seeded fresh starts per profile/policy, 80 rolls, and no Shake. A “chance” is one roll up to and including the first roll that changes the starting Tilt. Repeated bets on the initially strongest face yield median windows of three rolls at Tilt 5 and two at Tilt 6. Rotating group bets yield four rolls at each; full coverage yields two. The strongest-face policy intentionally uses hidden information to stress-test concentrated-board pacing. These are medians, not minimum stays: near-boundary boards can change on the first payout.

Among starts above Tilt 1, rotating group bets reach Tilt 1 after a median 37 rolls, compared with 20 previously. The initially strongest face stays at or above 30% for a median 35 group rolls, up from 18, among qualifying starts. This is an internal diagnostic, not a displayed probability or a promise about human play. Run `npm run test:balance` for all policy-specific results.

## 6. Jackpot

The Jackpot target is the face with the lowest current internal probability; the lowest numerical label breaks exact ties. It is recomputed after transfers and resets but remains fixed throughout a roll's settlement.

A roll qualifies when its sole positive wager is on that target’s single number. Every board supports Jackpot, regardless of the target’s probability. The target is determined before the outcome is sampled. Several additions on the same target remain one wager. Any other positive wager removes eligibility, even if it overlaps the target. Zero entries are ignored.

A qualifying hit pays **×24 total return**, replacing ×6, and immediately commits a fresh random board. Earned Gold and records remain; Shake is locked on the new board. The client shows the Jackpot reward before presenting the die replacement. A sole 10 G Jackpot from 100 G ends at `100 − 10 + 240 = 330 G`.

A missed exclusive attempt loses the stake and preserves probabilities. A noneligible roll on the least likely face pays ordinary covered targets and applies the normal transfer if anything pays. The target has no normal-play marker and availability is not displayed.

## 7. Settlement, precision, and persistence

For settled bankroll `B`, total committed stakes `S`, and total return `P`:

```text
BNext = B - S + P
NetChange = P - S
RollsUsed = previous RollsUsed + 1
On eligible roll 100 only: BestGold = max(previous completed BestGold, BNext)
Before the first completed run: no leaderboard entry
```

The pure browser transition checks the expected run identity and revision, validates wagers, snapshots probabilities and the Jackpot target, samples one outcome, settles every payout, and updates probabilities, roll count, and Shake eligibility. The save layer adds an eligible completed record on roll 100 and persists the complete save before returning to animation. A persisted `recorded` flag prevents another completion entry after reload, even if the run is below the top-ten cutoff.

Gold, wagers, returns, scores, and revisions use **BigInt** internally and canonical decimal **strings** in JSON and localStorage. Probabilities remain unrounded doubles. The sampler multiplies a uniform draw by the stored probability sum to absorb rounding drift; it does not smooth the board. Display rounding never feeds settlement. Compact chips and records retain exact values in tooltips and accessible labels.

The version-1 save under `sixfold:save:v1` contains the current run, settings, and top ten personal records. A single JSON write stores a settled result and its completion receipt together. Restart creates a fresh run identity and resets bankroll, odds, roll count, last roll, probability visibility, eligibility, and Shake; it retains records and settings. Unsupported or malformed saves recover to a fresh run and preserve the first unreadable value under `sixfold:save:recovery` when possible. Browser storage failures leave in-memory play available with a save warning. Old server databases and backups remain local and untouched.

Uncommitted drafts belong to the current tab and clear on reload, settlement, Shake, restart, or a changed board from another tab. Input locks cover the full action presentation. Modern browsers use Web Locks to serialize normal save writes; the transition checks the latest saved run revision under the lock, so a stale draft cannot settle into a restarted run. Storage events and focus/visibility recovery update the view without polling. Settings writes are coalesced. Page navigation journals staged preferences under `sixfold:settings:pending:v1`, and reopening merges them into the main save under the normal write lock without overwriting a newer run. Browsers without Web Locks retain revision checks before synchronous writes. Hidden tabs stop audio and decorative motion and finish presentation of the settled outcome.

## 8. Personal leaderboard and names

The leaderboard keeps the best **10 completed runs in this browser**, scored by the final Gold after exactly 100 rolls. Enabling Show probabilities permanently excludes that run, even when hidden again. An early bankruptcy and intermediate peaks never enter the records. A completed score of zero is valid. Lower scores and restarts preserve a previous best. The results compare the saved best before completion with the new score.

Records sort by exact Gold descending, completion order ascending, then run ID ascending as a deterministic fallback. Completion order uses an exact monotonic revision, independent of wall-clock changes. The run receipt prevents repeat recording even after that run drops out of the top ten. The current completed run is highlighted if present; rank one is labeled Personal best. Empty records prompt the player to finish 100 rolls. The existing tower and mobile drawer display the same list, with a browser-storage note. Large values use compact visible scores while retaining exact labels.

Nicknames are trimmed and normalized to NFC, contain 1–24 visible Unicode code points, and reject control/format characters. Names need not be unique and are stored locally. Naming a finished run through Confirm & play again updates that run’s retained record and the next run’s name. Other historical run names remain unchanged. There is no identity service, moderation service, account, recovery service, or shared ranking.

## 9. Interface and input

### 9.1 Layout and feedback

Wide screens show three left-side cards: Bankroll, Rolls remaining, and On the table. Rolls remaining is emphasized with a large gold number and counts down from 100 to zero. The felt table sits in the center, with a compact rank/name/score leaderboard on the right. No best-score card, Available readout, ranking progress meter, or repeated leaderboard copy is shown. Smaller screens provide the leaderboard through a trophy button and right-side drawer. All 13 targets remain visible on narrow screens. No Jackpot availability message appears. On the table contains only its label and wager total. On phone screens, all three stat cards share one compact row. The board height adapts to the viewport, with smaller cards, spacing, and targets on short screens. Short landscape screens place the table beside the stats and wager controls. The core game and footer fit a 320 × 568 portrait viewport and a 568 × 320 landscape viewport; save warnings can require additional scrolling. Completion disables wagers/Roll/Shake and opens the results popup described in Section 3.4; the same state survives reload. All three cards share the same padding, label-over-value layout, spacing, and numeral size and weight. Rolls remaining retains its highlighted background. Gold values use a smaller G aligned to the numeral baseline. Value rows have a fixed height; full exact Bankroll and On the table numerals scale down to fit the available width, including during count animation and viewport resizing, so six-figure and larger amounts cannot wrap or grow the cards.

Draft wagers appear as tossed chip piles, with up to five visible chips per target and the top chip displaying the total. Grid tracks remain fixed as bets change. A six-faced CSS die tumbles for Roll; Shake slides the old die out and a fresh one in. Ordinary roll timing is 1,100 ms and die replacement is 800 ms, with additional result presentation. These timings do not alter committed rules or add a cooldown after completion.

Hovered targets use brighter fills and a gold inset outline; covered numbers use a stronger outline and light wash. The “Play Gold only” labels are removed. Paying targets glow and show returns. Net-positive results receive a gain banner, coin flights, particles, and fanfares. Break-even and net-loss returns retain accurate net labels without a victory banner. Jackpot uses a larger celebration followed by the die replacement. A live region announces results and action errors.

### 9.2 Keyboard

- Tab navigates controls; Enter activates buttons. During play, Space is reserved for Shake and does not also activate a focused target or scroll the page.
- **R** rolls a valid draft and **Space** uses an available Shake, including when a betting target or another game button has focus.
- **1 / 2 / 3** recall the three most recent distinct successfully placed amounts, newest first, without placing a wager. Empty history slots do nothing. **W / E** decrease / increase the selected amount by 5 G, with a floor of 1 G. **Q / Escape** clear all unrolled wagers without changing Gold, roll count, or recent history.
- Uppercase letter shortcuts work. Ctrl, Command, and Alt combinations, held-key repeats, IME composition, and already-consumed events do not trigger actions.
- Shortcuts are inactive while an input, textarea, select, or editable text region is being edited, and while any dialog is open.
- Disabled actions and pending settlements cannot be activated through shortcuts.
- ↑ / ↓ in the amount control adjust by 5 G. Escape closes the guide, Settings, leaderboard, and restart confirmation; the results dialog requires confirmation. Delete / Backspace removes the focused target’s wager; text fields and open dialogs keep their normal keyboard behavior.

### 9.3 Settings and How to Play

Settings contains the nickname form, **Sound effects**, **Reduce motion**, and **Show probabilities** controls, plus Restart run. How to Play is available from the separate sidebar control and Tilt; Settings has no guide link. Rule descriptions and explanations of these preferences live in **How to Play**.

The guide leads with two playing steps, payout multipliers, Tilt, Shake, Jackpot, and a keyboard reference. An expandable section covers wager editing, probability transfers and a numerical example, persistence, final-score submission, new runs, and preference descriptions. English, Korean, Japanese, Simplified Chinese, Spanish, French, and German versions share the same structure. A native language selector starts with the first supported browser language (falling back to English) and remembers an explicit choice across reloads; the dialog language and accessible controls update with it. It uses a white reading surface, dark 18 px serif body text, simple headings, and a sticky close control. The Tilt control opens it at the appropriate section; closing restores focus to its trigger.

The guide opens automatically for a player with no previous roll who has not dismissed it. Dismissal is saved with this browser’s settings and survives refreshes and restarts. How to Play can reopen it at any time.

Sound defaults to on after a user interaction; a saved mute stays muted, and disabling sound stops scheduled notes. Reduced motion follows the system preference or the manual switch and skips movement and particle effects. Sound and manual motion preferences save in browser local storage. Probability visibility and run eligibility save locally with the current run. New runs start with probabilities hidden.

## 10. Static runtime and development

The game uses browser TypeScript/JavaScript, HTML/CSS/SVG, Web Crypto, localStorage, and procedural Web Audio. Node.js 22.16 or later, Vite, TypeScript, tsx, and Playwright are development/test tools only. `npm run dev` starts Vite; `npm run build` type-checks and produces static `dist/`; `npm run preview` previews that output. Vite’s base is `/sixfold/` for the `Dongho9601/sixfold` GitHub Pages project site. The game and `about.html` are real static pages with working project-relative navigation and favicon URLs. No server-side routing or rewrites are required.

There is no gameplay API, session cookie, database, polling, network retry, rate limiter, or administrative service. Gameplay makes no backend requests. Settings, rules, and record data remain in this browser. The build bundles no third-party runtime artwork, fonts, or audio. [README.md](../README.md) documents later Pages setup; deployment and repository visibility remain unchanged in this pass.

## 11. Acceptance examples and checks

Unless otherwise stated, examples start with 100 G and `[40, 20, 15, 10, 10, 5]%`, with face 6 least likely and eligible for a sole-number Jackpot bet.

1. **Ordinary hit:** 10 G on 1, outcome 1 → 150 G, one transfer, Shake unlocked.
2. **Complete miss:** 10 G on 1, outcome 2 → 90 G, identical probabilities, Shake unlocked.
3. **Break-even:** 10 G on every number, any outcome → 100 G and one transfer, no Jackpot. A locked Shake stays locked; an already-earned Shake remains available.
4. **Net-loss payout:** 1 G on 1 and 20 G on 2, outcome 1 → 85 G, one transfer and Shake unlocked.
5. **Overlap:** 10 G each on 1, Odds, and Red, outcome 1 → 100 G return, 170 G bankroll, exactly one transfer.
6. **Amount independence:** Identical boards and random draws with different positive ordinary stakes produce identical next probabilities.
7. **Rare ordinary hit:** Full-coverage bets, outcome 6, rate 6.3%, equal recipient shares → face 6 falls from 5% to 4.811%; each other face gains 0.0378 percentage points. No Jackpot applies.
8. **Jackpot:** On `[40, 20, 15, 12, 10, 3]%`, sole 10 G on 6, outcome 6 → 330 G, fresh board, Shake locked. Any additional positive target removes eligibility. On the default 5% board, the same hit also pays 330 G and draws a fresh board. On an exactly even board, number 1 is the Jackpot target.
9. **Earned Shake:** A nonzero settlement unlocks Shake; using it preserves Gold and best, resets odds, clears the draft, and locks it again. A second immediate Shake is rejected.
10. **Restart:** Zero Gold or 100 rolls permits a new 100 G run with zero rolls used and fresh odds; a completed best remains.
11. **Precision and duplicate protection:** Huge integer balances survive storage and ranking; repeated inputs during animation cannot sample or pay twice; stale-tab actions cannot settle.
12. **Keyboard regression:** Click or keyboard-activate a target, then press R without moving focus → exactly one Roll. Space works from the same kind of focus after unlocking. Text editing, dialogs, and modifier combinations cannot trigger gameplay.
13. **Final score:** An early 330 G peak stays unranked. Finishing roll 100 with 280 G posts 280 G. Roll 101 and Shake are rejected, including via shortcuts. Reload retains completion and its personal-best comparison; confirming the results saves the chosen name and restores 100 G and zero rolls used while keeping the 280 G record.
14. **Guide location:** Settings contains controls; How to Play contains the complete explanations, including current transfer rates. The guide and expanded example fit desktop and mobile, and Tilt navigation retains a reachable close control.

`npm test` covers rules, pacing, exact arithmetic, run transitions, save validation, duplicate completion protection, storage failure, and stale revisions. `npm run test:ui` runs isolated Chromium browser regressions; `npm run test:balance` runs the pacing comparison. Browser setup and exact verification results are documented in [`README.md`](../README.md) and [`VERIFICATION.md`](VERIFICATION.md). Tests use synthetic storage and isolated browser contexts, never normal player data.

## 12. Prototype boundary

The implemented loop is the fixed six-number board, hidden weighted outcomes with visible Tilt, probability transfers, earned free Shake, always-available exclusive Jackpot, persistent 100-roll runs, and a leaderboard of completed scores. Progression trees, items, missions, extra board sizes, and additional modes are outside the current build.

Sixfold is a free hobby game. Accounts, shared leaderboards, cloud synchronization, anti-cheat, advertisements, payments, save export/import, and additional game features are outside this migration. The [About page](../public/about.html) explains browser saves and credits. Browser verification uses Chromium and mobile emulation; physical phones, Safari, and Firefox are not claimed. Probability tuning retains repeatable simulation and regression checks, with enjoyment and broader strategic balance subject to playtesting. No open-source license has been added; licensing remains a separate owner choice.
