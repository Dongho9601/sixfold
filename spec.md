# Sixfold — Current Implementation Specification

**Version:** 0.3

**Updated:** October 10, 2026

**Platform:** Web browser

**Status:** Implemented local prototype. The values below describe the current build; balance can be tuned after playtesting.

## 1. Purpose and play loop

Sixfold is an endless game of wagering play Gold on a weighted six-sided die. Players build a bankroll and compete on a shared leaderboard ranked by personal best. There is no turn budget, time limit, mandatory cash-out, or completion target.

Each board has hidden, unequal probabilities. Players choose a wager amount, place one or more bets, and Roll. A paying ordinary outcome changes the odds; a complete miss preserves them. The visible **Tilt 1–5** describes how concentrated the probabilities are without identifying a favored number. Players can observe results, adjust their bets, or use an unlocked **Shake** to replace the board.

The intended tension comes from an opportunity that lasts long enough to explore but changes as it pays. Stronger concentration produces faster probability transfers. Neither high Tilt nor a short run of repeated outcomes proves that a particular wager is favorable. A hidden Jackpot offers a larger return for an exclusive wager on the least likely face.

This file is the current specification, not the earlier design proposal. Rule constants and coverage are defined in [`src/config.ts`](src/config.ts); settlement is in [`server/rules.ts`](server/rules.ts). The probability model and pacing experiment are explained in [`docs/PROBABILITY_MODEL.md`](docs/PROBABILITY_MODEL.md).

## 2. Board, targets, and payouts

The fixed board has two rows and three columns:

| | Left | Middle | Right |
|---|---|---|---|
| Top | 1 — Red | 3 — Black | 5 — Red |
| Bottom | 2 — Black | 4 — Red | 6 — Black |

Shake changes probabilities, never positions or colors. All group coverage derives from this mapping.

| Target | ID | Covered outcomes | Total return |
|---|---|---|---:|
| Single number | `n1` … `n6` | That number | ×6 |
| Top row | `row0` | 1, 3, 5 | ×2 |
| Bottom row | `row1` | 2, 4, 6 | ×2 |
| Left column | `col0` | 1, 2 | ×3 |
| Middle column | `col1` | 3, 4 | ×3 |
| Right column | `col2` | 5, 6 | ×3 |
| Red | `red` | 1, 4, 5 | ×2 |
| Black | `black` | 2, 3, 6 | ×2 |
| Exclusive Jackpot hit | The current least likely number | See Section 6 | ×24 |

All multipliers include the winning stake. A sole ordinary 10 G number hit returns 60 G, a net gain of 50 G. Overlapping bets are allowed and each matching target pays. Repeated additions to one target combine into one wager.

## 3. Gold and player actions

### 3.1 Bet

A new player starts with **100 G**. Gold and wagers are exact whole numbers, with a minimum positive wager of **1 G** and no gameplay cap. The total draft cannot exceed the settled bankroll. Zero wagers are inactive; borrowing and negative balances are disallowed.

The amount control starts at **10 G**. Players may type any valid whole amount. The + / − buttons and ↑ / ↓ while the amount control is focused adjust it by 5 G, with a floor of 1 G. Clicking a target adds the selected amount. Right-click removes that target's entire draft wager. **Edit bets** exposes reduction and removal controls for touch and keyboard users; reduction uses the selected amount. **Clear** removes the entire draft.

Draft edits spend no Gold. The interface separately shows settled Bankroll, On the table, and Available after the draft. Each target shows its coverage, total-return multiplier where applicable, and placed amount. Number payouts are also stated in the board key and table footer. Hovered, focused, and wagered groups highlight their covered numbers.

### 3.2 Roll

Roll requires at least one positive wager within the bankroll. The server validates the draft, samples exactly one outcome using the current probabilities, and resolves every wager against it. The server commits settlement before the client animates the result. A die animation cannot select or modify an outcome.

Inputs that change the game are disabled while an action is pending or being presented. An action's expected revision prevents another tab from silently changing its committed board. The draft clears after successful settlement.

### 3.3 Shake

Shake costs **0 G**, but each fresh board begins locked. Any settled roll with a **nonzero net gain or loss** unlocks one Shake, including a 1 G change. A paying break-even roll changes probabilities but does not unlock Shake. Draft edits, nickname changes, and refreshes do not qualify.

Once earned, the entitlement stays available until a reset. A later break-even roll does not revoke it, and gains followed by losses still qualify even if the bankroll returns to its earlier amount. Entitlements do not accumulate.

An available Shake samples fresh probabilities, clears draft bets, retains Gold and personal best, and locks again. There is no fee or additional gameplay cooldown. A Jackpot's automatic reset and a bankruptcy restart also begin locked. The server validates and persists this eligibility; a disabled button is its presentation.

### 3.4 Restart

At exactly zero Gold, **Start again** restores 100 G, samples a fresh board, clears the last roll, resets the selected wager to 10 G, and locks Shake. It preserves player identity, nickname, and historical personal best. Restart cannot add Gold to a positive bankroll.

## 4. Fresh probabilities and Tilt

### 4.1 Fresh boards

A new game, manual Shake, or Jackpot reset draws a symmetric Dirichlet(1,1,1,1,1,1) vector and reserves a 2% floor for every face:

```text
x[i] = -ln(1 - u[i])                 six independent uniform draws
w[i] = x[i] / sum(x)
p[i] = 0.02 + 0.88 × w[i]
```

All six probabilities vary. There is no fixed template or favored face. Each fresh probability is at least 2% and can approach 90%; their sum is 1, subject to floating-point roundoff. The generator clamps only RNG endpoints to avoid degenerate exponential weights. The playable server uses cryptographic randomness.

Existing saved boards are preserved when constants change. Older boards below the 2% floor are not replaced or clipped by migration. Their rare faces cannot donate probability until they have received enough to exceed the floor. Their next reset uses the current generator.

### 4.2 Hidden odds and visible Tilt

Number probabilities, group probabilities, the Jackpot target, and Jackpot eligibility are hidden in ordinary play. Settings has a **Show probabilities (developer)** switch, off by default, which reveals number and group percentages. It does not reveal a Jackpot marker or alter the rules. Hidden percentages are also omitted from target accessible names and tooltips.

This is presentation hiding: the state API still returns the probabilities and Jackpot number. It is not a secrecy boundary against browser inspection.

Tilt is computed from the current unrounded probabilities. Normalize by their stored sum for the calculation, then compute Shannon entropy and its effective number of outcomes:

```text
H = -sum(p[i] × ln(p[i]))
N = exp(H)
```

| Effective outcomes N | Tilt |
|---|---:|
| N ≥ 5.4 | 1 |
| 4.8 ≤ N < 5.4 | 2 |
| 4.2 ≤ N < 4.8 | 3 |
| 3.6 ≤ N < 4.2 | 4 |
| N < 3.6 | 5 |

Higher Tilt means concentration on fewer faces. Relabeling faces does not change it. Tilt does not identify those faces, group odds, Jackpot odds, or expected profit. A paying update may change the hidden odds without crossing a level boundary; Tilt can rise, fall, or stay the same.

A prominent gold Tilt control opens How to Play at its Tilt explanation and regains focus when closed. Low levels receive gentler transfers to preserve continuity after the board becomes more even. The thresholds and fresh-board generator are unchanged by the October 10 pacing adjustment.

## 5. Ordinary probability transfers

### 5.1 Trigger and order

After any non-Jackpot roll with at least one paying wager, apply exactly one probability transfer. This includes net-loss and break-even results. Wager size, payout size, and overlapping wins do not affect that transfer. If every wager misses, leave the odds unchanged.

Use the board and Tilt **before** the roll to choose a transfer rate. A new Tilt level affects the next roll, not the one just resolved.

### 5.2 Current transfer rates

Draw a uniform random rate `a` from the applicable range:

| Pre-roll Tilt | Transfer range | Mean |
|---|---:|---:|
| 1 | 6–12% | 9% |
| 2 | 9–18% | 13.5% |
| 3 | 12–24% | 18% |
| 4 | 15–30% | 22.5% |
| 5 | 18–36% | 27% |

Draw an independent Dirichlet(1,1,1,1,1) vector `q` for the receiving shares. For rolled face `i`:

```text
delta = a × max(0, p[i] - 0.02)
pNext[i] = p[i] - delta
pNext[j] = p[j] + delta × q[j]       for each j ≠ i
```

The rate applies to the rolled face's probability above the floor, not to the whole board and not as a percentage-point subtraction. The other five receive random shares, with an expected share of one fifth each. Ordinary settlement uses one outcome draw, one rate draw, and five recipient draws. Misses use only the outcome draw; a Jackpot instead uses six fresh-board draws after its outcome.

The transfer preserves total probability and the floor on current-model boards. It does not force every face toward 1/6. A rare paying face becomes rarer, and an exactly even board also changes after a payout.

### 5.3 Arithmetic example

For `[40, 20, 15, 10, 10, 5]%` (Tilt 2), an ordinary payout on face 1 at the mean 13.5% rate transfers `0.135 × (0.40 − 0.02) = 0.0513`, or 5.13 percentage points. Equal recipient shares, which can be injected for a deterministic test, give:

| State | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| Before | 40% | 20% | 15% | 10% | 10% | 5% |
| After paying face 1 | 34.87% | 21.026% | 16.026% | 11.026% | 11.026% | 6.026% |
| After another paying face 1 at the same rate/shares | 30.43255% | 21.91349% | 16.91349% | 11.91349% | 11.91349% | 6.91349% |

Actual play draws a new rate and recipient shares each time. This example fixes randomness to demonstrate arithmetic.

### 5.4 Pacing rationale

The current rates are 1.5× the immediately preceding tuning, or 3× the original 2–4%, 3–6%, 4–8%, 5–10%, and 6–12% baseline. This implements the request for a shorter path to low Tilt. An offline experiment compares 1×, 1.5×, 2×, 3×, and 4× the original baseline on 10,000 identical seeded starting boards per policy, excluding boards already at Tilt 1, over 80 rolls without Shake.

For 1 G group bets cycling through all seven groups every three rolls, the current profile reaches the first visible Tilt change in a median of five rolls and Tilt 1 in 16 rolls, compared with six and 23 under the preceding tuning. Within 20 rolls, 69.0% of boards reach Tilt 1, up from 40.5%. With full coverage, the median falls from 11 to seven rolls.

The initially strongest face stays at or above 30% for a median of 13 group rolls, compared with 21 previously, among starts at or above that threshold. This gives a shorter opportunity to observe and act before the board changes. The 30% threshold is an experimental proxy, not an in-game promise or disclosed chance. A 1.5× rate increase does not guarantee exactly 1.5× faster Tilt arrival: outcomes, misses, random redistribution, and level boundaries also affect it. Reproduce the comparison with `npm run test:balance`; the model document records the full results and limitations.

## 6. Jackpot

The Jackpot target is the face with the lowest current internal probability; the lowest numerical label breaks exact ties. It is recomputed after transfers and resets but remains fixed throughout a roll's settlement.

A roll qualifies only if its sole positive wager is on that target's single number. Several additions on the same target remain one wager. Any other positive wager removes eligibility, even if it overlaps the target. Zero entries are ignored.

A qualifying hit pays **×24 total return**, replacing ×6, and immediately commits a fresh random board. Earned Gold and records remain; Shake is locked on the new board. The client shows the Jackpot reward before presenting the die replacement. A sole 10 G Jackpot from 100 G ends at `100 − 10 + 240 = 330 G`.

A missed exclusive attempt loses the stake and preserves probabilities. A noneligible roll on the least likely face pays ordinary covered targets and applies the normal transfer if anything pays. The target and eligibility have no normal-play marker.

## 7. Settlement, precision, and persistence

For settled bankroll `B`, total committed stakes `S`, and total return `P`:

```text
BNext = B - S + P
NetChange = P - S
BestGold = max(previous BestGold, BNext)
```

The server transaction checks request identity and revision, validates wagers, snapshots probabilities and Jackpot target, samples one outcome, settles all payouts, updates probabilities and Shake eligibility, updates the record, increments the revision, and stores the full response receipt together.

Gold, wagers, returns, records, and revisions use **BigInt** internally and canonical decimal **strings** in JSON and SQLite. Probability values remain unrounded doubles. The sampler multiplies a uniform draw by the stored probability sum to absorb rounding drift; it does not smooth the board. Developer labels show up to two decimals and never feed settlement. Large displayed chip amounts may be abbreviated; tooltips, accessible names, and the bet editor retain exact wagers.

Player state and receipts are durable in SQLite. The default database is `data/one-of-six.sqlite`, using WAL, FULL synchronous mode, and `BEGIN IMMEDIATE` action transactions. An anonymous 256-bit session cookie identifies a player; only its hash is stored. Clearing the cookie creates a new player and does not delete the old score.

Every action includes a unique request ID and expected revision. Replaying the same ID with the same revision/action returns the original receipt without resettling. Reusing an ID for different data is rejected. A stale revision returns the latest state without settling; the client clears the stale draft. Receipts are retained indefinitely.

Uncommitted drafts belong to the current tab and clear on refresh, settlement, Shake, or a detected cross-tab update. The client stores pending actions in session storage before sending them. An uncertain network result can be retried with the same request after interruption or reload. State and leaderboard synchronize every five seconds and on window focus, with synchronization deferred while an action is busy or pending.

## 8. Leaderboard and identity

A player's score is their highest settled Gold balance across games, starting at 100 G. It is neither gross payout nor cumulative spending. Later losses and bankruptcy restarts do not erase a record; break-even returns do not raise it.

The shared leaderboard lists the top 50 players by best Gold descending. Exact decimal strings sort by length, then lexical value; ties use stable ascending player ID. There is no score cap. Players outside the visible top 50 remain stored.

Nicknames are trimmed and normalized to NFC, must contain 1–24 visible Unicode code points, and reject control/format characters. Names need not be unique. A nickname change uses the same revision and receipt mechanism as other actions.

## 9. Interface and input

### 9.1 Layout and feedback

Wide screens show Bankroll, Personal Best, and wager accounting to the left; the felt table in the center; and a leaderboard tower to the right. Smaller screens provide the leaderboard through a trophy button and right-side drawer. All 13 targets remain available on narrow screens.

Draft wagers appear as tossed chip piles, with up to five visible chips per target and the top chip displaying the total. Grid tracks remain fixed as bets change. A six-faced CSS die tumbles for Roll; Shake slides the old die out and a fresh one in. Ordinary roll timing is 1,100 ms and die replacement is 800 ms, with additional result presentation. These timings do not alter committed rules or add a cooldown after completion.

Paying targets glow and show returns. Net-positive results receive a gain banner, coin flights, particles, and fanfares. Break-even and net-loss returns retain accurate net labels without a victory banner. Jackpot uses a larger celebration followed by the die replacement. A live region announces results and action errors.

### 9.2 Keyboard

- Tab navigates controls; Enter and Space activate buttons.
- **R** rolls a valid draft and **S** uses an available Shake, including when a betting target or another game button has focus.
- Uppercase R/S work. Ctrl, Command, and Alt combinations, held-key repeats, IME composition, and already-consumed events do not trigger actions.
- Shortcuts are inactive while an input, textarea, select, or editable text region is being edited, and while any dialog is open.
- Disabled actions and pending settlements cannot be activated through shortcuts.
- ↑ / ↓ in the amount control adjust by 5 G. Escape closes dialogs and can close the bet editor.

### 9.3 Settings and How to Play

Settings contains the nickname form, **Sound effects**, **Reduce motion**, and **Show probabilities (developer)** controls, plus a link to How to Play. Rule descriptions and explanations of these preferences live in **How to Play**.

The guide includes wager editing, payouts and overlap, random odds, low/high Tilt, probability transfer and an expandable numerical example, Shake eligibility, Jackpot exclusivity, persistence, personal best, keyboard controls, and preference descriptions. It uses a white reading surface, dark 18 px serif body text, simple headings, and a sticky close control. The Tilt control opens it at the appropriate section; closing restores focus to its trigger. The Settings link closes Settings before opening the guide and returns focus to the Settings button afterward.

The guide opens automatically for a player with no previous roll who has not dismissed it. Dismissal is saved per player in the browser and survives refreshes and restarts. How to Play can reopen it at any time.

Sound defaults to on after a user interaction; a saved mute stays muted, and disabling sound stops scheduled notes. Reduced motion follows the system preference or the manual switch and skips movement and particle effects. Sound, manual motion preference, and probability visibility save in browser local storage.

## 10. Runtime and API

The application uses TypeScript, HTML/CSS/SVG, Vite, a Node HTTP server, SQLite, and procedural Web Audio. It requires Node.js 22.16 or later. After installation, `npm run dev` serves the client and API together, normally at port 5173. With no explicit port, development startup tries up to 20 subsequent ports if needed and prints the actual local and network URLs. `npm run build` checks TypeScript and builds the client; `npm start` serves that build.

`HOST`, `PORT`, and `DB_PATH` override defaults. Development binds all IPv4 interfaces for same-Wi-Fi access; production binds loopback unless overridden. Explicit ports and production startup are strict on conflicts.

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | Resume a session or create a new anonymous player; return current state and last roll. |
| `GET /api/leaderboard` | Return top-50 rank, nickname, player ID, and best Gold. |
| `POST /api/action` | Apply `roll`, `shake`, `restart`, or `nickname` using request ID and revision. |

The API does not accept authoritative balances, scores, probability vectors, or random seeds from the client. Actions require JSON and a valid session; explicit cross-origin actions are rejected. The playable server contains no fixture or test-seed endpoint.

## 11. Acceptance examples and checks

Unless otherwise stated, examples start with 100 G and `[40, 20, 15, 10, 10, 5]%`, with hidden Jackpot target 6.

1. **Ordinary hit:** 10 G on 1, outcome 1 → 150 G, one transfer, Shake unlocked.
2. **Complete miss:** 10 G on 1, outcome 2 → 90 G, identical probabilities, Shake unlocked.
3. **Break-even:** 10 G on every number, any outcome → 100 G and one transfer, no Jackpot. A locked Shake stays locked; an already-earned Shake remains available.
4. **Net-loss payout:** 1 G on 1 and 20 G on 2, outcome 1 → 85 G, one transfer and Shake unlocked.
5. **Overlap:** 10 G each on 1, Top, and Red, outcome 1 → 100 G return, 170 G bankroll, exactly one transfer.
6. **Amount independence:** Identical boards and random draws with different positive ordinary stakes produce identical next probabilities.
7. **Rare ordinary hit:** Full-coverage bets, outcome 6, rate 13.5%, equal recipient shares → face 6 falls from 5% to 4.595%; each other face gains 0.081 percentage points. No Jackpot applies.
8. **Jackpot:** Sole 10 G on 6, outcome 6 → 330 G, fresh board, Shake locked. Any additional positive target removes eligibility.
9. **Earned Shake:** A nonzero settlement unlocks Shake; using it preserves Gold and best, resets odds, clears the draft, and locks it again. A second immediate Shake is rejected.
10. **Restart:** Zero Gold restores to 100 G with fresh odds; a historical higher record remains.
11. **Precision and retry:** Huge integer balances survive storage and ranking; a retried action cannot sample or pay twice; stale-tab actions cannot settle.
12. **Keyboard regression:** Click or keyboard-activate a target, then press R without moving focus → exactly one Roll. S works from the same kind of focus after unlocking. Text editing, dialogs, and modifier combinations cannot trigger gameplay.
13. **Guide location:** Settings contains controls; How to Play contains the complete explanations, including current transfer rates. The guide and expanded example fit desktop and mobile, and Tilt navigation retains a reachable close control.

`npm test` covers rules, pacing, persistence, concurrency, HTTP validation, and startup. `npm run test:ui` runs isolated Chromium browser regressions; `npm run test:balance` runs the pacing comparison. Browser setup and exact verification results are documented in [`README.md`](README.md) and [`docs/VERIFICATION.md`](docs/VERIFICATION.md). Tests use in-memory or temporary databases, never normal player data.

## 12. Prototype boundary

The implemented loop is the fixed six-number board, hidden weighted outcomes with visible Tilt, probability transfers, earned free Shake, exclusive Jackpot, persistent Gold, and a shared leaderboard. Progression trees, items, missions, extra board sizes, and additional modes are outside the current build.

This is a local prototype without account recovery, moderation, rate limiting, public deployment configuration, or receipt-retention cleanup. Existing verification uses Chromium; physical phones, Safari, and Firefox are not claimed. Probability tuning is supported by repeatable simulation and regression checks, with player enjoyment and broader strategic balance still subject to playtesting.
