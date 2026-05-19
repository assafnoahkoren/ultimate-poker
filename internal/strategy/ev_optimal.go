package strategy

import (
	"math/rand/v2"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
	"ultimate-poker/internal/game"
)

// evOptimal makes decisions by direct EV maximization at every phase:
//
//   - Pre-flop: precomputed 169-class equity vs random opponent; bet 4× if
//     equity > preFlopBetThreshold (≈ 50%, where +4× is +EV vs always-bet-1×).
//   - Flop:    live Monte Carlo equity at flopMCTrials trials; bet 2× if
//     P(win) > P(lose) (equivalent to "the extra play unit is +EV").
//   - River:   exact enumeration over all possible dealer hole-card combos;
//     bet iff EV(bet) > EV(fold) = -2 ante.
//
// When TableAware is true, the flop MC and river enumeration also remove the
// other players' hole cards from the dealer's possible-card pool. (Pre-flop
// uses the precomputed table either way — the equity shift from removing two
// or four cards from a 50-card pool is < 1% on average.)
type evOptimal struct {
	TableAware bool
}

// EVOptimal returns the EV-optimal strategy using only single-seat info.
func EVOptimal() Factory { return func() Strategy { return evOptimal{TableAware: false} } }

// EVOptimalTable returns the EV-optimal strategy with table-aware flop + river.
func EVOptimalTable() Factory { return func() Strategy { return evOptimal{TableAware: true} } }

func (e evOptimal) Name() string {
	if e.TableAware {
		return "ev-optimal-table"
	}
	return "ev-optimal"
}

// preFlopBetThreshold is the equity above which we bet 4× pre-flop.
// Derivation: EV(bet 4×) - EV(check & always-bet-1×) = 3·(P(win) - P(lose)) on
// the play wager. With ~5% ties, P(win) > P(lose) iff P(win) > (1-P(tie))/2,
// i.e. ≈ 0.475. Plus a small positive adjustment for the fold option that
// makes "check" slightly more valuable at the margin.
const preFlopBetThreshold = 0.50

func (e evOptimal) PreFlop(ctx PreFlopCtx) game.PreFlopAction {
	EnsurePreFlopEquityTable()
	if preFlopEquity[classIndexOfHole(ctx.Hole)] > preFlopBetThreshold {
		return game.PreFlopBet4x
	}
	return game.PreFlopCheck
}

const flopMCTrials = 1000

func (e evOptimal) Flop(ctx FlopCtx) game.FlopAction {
	var otherHoles []cards.Card
	if e.TableAware {
		otherHoles = ctx.OtherHoles
	}
	if flopMCWinsBeatLosses(ctx.Hole, ctx.Flop, otherHoles, ctx.RNG, flopMCTrials) {
		return game.FlopBet2x
	}
	return game.FlopCheck
}

func (e evOptimal) River(ctx RiverCtx) game.RiverAction {
	var otherHoles []cards.Card
	if e.TableAware {
		otherHoles = ctx.OtherHoles
	}
	return riverOptimalEV(ctx.Hole, ctx.Board, otherHoles, ctx.Variant)
}

// flopMCWinsBeatLosses estimates whether P(win) > P(lose) at the flop via
// Monte Carlo. Returns true when betting 2× is the higher-EV action.
//
// Per-trial: draw 2 dealer holes + 2 remaining board cards from the unseen
// pool, then evaluate both 7-card hands. Roughly 2µs per trial; the 1000-trial
// default takes ~2 ms per call, which is the dominant cost in the inner sim
// loop.
func flopMCWinsBeatLosses(hole [2]cards.Card, flop [3]cards.Card, otherHoles []cards.Card, rng *rand.Rand, trials int) bool {
	var inDeck [52]bool
	for i := range inDeck {
		inDeck[i] = true
	}
	inDeck[hole[0]] = false
	inDeck[hole[1]] = false
	for _, c := range flop {
		inDeck[c] = false
	}
	for _, c := range otherHoles {
		inDeck[c] = false
	}
	var pool [52]cards.Card
	np := 0
	for i := 0; i < 52; i++ {
		if inDeck[i] {
			pool[np] = cards.Card(i)
			np++
		}
	}

	var hero7, dealer7 [7]cards.Card
	hero7[0] = hole[0]
	hero7[1] = hole[1]
	hero7[2] = flop[0]
	hero7[3] = flop[1]
	hero7[4] = flop[2]
	dealer7[2] = flop[0]
	dealer7[3] = flop[1]
	dealer7[4] = flop[2]

	wins, losses := 0, 0
	for t := 0; t < trials; t++ {
		// Partial Fisher-Yates for 4 cards: 2 dealer holes + turn + river.
		for i := 0; i < 4; i++ {
			j := i + rng.IntN(np-i)
			pool[i], pool[j] = pool[j], pool[i]
		}
		dealer7[0] = pool[0]
		dealer7[1] = pool[1]
		hero7[5] = pool[2]
		hero7[6] = pool[3]
		dealer7[5] = pool[2]
		dealer7[6] = pool[3]

		hHV := eval.Evaluate7(hero7)
		dHV := eval.Evaluate7(dealer7)
		switch {
		case hHV > dHV:
			wins++
		case hHV < dHV:
			losses++
		}
	}
	return wins > losses
}
