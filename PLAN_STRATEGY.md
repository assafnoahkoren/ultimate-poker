# Plan: Strategy Search & Best-Equity-Per-Table-Size

## Goal

Two related questions, one campaign:

1. **What's the best playable strategy for UTH-02?** Lowest house edge on Ante (and on total wagered) using only information a single seat sees.
2. **Does seat count change the answer?** With many seats we can additionally remove other players' hole cards from the dealer's pool. How much, if any, house edge can a "table-aware" strategy claw back, per table size?

Expected shape of answer (so we can sanity-check results):
- **Standard strategies** should produce house edge ~constant across table sizes (each seat is independent vs the dealer). The known published optimum is ~-2.19% on UTH-01 Blind; UTH-02 Trips paytable doesn't affect base-game EV.
- **Table-aware strategies** should improve very slightly — maybe 0.05–0.30% — and the gain should grow with table size.

If we don't see these patterns, that's a bug or methodology issue worth chasing.

## Architecture

New package `internal/strategy/` exposing one interface and several implementations:

```go
type Decision struct {
    PreFlop func(ctx PreFlopCtx) game.PreFlopAction
    Flop    func(ctx FlopCtx)    game.FlopAction
    River   func(ctx RiverCtx)   game.RiverAction
}

type PreFlopCtx struct {
    Hole         [2]cards.Card
    OtherHoles   []cards.Card   // empty for solo strategies; populated for table-aware
    Variant      paytables.Variant
}
type FlopCtx struct { ...; Board [3]cards.Card }
type RiverCtx struct { ...; Board [5]cards.Card }
```

`cmd/strategysim/main.go` is the parallel Monte Carlo runner. It takes a Strategy and a table size, deals N hands, drives the engine, and accumulates per-bet EV statistics. Parallelized by goroutine, each worker with its own RNG and Stats struct, merged at end (no atomics in hot loop).

## Strategies to implement

| # | Name | Info used | Description |
|---|------|-----------|-------------|
| 1 | `random` | own holes | Uniform-random legal action. Sanity floor; should produce horrible EV. |
| 2 | `always-check` | none | Check, check, bet 1x river (never folds). Trivial passive baseline. |
| 3 | `always-4x` | own holes | Bet 4x pre-flop always. Tests "max aggression". |
| 4 | `equity-threshold` | own holes + board | Bet 4x pre-flop if eq > τ_pf; bet 2x flop if eq > τ_fl; bet 1x river if eq > τ_riv. **This is the one we grid-search.** |
| 5 | `published-optimal` | own holes + board | Hand-coded rules from Wizard of Odds (pair rules, suited K/Q ranges, hidden-pair flop rule, river out-counting). |
| 6 | `equity-threshold-table` | + other holes | Same as 4 but equity calc removes other players' holes from the dealer pool. |
| 7 | `published-optimal-table` | + other holes | Hybrid: published rules drive most decisions, but at marginal river hands, override with exact table-aware equity calc. |

## Performance: the wall we have to climb

A naive grid search at 10M hands × 125 grid points × 6 table sizes = **7.5B hands per strategy class**. At ~50µs/hand (current evaluator) that's ~100 CPU-hours. Not happening.

Mitigations baked into the plan:

1. **Two-phase precision.** Search at 1M hands per grid point (~0.1% SE), then validate the top 5 candidates at 10M hands (~0.03% SE). Cost: 125M for search + 50M for validation per strategy class, ≈ 25 min sequential / ~3 min parallel.

2. **Precomputed equity for standard strategies.** Pre-flop has 169 distinct hole-card classes (e.g., AKs, AKo, 72o). Cache equity per class once at startup; pre-flop decision becomes a map lookup, not 3000 Monte Carlo iterations.

3. **Skip live equity in flop search.** For the threshold strategy, approximate flop equity with a fast heuristic (made-pair lookup using both hole cards, flush-draw detection, etc.). Treat the grid as searching "what counts as a strong flop hand" rather than "what equity threshold flips the bet." Cleaner objective, same expressive power, ~50× faster per hand.

4. **Exact river.** River decision uses exact enumeration over the 990 possible dealer hands. No MC needed; cheap and clean.

5. **Table-aware strategies sampled at lower N.** Live equity at 3000 trials is ~50× slower than precomputed. We'll budget 1M hands per (table-size × strategy) cell instead of 10M for these — still gives ~0.1% SE, enough to detect a 0.3%+ effect.

## Experiment plan

### Phase 1 — Standard strategy search

1. Precompute equity tables: pre-flop 169-class equity vs random villain (one-time, ~30s).
2. Grid-search `equity-threshold` with 125 (τ_pf, τ_fl, τ_riv) points at 1M hands each. Single table-size (heads-up) since standard strategies are table-invariant.
3. Pick top 3–5 candidates by EV, validate at 10M hands.
4. Implement `published-optimal`, validate at 10M hands.
5. Run validated top 5 at all 6 table sizes × 10M hands to confirm table-invariance.

### Phase 2 — Table-aware variants

1. Implement `equity-threshold-table` and `published-optimal-table` reusing Phase 1 rules with table-aware equity overrides.
2. Run at 6 table sizes × 1M hands each (8 strategies × 6 sizes ≈ 50M hands total).
3. Compute marginal EV gain over standard counterparts per table size.

### Phase 3 — Analysis

Produce `STRATEGY_ANALYSIS.md` with:
- Table: strategy × table size → house edge on Ante and on total wagered.
- Plot-friendly CSV of the same.
- Marginal EV gain from table-awareness as a function of seat count.
- Discussion: did we hit the published ~-2.19%? How big is the table-aware effect? Where does the effect come from (which decision points contribute most)?

## Runtime budget (estimate)

| Phase | Hands total | Wall time (12 cores) |
|---|---|---|
| Pre-compute equity tables | — | ~30 s |
| Phase 1 search | ~125M | ~3 min |
| Phase 1 validation | ~50M | ~1 min |
| Phase 1 all-sizes | ~300M | ~6 min |
| Phase 2 table-aware | ~120M | ~15 min (live equity slow) |
| Analysis / writeup | — | manual |
| **Total** | ~600M | **~25–30 min** |

## Files to create

```
internal/strategy/
  strategy.go          # interface, contexts, action types (re-exports game.PreFlopAction etc.)
  random.go            # strategy 1
  always_check.go      # strategy 2
  always_4x.go         # strategy 3
  threshold.go         # strategy 4, grid-searchable
  optimal.go           # strategy 5
  threshold_table.go   # strategy 6
  optimal_table.go     # strategy 7
  preflop_equity.go    # 169-class pre-flop equity precompute
internal/sim/
  runner.go            # parallel Monte Carlo runner
  stats.go             # per-strategy accumulator
cmd/strategysim/main.go  # CLI: takes flags for strategy, hands, table_size, json
STRATEGY_ANALYSIS.md     # final writeup with results + tables
```

## Open questions before coding

- **Is the "fast heuristic" approximation acceptable for flop**, or do you want live equity at flop too (much slower, smaller sample budget)?
- **For Phase 1 all-sizes**, do you actually need all 6 sizes for the *standard* (table-invariant) strategies, or is 2 sizes (e.g., 1 and 6) sufficient as a sanity check?
- **Strategy 7 (published-optimal-table)** — worth implementing, or stick with the threshold-based table-aware variant?
