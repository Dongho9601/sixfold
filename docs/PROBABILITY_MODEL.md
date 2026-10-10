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
| 1 | 2–4% | 3% |
| 2 | 3–6% | 4.5% |
| 3 | 4–8% | 6% |
| 4 | 5–10% | 7.5% |
| 5 | 6–12% | 9% |

These rates slow changes across the board relative to the earlier 10–40% range. High-Tilt boards still change faster than low-Tilt boards: they transfer a larger fraction of the rolled face's available probability. The actual amount also depends on that face's probability, so a rare face on a high-Tilt board can give away less than a common face on a low-Tilt board. If a transfer crosses a Tilt boundary, the new range applies on the next paying roll. This preserves the meaning of the level the player saw when committing a wager.

For rolled face `i`:

```text
delta = a × max(0, p[i] - 0.02)
p'[i] = p[i] - delta
p'[j] = p[j] + delta × q[j]     for each of the other five faces
```

Both the transfer amount and the receiving shares change randomly. The mean rate increases with Tilt, and each recipient's expected share is one fifth. Each realized update preserves the total, keeps a new-model board above its floor, and usually reduces the rolled face. A face already at the floor gives nothing away. Older saved boards may contain smaller probabilities; those faces also give nothing away until they have received enough mass. Migration does not silently replace an existing board.

For example, take `[40, 20, 15, 10, 10, 5]%`, a Tilt 2 board. An ordinary payout on face 1 with rate 4.5% transfers `4.5% × (40% − 2%) = 1.71 percentage points`. If the random recipient shares happen to be `[40, 25, 15, 12, 8]%`, the next board is `[38.29, 20.684, 15.4275, 10.2565, 10.2052, 5.1368]%`. This is one possible update, not a fixed sequence.

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

The floor, per-level rate ranges, and Tilt thresholds live in `src/config.ts`. They are initial tuning choices and can be adjusted independently after playtesting.
