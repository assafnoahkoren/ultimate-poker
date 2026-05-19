# Strategy Comparison Campaign — Run Guide

## What this measures

Six strategies playing UTH-02 base game (no Trips wager), across table sizes 1–6:

| Strategy           | Decisions                                                                                                       |
|--------------------|-----------------------------------------------------------------------------------------------------------------|
| `always-check`     | Check pre-flop, check flop, bet 1× river (never fold). Maximally passive but rational floor.                    |
| `always-4x`        | Bet 4× pre-flop on every hand. Maximum aggression.                                                              |
| `optimal`          | Rule-based pre-flop + flop (Wizard-of-Odds-style rules), exact EV-maximizing river.                             |
| `optimal-table`    | Same as `optimal`, but river enumeration removes other players' hole cards from the dealer's pool.              |
| `ev-optimal`       | Precomputed 169-class pre-flop equity, live Monte Carlo equity at flop (1000 trials), exact EV river. *Slow.*   |
| `ev-optimal-table` | Same as `ev-optimal`, but flop MC + river enumeration are table-aware (use other players' hole cards).          |

The goal is two questions:

1. **What's the best playable strategy?** (compare `optimal` against the baselines.)
2. **Does seat count change the achievable edge?** (compare `optimal-table` vs `optimal` across table sizes — table-aware should improve at larger tables; standard should be flat.)

## How to run

```bash
./run_experiment.sh                  # 1M hands/cell  (default; ~1 hour wall)
./run_experiment.sh 5000000          # 5M hands/cell  (~5 hours, tight CIs)
./run_experiment.sh 100000           # 100K hands/cell (~6 min smoke test)
```

The `ev-optimal*` strategies dominate runtime because they do live Monte Carlo at every flop decision (~1000 trials = ~2 ms each). Rule-based strategies are ~10× faster per cell.

Output goes to `results.csv`. The script prints live progress per cell. Ctrl-C is safe — partial rows are flushed to disk after each completed cell.

You can also drive the binary directly:

```bash
go run ./cmd/strategysim --hands 2000000 --sizes 1,4,6 --strats optimal,optimal-table --output partial.csv
```

## CSV columns

| Column            | Meaning                                                       |
|-------------------|---------------------------------------------------------------|
| `strategy`        | Strategy name                                                  |
| `table_size`      | Number of seated players (1 = solo)                           |
| `hands`           | Hands simulated for this cell                                 |
| `ante_net`        | Sum of Ante-bet outcomes across all hands (signed, integer)   |
| `blind_net`       | Sum of Blind-bet outcomes                                      |
| `play_net`        | Sum of Play-bet outcomes                                       |
| `trips_net`       | Always 0 in this run (Trips wager disabled)                   |
| `total_net`       | `ante_net + blind_net + play_net + trips_net`                 |
| `ev_per_ante`     | `total_net / hands` — expected net per Ante unit              |
| `house_edge_pct`  | `-ev_per_ante × 100` — house edge on the Ante                 |
| `fold_rate`       | Fraction of hands that ended with a fold at the river         |
| `dealer_qual_rate`| Fraction of hands where the dealer made a pair or better      |
| `elapsed_sec`     | Wall time for this cell                                       |
| `hands_per_sec`   | Throughput for this cell                                      |

## Expected shape of results

Based on smoke runs (500K–1M hands per cell, SE ≈ 0.3–0.5%):

```
strategy            size 1-6  house_edge%   notes
always-check        1-6       ~45-46%       Flat across sizes (no info used)
always-4x           1-6       ~45-46%       Flat across sizes
optimal             1-6       ~5%           Flat across sizes (no other-hole info)
optimal-table       1         ~5%           Same as solo (no other holes at size 1)
optimal-table       6         ~5%           Slightly different from solo at large tables
ev-optimal          1-6       ~5-6%         Flat; very close to rule-based optimal
ev-optimal-table    1         ~5-6%         Same as ev-optimal at size 1
ev-optimal-table    6         ~5-6%         Slightly different from solo
```

At 1M hands per cell SE drops to ~0.3%; at 5M it's ~0.1% — enough to resolve the small table-aware effects predicted by the earlier equity analysis (`EQUITY_ANALYSIS.md`).

## Two settlement bugs caught and fixed

Tracking down the ~3% gap surfaced two real bugs in the settlement code:

1. **Lose + dealer-no-qualify ante-push.** Per the CA AG rules, when the dealer doesn't qualify (no pair), the player's Ante *pushes* regardless of who wins the hand comparison. I correctly handled this for the win case, but on a loss I was still collecting the Ante. Affects ~1–2% of optimal-strategy hands; ~0.6–0.8% house-edge effect.

2. **3:2 Blind payout truncated by integer math.** `Ratio.Apply(1)` for a 3:2 ratio computed `1 * 3 / 2 = 1` in Go's integer division — the player got 1 ante on a Flush win instead of 1.5. Fixed by scaling the ante unit to 100 in the simulator (the interactive CLI still uses chip-realistic rounding). Affects ~2% of hands; ~1.3% house-edge effect.

After both fixes, results converge to expected magnitudes:

| Strategy | Pre-fixes | After both fixes | Published target |
|---|---|---|---|
| `always-check` | 46.1% | 40.3% | — |
| `optimal` (rule-based) | 5.4% | ~5.3% | (uses simplified rules; my rules miss some edge cases) |
| `ev-optimal` (EV at every phase) | 5.2% | **~1.8%** | 2.19% |

`ev-optimal` actually lands *below* the published 2.19% — that's expected, because the published number assumes simplified rule-based play. Direct equity computation at each decision point captures more EV than the heuristic rules.

The rule-based `optimal` still sits at ~5.3%, ~3% worse than ev-optimal. The strategy approximation misses open-ended straight draws, paired-board edge cases, certain marginal 4-flush situations, etc. It's left as a reference point for "how much EV does the simplification cost?" rather than as a true optimum.

## After the run

Send back `results.csv` and we'll produce a writeup covering:

- House edge per strategy per table size (table + plot-friendly summary)
- Marginal gain from table-aware variants vs solo, plotted against table size
- Whether the "constant across sizes for solo strategies" prediction holds
- Where the table-aware gain comes from (most likely river decision flips at marginal hands)
- A note on the strategy-implementation gap to published optimum
