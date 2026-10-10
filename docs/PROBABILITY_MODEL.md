# Random odds, Tilt, and Shake

## Current competition rules

Each run starts with 100 G and allows exactly 100 dice rolls. Losses and break-even wagers count; manual Shake changes neither the count nor its limit. The browser records final Gold only on roll 100 and keeps its best 10 eligible completed runs in a personal leaderboard. Early bankruptcy ends without posting. New run is available after either ending; it preserves completed records and resets Gold, odds, and the roll counter. The browser save uses a new versioned localStorage key; old server databases and backups are not read, imported, or deleted.

Ordinary singles retain ×6. A winning sole wager on the least likely face pays Jackpot ×24 **on every board**, regardless of that face’s probability. The target stays hidden in the normal UI, and the lowest numerical face breaks exact ties. Any other positive wager removes eligibility. Full coverage remains legal and costs a roll, making preparation compete with opportunities to score. A Jackpot’s automatic reset never restores the roll budget.

The standard Show probabilities setting starts off in every run. Enabling it requires confirmation and makes that run ineligible for leaderboard scoring, even if it is turned off later. Existing ranked records stay, and starting a new run resets the setting and eligibility. Run `npm run audit:strategies` to compare three fixed-1-G policies over the current 100-roll budget: blind random numbers, the former hedge-to-12% strategy, and selection using exact expected returns. This diagnoses balance without accessing any database. In 5,000 seeded 100-roll runs per policy, mean final Gold with the current six-level tuning and unconditional Jackpot was 118.02 for random numbers, 121.23 for the old hedge strategy, and 183.89 for informed selection. The policies recorded 4,938, 6,778, and 11,555 Jackpots, respectively. These tests use fixed small wagers, not human play or optimized wager sizes. They do not prove that every adaptive strategy is balanced. With ordinary ×6 retained, the blind-number policy has expected net `3 × p_min` on every board: from 0.06 G at the 2% floor to 0.50 G on an exactly even board, per 1 G wager. Positive opportunities are compatible with competition for a finite-run score.

The board should vary enough to reward exploration, while retaining enough continuity for a player to learn from results. This model randomizes every fresh board and every paying update. It keeps the earlier rule that an ordinary paying outcome gives probability to the other faces. Resampling the whole board after every payout would discard the evidence the player had just collected.

## How does a fresh board get its odds?

Draw six independent exponential weights and normalize them. This produces a symmetric Dirichlet distribution with all parameters equal to one, which assigns no special preference to any face and samples uniformly over probability vectors before applying the floor. Normalizing independent gamma variables is the standard construction; the exponential is the shape-one case. [NIST’s Dirichlet generator](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/dirirand.htm) describes this construction.

For independent uniform values `u[i]` in `(0, 1)`:

```text
x[i] = -ln(1 - u[i])
w[i] = x[i] / sum(x)
p[i] = 0.02 + 0.88 × w[i]
```

Every fresh probability is at least 2%, and the six sum to 100%. A face can approach 90%, since the remaining five each retain 2%. Reserving this floor keeps rare outcomes attainable without imposing a fixed set of starting values. The floor is a game-design choice, not a requirement of the Dirichlet distribution. Random draws come from the browser’s Web Crypto generator, on the same uniform 48-bit grid as the former server; rounding for display never feeds back into settlement.

## What changes after a paying roll?

First sample and settle exactly one outcome using the board before the roll. If no wager pays, keep those probabilities. If an ordinary wager pays, use the Tilt of the board **before** the roll to choose a transfer range, then draw a rate `a` uniformly within that range. Draw an independent five-part vector `q` from Dirichlet(1,1,1,1,1) to allocate the transfer.

| Pre-roll Tilt | Random transfer rate | Mean rate |
|---|---:|---:|
| 1 | 4–8% | 6% |
| 2 | 4.2–8.4% | 6.3% |
| 3 | 4.4–8.8% | 6.6% |
| 4 | 4.6–9.2% | 6.9% |
| 5 | 4.8–9.6% | 7.2% |
| 6 | 5–10% | 7.5% |

The gap in mean transfer speed is now 6–7.5% across six levels, compared with 7.2–21.6% across the previous five. High Tilt remains slightly faster, while the former top two bands change much more gently. The actual amount also depends on the paying face's probability, so a rare face can give away less than a common face at a lower Tilt. A new range applies on the next paying roll after a level boundary is crossed.

For rolled face `i`:

```text
delta = a × max(0, p[i] - 0.02)
p'[i] = p[i] - delta
p'[j] = p[j] + delta × q[j]     for each of the other five faces
```

Both the transfer amount and the receiving shares change randomly. The mean rate increases with Tilt, and each recipient's expected share is one fifth. Each realized update preserves the total, keeps a new-model board above its floor, and usually reduces the rolled face. A face already at the floor gives nothing away. The transfer function also handles older probability vectors below the floor without taking mass from those faces. Fresh runs use the current floor. The new browser-save format does not import old server databases.

For example, take `[40, 20, 15, 10, 10, 5]%`, a Tilt 2 board. An ordinary payout on face 1 with rate 6.3% transfers `6.3% × (40% − 2%) = 2.394 percentage points`. If the random recipient shares happen to be `[40, 25, 15, 12, 8]%`, the next board is `[37.606, 20.9576, 15.5985, 10.3591, 10.28728, 5.19152]%`. This is one possible update, not a fixed sequence.

Apply one update per paying roll, regardless of the wager amount or number of matching targets. A paying roll can still lose Gold overall or break even. This can make a board more even when a common face pays, but reducing a rare face can make it less even; equal odds are not a guaranteed destination.

A successful sole wager on the least likely face pays Jackpot ×24 and generates a fresh board, regardless of that face’s probability before the roll. Exact probability ties choose the lowest numerical face. A missed Jackpot attempt leaves the odds unchanged.

## What does Tilt reveal?

Tilt is a single integer from 1 to 6, displayed prominently in gold on the table. Clicking or tapping it opens the guide directly at the low/high Tilt explanation, with keyboard focus returned to the control on closing. Levels 1–2 describe a more even spread and gentle changes; levels 5–6 describe stronger concentration and slightly faster changes; levels 3–4 lie between them. A larger value means probability is concentrated on fewer outcomes. It cannot tell the player which face is favored: permuting the six probabilities leaves it unchanged. Many different distributions share a level, and the same level can produce very different row, column, color, and Jackpot chances. Higher Tilt therefore does not by itself mean a better wager.

Compute Shannon entropy from the current unrounded probabilities, then its effective number of outcomes:

```text
H = -sum(p[i] × ln(p[i]))
N = exp(H)
```

Entropy reaches its maximum at equal probabilities. [NIST’s Shannon index reference](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/shannon.htm) gives the formula and equal-probability maximum. `N` expresses the entropy on a count scale: a uniform six-face board has `N = 6`; a board concentrated on fewer faces has a lower value. The count and entropy remain internal.

| Effective outcomes, internal only | Displayed Tilt |
|---|---:|
| 5.4 or more | 1 |
| 4.8 to below 5.4 | 2 |
| 4.5 to below 4.8 | 3 |
| 4.2 to below 4.5 | 4 |
| 3.6 to below 4.2 | 5 |
| Below 3.6 | 6 |

These are fixed design thresholds, not percentiles recalculated from other players. Splitting the former middle band adds detail without changing which boards belong to the old highest two bands: old Tilt 4 is now 5, and old Tilt 5 is now 6. A deterministic simulation of 100,000 fresh boards produced frequencies of 9.8%, 36.2%, 19.5%, 14.9%, 15.0%, and 4.6%. The generator itself is unchanged.

Recompute Tilt from every settled board, including after Shake and Jackpot. A transfer can change hidden odds without crossing a level boundary. The Show probabilities switch remains separate from Tilt and does not change settlement, but enabling it excludes the current run’s score from the leaderboard.

## When is Shake available?

Each fresh board starts with `canShake = false`. A completed or bankrupt run cannot Shake. Manual Shake does not use or restore rolls. After a roll, compare the total return with the total committed stake using exact integer arithmetic. If the net is nonzero, unlock Shake. Either direction counts, and the smallest qualifying change is 1 G.

The entitlement stays available until a reset. A later break-even result cannot remove it. A gain and a subsequent loss can return the bankroll to its earlier amount and still qualify: the rule asks whether a change happened, not whether the latest balance differs from a remembered baseline. Entitlements do not accumulate.

A manual Shake costs no Gold, draws fresh probabilities, clears draft bets, and consumes the entitlement. A Jackpot's forced reset also consumes it, so the Jackpot's gain cannot immediately buy a second reset. Restarting after bankruptcy begins locked too.

Betting 10 G on every face spends 60 G and returns 60 G. The ordinary probability transfer still occurs, but the settled bankroll is unchanged, so this cannot unlock Shake. Changing a draft, changing a nickname, refreshing, or reloading a settled result cannot unlock it either. Eligibility is checked by the pure transition and saved with settlement before animation; the disabled button presents that rule.

Roll keeps its tumbling die animation. Manual Shake and the automatic reset after a Jackpot slide the old die out and bring a fresh die in from the other side. The animation only presents the already-saved reset; it does not sample another outcome. Reduced motion skips the replacement movement, and temporary decorative dice are removed on completion or cancellation.

## Which pace preserves opportunity and tension?

The six-level tuning targets roughly three to four chances at the former Tilt 4 (now 5) and at least two at the former Tilt 5 (now 6). These are pacing targets, not a guaranteed lock on the odds. A chance means a roll through the first change from the starting Tilt, including the roll that changes it. A board close to a boundary can still move after one paying roll.

`npm run test:balance` compares the previous and configured transfer curves on 10,000 identical seeded fresh starts per policy over 80 rolls without Shake. All starting levels are included; the upper-band measurements use only starts in that band. Both profiles use the new display bands; assigning the previous middle rate to both new middle levels reproduces the old transfer behavior. Every roll consumes a paired tape of seven random draws, including unused transfer draws on a miss. The policies are:

- **Group exploration:** cycle all seven groups every three rolls. This uses no hidden odds.
- **Full coverage:** bet every face so every roll pays and transfers. This stresses repeated board updates.
- **Initially strongest face:** keep betting the face with the highest initial chance. This deliberately uses hidden information to test whether a discovered advantage vanishes too quickly.

| Policy | Tilt 5 chances, previous → current median | Tilt 6 chances, previous → current median | Current Tilt 5 / 6 changing after one roll |
|---|---:|---:|---:|
| Group exploration | 3 → 4 | 3 → 4 | 14.6% / 18.4% |
| Full coverage | 1 → 2 | 1 → 2 | 29.9% / 40.3% |
| Initially strongest face | 2 → 3 | 1 → 2 | 25.3% / 36.8% |

The new Tilt 4, a subdivision of the former middle band, lasts a median four group rolls, two full-coverage rolls, or three strongest-face rolls. The top-level medians meet the intended pacing under group exploration and strongest-face play. Full coverage remains a faster path through the bands because every result transfers probability. No policy has a guaranteed minimum stay.

Among starts above Tilt 1, the median group-play arrival at Tilt 1 moves from 20 to 37 rolls; full coverage moves from nine to 16. The initially strongest face stays at or above 30% for a median 35 group rolls, compared with 18 previously, among starts meeting that threshold. Under strongest-face play this window moves from seven to 13 rolls. The 30% measure is an internal opportunity proxy, not information shown to the player.

These results establish repeatable pacing differences; they do not model human recognition, stake choice, bankruptcy, Jackpot hunting, or strategic Shake timing. The rule suite checks actual settlement on the same upper-band scenarios, plus probability conservation, per-level transfer ranges, and longer group exploration. Existing saves retain their committed probabilities and scores; their Tilt is recomputed on read and new payouts use the current rates. No migration or save reset is needed. The guide derives its ranges and arithmetic example from configuration.

## Can a player reliably farm Gold?

**Historical analysis of the rules before 100-roll competition.** The findings, simulation results, and proposals below describe the earlier endless game with an unconditional least-likely-face Jackpot. They motivated the 100-roll limit and an earlier 1/24 Jackpot gate. The gate has since been removed to make Jackpots more attainable; ×5 payouts and attempt limits were not adopted. The expectation formulas below apply again, while the endless-game simulations and proposed restrictions remain historical. The audit script now tests the current rules, so its output supersedes the old 1,000-roll comparison below. It uses production settlement and never opens a database.

### Why is the Jackpot too favorable on an even board?

For a sole 1 G wager on the least likely face, let `p_min` be that face's actual normalized probability. The expected net is `24 × p_min − 1` G. The wager becomes favorable above `1/24`, or about 4.17%. Being the least likely face does not imply a chance that small: on an even board it is about 16.67%, where the expected net is +3 G per 1 G wager. At 12%, the expected net is +1.88 G.

There is a second problem even without knowing the odds or Jackpot target. Choose a number uniformly at random, independently on each roll. Without Jackpot, the expected return is `6 × sum(p[i]) / 6 = 1` G. The Jackpot adds 18 G of return when the randomly chosen number is the marked face and it rolls, an event with probability `p_min / 6`. Thus:

```text
Expected net per 1 G random-number wager = 3 × p_min
```

On boards obeying the current 2% floor, this is at least +0.06 G and can reach +0.50 G. Legacy boards below the floor need not meet the 6% lower bound. Every positive-probability board still gives this policy a positive conditional expectation. Positive expectation does not prevent losing streaks or bankruptcy.

### How does free preparation amplify it?

Wager 1 G on Red and 1 G on Black. Exactly one pays 2 G on every outcome, so Gold never changes. Nevertheless, `settle` triggers an ordinary probability transfer on every roll because a target paid. Repeating this lets the player move the board toward even odds without spending Gold. The existing Shake lock does not stop this: these rolls use Roll, not Shake. Equal wagers on both rows, all three columns, or all six numbers provide other versions of the same mechanism.

The current browser state contains `probabilities` and `jackpotNumber`. Settlement and stored last-roll records also expose the before/after probabilities and marker. Settings offers Show probabilities; enabling that display now excludes the current run’s score from the leaderboard. Browser inspection remains available independently of the setting; this is a personal game with no anti-cheat boundary. A player can therefore wait until every face has at least a 12% chance, identify the minimum, and place sole 1 G wagers on it. A miss leaves the board unchanged, so that favorable chance and target persist until a Jackpot hit. The hit pays 24 G and resets the board; the player can then prepare the next board for free.

The audit simulated 5,000 runs per policy, starting at 100 G and stopping at bankruptcy, at least 200 G, or 1,000 rolls. Preparation rolls count toward the limit. Neither policy uses Shake or restart, and every attack wager is 1 G. Both policies start with the same seeded fresh boards; their later random streams diverge. The Jackpot policy falls back to a sole Jackpot wager if only 1 G remains, because it cannot afford the two-target hedge.

| Policy | Reached 200 G | Bankrupt | Still below target at 1,000 rolls | Median rolls among successes |
|---|---:|---:|---:|---:|
| Random number, no odds information | 4,783 / 5,000 (95.66%) | 17 (0.34%) | 200 (4.00%) | 356 |
| Free preparation to 12% minimum, then known Jackpot | 5,000 / 5,000 (100%) | 0 | 0 | 243 |

The second policy needed a median 28 hedge rolls per completed preparation and had a mean Jackpot chance of 12.25% across attack rolls. These are deterministic simulation observations, not a proof of optimality, a prediction of human play, or a guarantee. A long enough sequence of missed Jackpot bets still exhausts a finite bankroll. The audit also verifies the hedge's zero net and probability change separately for each of the six possible outcomes.

### Is any win literally guaranteed?

No ordinary wager portfolio guarantees a positive one-roll profit. Each target's multiplier times its number of covered outcomes equals six. Consequently, summing an ordinary portfolio's net returns over all six outcomes gives zero. A portfolio that never loses must therefore break even on every outcome. Jackpot requires a sole number wager, which loses on the other five outcomes. Overlapping bets do not evade this argument.

There is a separate long-run leaderboard problem. Bankruptcy restores 100 G for free and retains the historical best. For any fixed finite score target, some finite sequence of all-in ordinary number wins reaches it. Each required face has at least a 2% chance on current-model boards. Unlimited fresh attempts therefore make eventually reaching that target a probability-one event in the idealized unlimited-time model. This does not give a finite completion deadline or guarantee first place against other players. It does mean lifetime best with unlimited free retries rewards repeated attempts even if expected returns are reduced.

Doubling a losing bet is not a risk-free solution either. Starting with 100 G, stakes of 1, 2, 4, 8, 16, and 32 G consume 63 G after six losses, leaving too little for the next 64 G wager. Misses preserving the board do not prevent that loss sequence.

### Which historical proposals addressed the mechanism?

The following proposals belong to the historical shared-ranking analysis, not to the current static project’s requirements. The intended game rewards discovering temporary favorable bets. Eliminating every favorable wager would change that premise. A practical redesign should instead charge for information and preparation, remove the unconditional Jackpot subsidy, and make leaderboard opportunities comparable.

1. **Keep hidden state on the server.** Return only player-visible state and Tilt. Remove probabilities and the marked number from state, action results, last-roll data, replayed receipts, and error responses. The standard display now excludes its run from ranking; also gate the API’s hidden state to that unranked mode. Hiding labels or removing the setting alone is insufficient, and server-only odds do not by themselves cure the blind positive-expectation strategy.
2. **Give scored runs a fixed roll budget.** For example, start with 100 G and allow 100 rolls, counting hedges and charging a turn for Shake. This proposed length needs playtesting. Full coverage then costs an opportunity to score. Reject portfolios that return the exact stake on all six outcomes as an additional direct block on free hedging; check the complete portfolio, since banning Red plus Black alone leaves equivalent combinations. Rejecting exact hedges alone still permits nearly hedged, low-cost information gathering. Simply disabling transfers on break-even results also leaves free sampling of a stationary board.
3. **Reprice Jackpot and its ordinary baseline together.** Restricting ×24 to `p_min ≤ 1/24` removes the especially profitable near-even Jackpot, but keeping ordinary ×6 still leaves the random-number bonus positive whenever Jackpot is available. One concrete candidate is ordinary numbers ×5, with ×24 only when the least likely face has `p_min ≤ 1/24`; otherwise that face also pays ×5. The blind random-number policy then returns at most `(5 + 19/24) / 6 = 139/144`, or about 96.53% of stake, on eligible boards, and 83.33% otherwise. This closes the unconditional number-bet subsidy while allowing a discovered ordinary face above 20% to be favorable. It does not prove that no adaptive strategy can profit, and group wagers require their own balance checks. A limited Jackpot token per scored run is another way to bound repeated harvesting, though it does not remove the subsidy on a qualifying roll.
4. **Bound ranked attempts as well as turns.** Separate unlimited practice from a limited number of scored runs over a defined period, and rank those results. A finite run alone does not solve unlimited attempts retaining the best. Anonymous cookie identities cannot enforce a meaningful per-person limit, so a competitive implementation needs an identity model or must accept this limitation.

If the goal is instead to make every informed wager nonprofitable in expectation, its total-return multiplier `m` must satisfy `p(target) × m ≤ 1`, including any bonus. A house margin makes that inequality strict. Unequal probabilities with ×6 on every ordinary face cannot satisfy this: some face must exceed 1/6 unless all six are equal. Dynamic probability-based payouts would meet a different design goal, but would also disclose information about the hidden odds and substantially change Sixfold's learning loop.

That historical audit used synthetic runs without accessing live player records. Current verification and test counts are recorded in [VERIFICATION.md](VERIFICATION.md). The client-side migration reuses these rules and does not implement the historical shared-competition proposals above.
