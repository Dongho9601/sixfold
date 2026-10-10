# Random odds, Tilt, and Shake

The board should vary enough to reward exploration, while retaining enough continuity for a player to learn from results. This model randomizes every fresh board and every paying update. It keeps the earlier rule that an ordinary paying outcome gives probability to the other faces. Resampling the whole board after every payout would discard the evidence the player had just collected.

## How does a fresh board get its odds?

Draw six independent exponential weights and normalize them. This produces a symmetric Dirichlet distribution with all parameters equal to one, which assigns no special preference to any face and samples uniformly over probability vectors before applying the floor. Normalizing independent gamma variables is the standard construction; the exponential is the shape-one case. [NIST’s Dirichlet generator](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/dirirand.htm) describes this construction.

For independent uniform values `u[i]` in `(0, 1)`:

```text
x[i] = -ln(1 - u[i])
w[i] = x[i] / sum(x)
p[i] = 0.02 + 0.88 × w[i]
```

Every fresh probability is at least 2%, and the six sum to 100%. A face can approach 90%, since the remaining five each retain 2%. Reserving this floor keeps rare outcomes attainable without imposing a fixed set of starting values. The floor is a game-design choice, not a requirement of the Dirichlet distribution. Random draws come from the server's cryptographic generator; rounding for display never feeds back into settlement.

## What changes after a paying roll?

First sample and settle exactly one outcome using the board before the roll. If no wager pays, keep those probabilities. If an ordinary wager pays, use the Tilt of the board **before** the roll to choose a transfer range, then draw a rate `a` uniformly within that range. Draw an independent five-part vector `q` from Dirichlet(1,1,1,1,1) to allocate the transfer.

| Pre-roll Tilt | Random transfer rate | Mean rate |
|---|---:|---:|
| 1 | 6–12% | 9% |
| 2 | 9–18% | 13.5% |
| 3 | 12–24% | 18% |
| 4 | 15–30% | 22.5% |
| 5 | 18–36% | 27% |

These rates are 1.5× the immediately preceding tuning, or 3× the original baseline. They implement the request to reach low Tilt sooner, with a shorter opportunity window before a concentrated board changes. High-Tilt boards transfer a larger fraction of the rolled face's available probability. The actual amount also depends on that face's probability, so a rare face on a high-Tilt board can give away less than a common face on a low-Tilt board. If a transfer crosses a Tilt boundary, the new range applies on the next paying roll. This preserves the meaning of the level the player saw when committing a wager.

For rolled face `i`:

```text
delta = a × max(0, p[i] - 0.02)
p'[i] = p[i] - delta
p'[j] = p[j] + delta × q[j]     for each of the other five faces
```

Both the transfer amount and the receiving shares change randomly. The mean rate increases with Tilt, and each recipient's expected share is one fifth. Each realized update preserves the total, keeps a new-model board above its floor, and usually reduces the rolled face. A face already at the floor gives nothing away. Older saved boards may contain smaller probabilities; those faces also give nothing away until they have received enough mass. Migration does not silently replace an existing board.

For example, take `[40, 20, 15, 10, 10, 5]%`, a Tilt 2 board. An ordinary payout on face 1 with rate 13.5% transfers `13.5% × (40% − 2%) = 5.13 percentage points`. If the random recipient shares happen to be `[40, 25, 15, 12, 8]%`, the next board is `[34.87, 22.052, 16.2825, 10.7695, 10.6156, 5.4104]%`. This is one possible update, not a fixed sequence.

Apply one update per paying roll, regardless of the wager amount or number of matching targets. A paying roll can still lose Gold overall or break even. This can make a board more even when a common face pays, but reducing a rare face can make it less even; equal odds are not a guaranteed destination.

A successful sole wager on the least likely face still pays Jackpot ×24 and generates a fresh board instead of applying a transfer. Exact probability ties choose the lowest numerical face. A missed Jackpot attempt leaves the odds unchanged.

## What does Tilt reveal?

Tilt is a single integer from 1 to 5, displayed prominently in gold on the table. Clicking or tapping it opens the guide directly at the low/high Tilt explanation, with keyboard focus returned to the control on closing. Levels 1–2 describe a more even spread and gentle changes; levels 4–5 describe stronger concentration and faster changes; level 3 lies between them. A larger value means probability is concentrated on fewer outcomes. It cannot tell the player which face is favored: permuting the six probabilities leaves it unchanged. Many different distributions share a level, and the same level can produce very different row, column, color, and Jackpot chances. Higher Tilt therefore does not by itself mean a better wager.

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
| 4.2 to below 4.8 | 3 |
| 3.6 to below 4.2 | 4 |
| Below 3.6 | 5 |

These are fixed design thresholds, not percentiles recalculated from other players. A deterministic simulation of 100,000 fresh boards produced level frequencies of approximately 9.7%, 36.1%, 34.2%, 15.3%, and 4.7%. Thus ordinary starting boards mostly show levels 2–3, while stronger concentration is unusual. The most likely face averaged about 37.9% across that simulation. These results describe the generator, not proven player enjoyment or long-term game balance.

Recompute Tilt from every settled board, including after Shake and Jackpot. A transfer can change hidden odds without crossing a level boundary. The developer probability switch remains separate from Tilt and does not affect the game.

## When is Shake available?

Each fresh board starts with `canShake = false`. After a roll, compare the total return with the total committed stake using exact integer arithmetic. If the net is nonzero, unlock Shake. Either direction counts, and the smallest qualifying change is 1 G.

The entitlement stays available until a reset. A later break-even result cannot remove it. A gain and a subsequent loss can return the bankroll to its earlier amount and still qualify: the rule asks whether a change happened, not whether the latest balance differs from a remembered baseline. Entitlements do not accumulate.

A manual Shake costs no Gold, draws fresh probabilities, clears draft bets, and consumes the entitlement. A Jackpot's forced reset also consumes it, so the Jackpot's gain cannot immediately buy a second reset. Restarting after bankruptcy begins locked too.

Betting 10 G on every face spends 60 G and returns 60 G. The ordinary probability transfer still occurs, but the settled bankroll is unchanged, so this cannot unlock Shake. Changing a draft, changing a nickname, refreshing, or replaying an action receipt cannot unlock it either. Eligibility is checked and persisted in the same SQLite transaction as settlement; the disabled button merely presents that server rule.

Roll keeps its tumbling die animation. Manual Shake and the automatic reset after a Jackpot slide the old die out and bring a fresh die in from the other side. The animation only presents the already-saved reset; it does not sample another outcome. Reduced motion skips the replacement movement, and temporary decorative dice are removed on completion or cancellation.

## Which pace preserves opportunity and tension?

On October 10, the transfer ranges were compared at 1×, 1.5×, 2×, 3×, and 4× the original baseline rates. The current **3× baseline profile** is in `src/config.ts`, a further 1.5× increase over the preceding 2× tuning. This follows the request for faster progression after reviewing the earlier 40-roll results. Neither the Tilt thresholds nor the fresh-board distribution changed; Tilt 1 remains the same measure of concentration.

Run `npm run test:balance` to reproduce the experiment in [`scripts/tune-tilt.ts`](../scripts/tune-tilt.ts). It calls the production fresh-board, sampling, Tilt, and transfer functions. Candidate ranges are supplied only to the offline transfer call; live API clients cannot choose a range or seed. The script also runs the currently configured rates, so future tuning can be compared with the same baseline.

Each profile uses the same 10,000 seeded fresh boards that start at Tilt 2–5, followed for 80 rolls without Shake. Starting boards already at Tilt 1 are excluded so they do not inflate success rates. Every roll consumes a paired tape of seven random draws, even when a miss does not use its transfer draws, keeping the comparison repeatable. There are two policies:

- **Group exploration:** wager 1 G on one group, cycling Top, Bottom, Left, Middle, Right, Red, and Black every three rolls. This uses no hidden probability information, gives every face opportunities to pay, and can afford all 80 rolls from 100 G even if every bet loses.
- **Full coverage:** wager 1 G on each face. Every roll returns 6 G and triggers a transfer. This measures pacing when every outcome pays, with no bankroll risk and no Jackpot. It does not unlock Shake.

For an opportunity measure, track the initially strongest face until its chance first falls below 30%, restricting that measurement to starts at or above 30%. A 30% face still offers a substantial ordinary number opportunity relative to the ×6 break-even chance of 1/6. The player cannot see this statistic; it is a diagnostic measure of how long a strong starting chance persists, not proof that a player will discover or profit from it. It also does not measure group or Jackpot opportunities.

| Profile vs. original baseline | Group rolls to first Tilt change, median | Group rolls to first Tilt 1, median | Reach Tilt 1 within 20 group rolls | Starting opportunity window, median group rolls | Full-coverage rolls to first Tilt 1, median |
|---|---:|---:|---:|---:|---:|
| Original, 1× | 13 | 47 | 12.5% | 46 | 21 |
| 1.5× | 8 | 31 | 23.8% | 29 | 14 |
| Preceding tuning, 2× | 6 | 23 | 40.5% | 21 | 11 |
| **Current, 3×** | **5** | **16** | **69.0%** | **13** | **7** |
| 4× | 4 | 12 | 83.8% | 8 | 5 |

The current profile prioritizes shorter sessions: the median first Tilt 1 falls from 23 to 16 group rolls, and the proportion reaching it within 20 rolls rises from 40.5% to 69.0%. The initially strongest face's median opportunity falls from 21 to 13 rolls. That tradeoff leaves less time to gather evidence about hidden odds, but makes the board react within fewer bets. A 4× baseline profile would shorten the opportunity further to eight rolls. Rate multipliers do not translate exactly into arrival-time multipliers because outcomes, misses, redistribution, and Tilt boundaries also determine the path.

Faster transfer also makes low Tilt more persistent under these policies. For the selected profile, 89.0% of group-play observations on rolls 21–40 are at Tilt 1, compared with 69.8% under the preceding tuning. Full coverage spends 99.9% of that interval at Tilt 1. This model therefore offers tension through a changing initial opportunity and the choice to Shake for another board; it does not create endless spontaneous swings back to high Tilt. A player who always bets the same group may evolve the board differently, because uncovered outcomes never transfer.

These results establish repeatable pacing differences, not a scientifically proven “most fun” setting. The two policies do not model human learning, larger-stake bankruptcy, Jackpot hunting, or strategic Shake timing. Human playtesting should check whether the 13-roll opportunity proxy leaves enough time to recognize a pattern and whether low-Tilt play still feels engaging. The regular rule suite includes a smaller 1,000-board settlement simulation that guards the current pace: most boards reach Tilt 1 within 20 group rolls, with a median opportunity window of 10–16 rolls.

The floor, per-level rate ranges, and Tilt thresholds live in `src/config.ts` and can be adjusted independently after playtesting. Existing saves and action receipts retain their committed odds and results; the selected rates apply at the next new ordinary paying roll. How to Play derives its displayed ranges and numerical example from the same configuration.
