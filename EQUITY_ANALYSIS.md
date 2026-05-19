# Solo vs. Table Equity — How Much Does Seeing Other Hole Cards Matter?

The CLI shows two equity numbers before each decision:

- **solo** — win/tie/lose % treating every unseen card as unknown (what a single player at a real casino would compute).
- **table** — same, but removes the *other players' hole cards* from the dealer's possible-card pool (extra info available to us because we control every seat).

This document measures how much these two values actually differ, across many random hands.

## Methodology

[cmd/equitysim/main.go](cmd/equitysim/main.go) deals 300 random hands per cell (table-size × phase), and for each hand computes both equities for the hero (seat 0). It reports:

- `bias%`   — mean(solo − table). Systematic offset.
- `std%`    — stddev(solo − table). Spread, including MC noise.
- `|Δ|mean` — mean(|solo − table|). Typical shift magnitude.
- `|Δ|max`  — max(|solo − table|). Worst single-hand shift.

Pre-flop and flop equities are Monte Carlo at 3000 trials per equity, contributing a ~1.29% noise floor to `std%`. River equities are exact enumerations (no MC noise — that column is clean signal).

## Raw output

```
Equity comparison: solo (no other-hole info) vs table (other holes removed)
Samples per cell: 300   MC trials per equity: 3000   Workers: 12
MC noise floor on std(Δ) at this trial count: ~1.29%

size  phase        n |  soloW% tableW% |   bias%    std% |Δ|mean  |Δ|max
--------------------------------------------------------------------------
2     preflop    300 |   48.75   48.51 |  +0.241   2.073   1.598   8.733
2     flop       300 |   47.77   47.90 |  -0.136   1.606   1.272   5.000
2     river      300 |   52.45   52.42 |  +0.030   1.509   1.085   6.043

3     preflop    300 |   47.06   46.97 |  +0.085   2.562   2.036   8.333
3     flop       300 |   47.85   47.84 |  +0.017   1.997   1.563   5.900
3     river      300 |   49.41   49.33 |  +0.087   2.239   1.734   8.280

4     preflop    300 |   48.85   48.73 |  +0.122   3.086   2.502  10.433
4     flop       300 |   48.14   48.32 |  -0.184   2.619   2.043   9.567
4     river      300 |   50.19   50.17 |  +0.018   2.700   1.972  10.127

5     preflop    300 |   47.97   47.83 |  +0.142   3.437   2.656  13.200
5     flop       300 |   47.32   46.95 |  +0.375   2.734   2.219   8.233
5     river      300 |   47.54   47.79 |  -0.249   3.283   2.355  12.629

6     preflop    300 |   47.75   47.49 |  +0.265   3.743   2.984  13.933
6     flop       300 |   47.22   47.02 |  +0.196   3.048   2.459   9.100
6     river      300 |   50.21   50.02 |  +0.192   3.345   2.545  10.499

Total wall time: 45.063s
```

## Headline finding

**Knowing the other players' cards barely shifts the average estimate**, but it can swing individual hands meaningfully — especially at full tables.

| Players | Avg shift | Max shift seen | Practical reading |
|---------|---------------------|----------------|-------------------|
| 2 (heads-up) | ~1.1–1.6% | 5–9%   | Essentially noise |
| 3            | ~1.5–2.0% | 6–8%   | Small but non-zero |
| 4            | ~2.0–2.5% | 9–10%  | Worth showing |
| 5            | ~2.2–2.7% | 8–13%  | Meaningful |
| 6 (full)     | ~2.5–3.0% | 9–14%  | Can matter for marginal decisions |

## Interpretation

- **`bias%`** ranges from −0.25% to +0.38% across all 15 cells → essentially zero. The table view is *not* systematically more optimistic or pessimistic; it's the same value *on average*.
- **`std%`** is the spread of `solo − table`. River values are exact (no MC noise), so river std is the cleanest "real signal" — it grows from 1.5% (2 players) to 3.3% (6 players).
- **`|Δ|max`** grows fast with table size: 5% at heads-up, 14% at 6 players. Individual hands can really differ when many cards are off the deck.

## Why this happens

- With 2 players, you're pulling 2 cards from a 50-card pool → 4% of the deck. Small perturbation.
- With 6 players, you're pulling 10 cards from a 50-card pool → 20% of the deck. The dealer's possible-card distribution can be meaningfully skewed (e.g., if other players hold many aces, the dealer can't).
- On *average* the removed cards are average, so no bias. The shift is a **variance** story, not a **mean** story.

## Practical implication for the CLI

- At heads-up the second equity line is almost decorative.
- At 4+ player tables the "table" number is worth glancing at for marginal calls — the 5–14% max-shift cases are where it would actually change your decision.
- The MC noise floor at 3000 trials is ~1.29% — anything below that in the std column is dominated by sampling noise, not real signal. The river rows are exact and clean.

## Reproducing

```bash
go run ./cmd/equitysim
```

Tweak `samplesPerCell` (more = tighter confidence intervals, linear cost) or `mcTrials` (more = lower MC noise floor for non-river cells) at the top of [cmd/equitysim/main.go](cmd/equitysim/main.go).
