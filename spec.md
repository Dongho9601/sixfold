# Dice Betting Game — MVP Specification

> Historical design reference. Current random odds, Tilt, and Shake eligibility are documented in [docs/PROBABILITY_MODEL.md](docs/PROBABILITY_MODEL.md); the implementation also uses the board mapping in `src/config.ts`.

**Version:** 0.1  
**Date:** October 9, 2026  
**Platform:** Web browser  
**Status:** Initial implementation specification; balance values remain tunable.

## 1. Purpose and Design Status

Build a small, endless dice-betting game inspired by American roulette. Players wager Gold on a six-number board, roll a weighted die, and grow their balance to place their name on a shared leaderboard.

The central decision is how much to wager on a favorable board, when to pursue its Jackpot opportunity, and when to Shake for a fresh probability distribution.

This document distinguishes two kinds of decisions:

- **Core rules** capture the agreed game design and the direction accepted in the latest discussion.
- **Prototype defaults** make the first implementation concrete where a value or detail was not explicitly decided. They are proposals, not validated balance settings. Keep them easy to change.

In particular, the initial distribution, transfer rate, Jackpot multiplier, starting Gold, and leaderboard record policy remain provisional.

## 2. Core Design

1. Play is endless. There is no turn budget, time limit, mandatory cash-out, or completion target.
2. Playing longer can produce a higher record. This is intentional; scores are not normalized by playtime or action count.
3. The three gameplay actions are **Bet**, **Roll**, and **Shake**.
4. Shake is free and unlimited. It does not consume Gold, an item, or a limited action resource.
5. Die outcomes have visible, nonuniform probabilities. The displayed board represents the probabilities actually used to resolve the next Roll.
6. Any paying wager triggers a probability update, even if the complete Roll breaks even or loses Gold overall.
7. A normal probability update reduces the actual rolled number's probability and transfers that amount to the other five numbers.
8. The transfer does not depend on wager size, payout size, net profit, or the number of matching wagers.
9. A Jackpot requires a wager exclusively on the single marked Jackpot number.
10. A successful Jackpot pays its reward and forces a Shake. Earned Gold is retained.

The intended flow is to earn Gold from favorable probabilities, reconsider bets as those probabilities move, and pursue a Jackpot when its opportunity becomes attractive. A voluntary Shake discards the current distribution, including any improvement in the Jackpot opportunity.

## 3. Board and Bet Targets

The board has **two rows and three columns**, containing exactly six outcomes: 1 through 6. It uses roulette-style bet groups with a weighted six-sided die as the result generator.

| | Column A | Column B | Column C |
|---|---|---|---|
| Top row | 1 — Red | 2 — Black | 3 — Red |
| Bottom row | 4 — Black | 5 — Red | 6 — Black |

Numbers and colors remain in these positions. Shake changes their probabilities, not their labels or colors. Horizontally and vertically adjacent cells have alternating colors; diagonal neighbors have the same color.

### 3.1 Supported wagers

| Target type | Available targets | Covered outcomes | Normal total return |
|---|---|---|---:|
| Single number | 1, 2, 3, 4, 5, 6 | The selected number | ×6 |
| Row | Top, Bottom | {1,2,3} or {4,5,6} | ×2 |
| Column | A, B, C | {1,4}, {2,5}, or {3,6} | ×3 |
| Color | Red, Black | {1,3,5} or {2,4,6} | ×2 |

These are the starting payout values carried forward from the design discussion. Keep them configurable for balancing. Every multiplier includes the original stake: a winning 10 Gold single-number wager returns 60 Gold, for a net gain of 50 Gold on that wager.

Players may combine targets, overlap their coverage, and adjust the amount on each target. Wagers on the same target are combined into one amount.

### 3.2 Gold and draft wagers

- Gold is the player's spendable in-game balance.
- **Prototype default:** Gold and wagers use whole-number units, with a minimum positive wager of 1 Gold.
- A target with a zero wager is inactive.
- The total wager cannot exceed the player's available balance. Borrowing and negative balances are not part of the MVP.
- Editing or clearing uncommitted wagers does not spend Gold.
- **Prototype default:** Roll requires at least one positive wager.

Display the settled balance, total draft wager, and amount remaining after that wager clearly. Do not deduct the same stake both while editing and again during settlement.

## 4. Player Actions

### 4.1 Bet

Select targets and adjust their Gold amounts. Show each target's coverage, payout multiplier, and placed amount. Players can revise the draft freely before rolling.

The game must make Jackpot eligibility visible while the player edits wagers.

### 4.2 Roll

Commit the current wagers and sample one outcome from the current six probabilities. Resolve every wager against that same outcome, pay the result, and apply the appropriate probability update or forced Shake.

The die animation displays the sampled result. It must not generate a separate result or imply that the six outcomes are equally likely.

Bet and Shake cannot modify a Roll already being resolved. Restore input as soon as resolution is complete; this is an atomic-action requirement, not a gameplay cooldown.

### 4.3 Shake

Generate a fresh initial probability distribution and update the Jackpot marker.

- No Gold charge, usage limit, escalating fee, or gameplay cooldown applies.
- The player keeps their settled Gold and leaderboard record.
- The existing distribution is replaced, including any accumulated change in the Jackpot opportunity.
- Manual Shake does not count as a Roll or a win.
- The forced Shake after a Jackpot uses the same initial-distribution generator.

**Prototype draft policy:** Clear uncommitted wagers after either settlement or Shake. Clearing a draft never forfeits Gold. This UI policy can be changed later without changing the game economy.

## 5. Initial Probabilities

Each number has a probability `p[i]`. All six probabilities must be positive, finite, and sum to 1.

The final generation method has not been decided. Free Shake intentionally permits repeated board selection; the generator determines how favorable or extreme an initial board can become.

### 5.1 Prototype default

Use the following initial probability template, randomly permuted across the six fixed numbers on each new board:

```text
[0.40, 0.20, 0.15, 0.10, 0.10, 0.05]
```

This gives a reproducible starting balance range while allowing different row, column, and color probabilities. The numbers above are an example template, not a permanent rule.

The generator may later choose among several templates or sample different distributions within a chosen range. Keep that decision separate from the probability-transfer rule so either can be tuned independently.

## 6. Normal Probability Transfer

### 6.1 Trigger

After a non-Jackpot Roll, update probabilities if at least one positive wager covered the rolled number and therefore paid out.

The trigger is **a paying wager**, not positive net profit for the Roll.

- A break-even Roll can update probabilities.
- A Roll with a net loss can update probabilities.
- Several matching wagers still cause exactly one update.
- If no wager paid, leave probabilities unchanged.

### 6.2 Transfer algorithm

The working algorithm follows the accepted direction of moving probability away from the winning number toward the other five numbers.

Let `i` be the rolled number and `alpha` be the transfer rate. Use the probability snapshot from before the Roll:

```text
delta = alpha * p[i]
pNext[i] = p[i] - delta

For each j != i:
    pNext[j] = p[j] + delta / 5
```

**Prototype default:** `alpha = 0.25`.

This is 25% of the winning number's current probability, not a subtraction of 25 percentage points. A 1 Gold win and a 100 Gold win on the same number produce exactly the same probability change.

For positive initial probabilities and `0 < alpha < 1`, the rule preserves positive probabilities and a total of 1 in exact arithmetic. Implementations must retain sufficient internal precision and avoid feeding rounded display percentages back into the model.

### 6.3 Worked example

For this example only, assign the template to numbers 1 through 6 in order:

| State | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---:|---:|---:|---:|---:|---:|
| Initial | 40% | 20% | 15% | 10% | 10% | 5% |
| After a paying Roll of 1 | 30% | 22% | 17% | 12% | 12% | 7% |
| After another paying Roll of 1 | 22.5% | 23.5% | 18.5% | 13.5% | 13.5% | 8.5% |

Number 2 becomes more likely than number 1. Meanwhile, the initially rare number 6 becomes more likely, creating an improving Jackpot opportunity.

### 6.4 Meaning of “normalization”

This algorithm is **winner-local probability transfer**, not guaranteed movement toward a perfectly uniform distribution on every win.

Repeated wins on high-probability numbers can reduce the initial imbalance. However, a low-probability number can also win through an ordinary wager; reducing it makes that number rarer. Even an exactly uniform board changes after a normal paying Roll: with `alpha = 0.25`, the rolled number becomes 12.5% and each other number becomes 17.5%.

This continuing movement is part of the working design. Do not silently substitute an algorithm that moves every number toward 1/6 or suppresses updates for below-average winning numbers. Strict convergence to uniformity would be a different design decision.

## 7. Jackpot

### 7.1 Target

The Jackpot is associated with the least-probable outcome, not necessarily the lowest numerical face value.

**Prototype marker policy:** Mark the number with the lowest current internal probability. Recompute the marker after a normal probability update or Shake. If several numbers tie for the minimum, select the lowest numerical label among them so exactly one number is marked.

Determine the target from internal probabilities, not rounded labels. Keep the target fixed for the entire resolution of a Roll.

### 7.2 Eligibility

A Roll is Jackpot-eligible only when:

1. There is a positive single-number wager on the currently marked Jackpot number.
2. There are no other positive wagers anywhere on the board.

Any additional number, row, column, or color wager removes Jackpot eligibility, including another wager that also covers the marked number. Combining several chips on the same single-number target remains one wager and is eligible.

### 7.3 Payment and forced Shake

If an eligible Roll lands on the marked number:

1. Pay the Jackpot total-return multiplier on that wager.
2. Retain the resulting Gold balance.
3. Immediately generate a fresh board through forced Shake.
4. Show the newly selected Jackpot number.

The Jackpot return replaces the normal single-number return; it is not added on top of ×6.

**Prototype default:** Jackpot total return is a fixed **×24**, including the stake. This is a proposed balancing value, not an agreed or tested final amount. With a 10 Gold Jackpot wager, the return is 240 Gold and the net gain is 230 Gold.

The fixed multiplier does not shrink as the Jackpot probability improves. The forced Shake ends that board's Jackpot opportunity after a successful payout.

If the eligible wager misses, lose its stake and leave probabilities unchanged because no wager paid. If the marked number appears during a noneligible Roll, settle ordinary wagers normally and apply one ordinary probability transfer when any wager paid. Do not award a Jackpot or force a Shake in that case.

## 8. Settlement and Accounting

For each Roll, define:

```text
B = settled Gold before the Roll
S = sum of all committed stakes
P = total payout, including returned stakes

BNext = B - S + P
NetChange = P - S
```

Normal payout is the sum of the winning wagers' individual returns. Jackpot payout follows Section 7.

### 8.1 Resolution order

1. Validate the draft and snapshot the Gold balance, wagers, probabilities, and Jackpot target.
2. Lock that Roll against further editing and sample exactly one weighted outcome.
3. Compute all payouts using the snapshot and calculate the new settled Gold balance.
4. On a successful Jackpot, perform forced Shake. Otherwise, apply one normal probability transfer if any wager paid.
5. Refresh the Jackpot marker and record the settled balance and score.
6. Persist the completed state, clear the draft under the prototype policy, and return to betting.

Commit the result as one consistent action. Retrying a request, refreshing the page, or completing an animation must not deduct or pay the same Roll twice.

### 8.2 Full-coverage betting is permitted

With ×6 single-number returns, wagering 10 Gold on every number commits 60 Gold. Any outcome returns 60 Gold, so Gold is unchanged. The rolled number still triggers one probability transfer.

This intentionally allows players to preserve Gold while spending time changing the board. It does not award a Jackpot because more than one target was wagered on. The Jackpot probability is not guaranteed to rise on every such Roll.

Do not add a positive-net-profit requirement to prevent this behavior.

## 9. Endless Play, Persistence, and Leaderboard

### 9.1 Balance and recovery

**Prototype default:** A new game starts with 100 Gold.

There is no forced ending while the player can afford a valid wager. If the balance reaches zero, the player cannot wager but may begin a new game with the starting amount. Restart replaces the active game state; it does not add starting Gold to an existing balance. Previous best records remain.

Persist the active balance and current probability distribution so an endless game can continue after a reload. A reload is not a Shake. Preserve the consistency of a completed Roll across saving and resuming.

### 9.2 Record policy

**Prototype default:** A player's leaderboard score is their highest settled Gold balance reached across their games.

```text
BestGold = max(previous BestGold, current settled Gold)
```

Record a new high after settlement; players do not have to end a game or cash out. Later losses do not erase a previous record.

Score is not cumulative gross payouts. Returning a 60 Gold stake on a break-even Roll does not increase wealth or the record. Do not award leaderboard points merely for rolling, shaking, betting, or spending time.

### 9.3 Minimal leaderboard

Provide a persistent, shared leaderboard showing rank, display name, and best Gold balance. Sort by best Gold descending. Use a persistent player identifier so the same player can update their record without creating a new entry for every high score. The identity mechanism is an implementation choice; an elaborate account system is not required by this spec.

Preserve exact integer Gold values, including large balances, through storage, transport, comparisons, and display. Do not introduce a score cap as a gameplay ending condition.

For a public ranked build, compute or validate submitted results against trusted game state. A local-only high-score list can support development, but does not fulfill the shared leaderboard requirement. Framework, backend provider, and hosting choices remain open.

## 10. Minimum Interface

Keep the main play screen compact and usable with mouse or touch. It must show:

- Settled Gold and the current total wager.
- The six fixed numbered/color cells and each current probability.
- A clearly marked Jackpot target, its multiplier, and current eligibility.
- Individual, row, column, and color betting targets with placed amounts.
- Wager amount controls, Roll, and Shake.
- The die result and the most recent payout or net Gold change.
- Access to the leaderboard and the player's best record.

Use number labels and explicit Red/Black group labels so color is not the only way to understand a wager. Highlight the numbers covered by a selected group. Show an understandable reason when Roll is unavailable, such as an empty wager or insufficient Gold.

Animate the die, settlement, and probability movement briefly enough to support repeated play. After a Jackpot, clearly show the reward before presenting the fresh distribution. Avoid hiding a probability change behind an unexplained refresh.

## 11. Prototype Configuration

These defaults make the first build playable. They are adjustable and have not been validated through playtesting.

| Setting | Starting value or policy |
|---|---|
| Starting Gold | 100 |
| Minimum positive wager | 1 Gold |
| Initial probabilities | Random permutation of [40%, 20%, 15%, 10%, 10%, 5%] |
| Probability transfer rate | 25% of the rolled number's current probability |
| Redistribution | Equal shares to the other five numbers |
| Normal total returns | Number ×6; row ×2; column ×3; color ×2 |
| Jackpot total return | Fixed ×24; replaces normal return |
| Jackpot target | Current minimum probability; lowest label breaks ties |
| Leaderboard score | Highest settled Gold balance per player |
| Draft after settlement or Shake | Clear without an additional Gold charge |
| Bankruptcy recovery | Free new game; preserve the historical best |

The main unresolved balance decisions are the initial-distribution family, transfer rate, and Jackpot multiplier. They determine the relative appeal of immediate Shake, ordinary profit-seeking bets, full-coverage preparation, and a Jackpot attempt. Tune these before expanding the feature set.

## 12. Acceptance Examples

Unless stated otherwise, use 100 starting Gold, the example distribution in Section 6.3, Jackpot target 6, and the prototype payout settings.

1. **Normal payout:** Start with 100 Gold and wager 10 on number 1. Rolling 1 with ×6 return leaves 150 Gold and updates number 1's probability once.
2. **Complete miss:** The same wager followed by a roll of 2 leaves 90 Gold. The probability distribution is unchanged.
3. **Break-even still updates:** Start with 100 Gold and wager 10 on each number. Any result leaves 100 Gold and updates the rolled number once. No Jackpot is possible.
4. **Net loss still updates:** Wager 1 Gold on number 1 and 20 on number 2. A roll of 1 pays 6 Gold against 21 staked, losing 15 Gold overall, but still updates number 1 once.
5. **Overlapping wins:** Wager 10 each on number 1, Top row, and Red. A roll of 1 returns 60 + 20 + 20 = 100 Gold against 30 staked. Apply exactly one probability transfer.
6. **Amount independence:** Two identical boards with different positive wagers on the same ordinary winning target produce identical next probabilities.
7. **Transfer arithmetic:** With the example distribution, two successive paying rolls of 1 produce the values in Section 6.3, including number 2 becoming the most likely outcome.
8. **Low-probability ordinary win:** With full-coverage wagers on the example distribution, a roll of 6 reduces its probability from 5% to 3.75%; each other number gains 0.25 percentage points. No Jackpot applies. Do not apply strict-uniformity behavior instead.
9. **Jackpot success:** With 6 marked, a sole 10 Gold wager on 6 and a result of 6 pays the configured Jackpot, preserves the resulting Gold, and forces a fresh distribution.
10. **Jackpot eligibility:** Adding any other positive wager to that Jackpot wager removes eligibility. A result of 6 then follows ordinary settlement and probability transfer.
11. **Free Shake:** Repeated manual Shakes leave settled Gold and the best record unchanged, replace the distribution, and never consume a limited resource.
12. **One marker:** Tied minimum probabilities produce exactly one visible Jackpot target. The marked target at commit time determines that Roll's eligibility and result.
13. **Record integrity:** Break-even returns do not increase BestGold. A later loss or restart does not erase a higher previously recorded settled balance.
14. **Resume and retry:** Reloading preserves the completed game state. Retrying an already completed Roll cannot change its outcome or pay it again.

## 13. MVP Boundary

The first build consists of the six-number betting board, weighted Roll, probability transfer, free Shake, exclusive Jackpot with forced Shake, persistent Gold, and a simple shared leaderboard.

Keep implementation focused on that loop. Progression trees, collectible items, additional board sizes, missions, and separate game modes are outside this initial specification. The next design work is balancing the existing choices and observing whether players change their wager amounts, targets, and Shake timing as the board evolves.
