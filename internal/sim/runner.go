// Package sim runs many Ultimate Texas Hold'em hands in parallel for a given
// strategy and accumulates per-hand statistics.
//
// The runner is allocation-free in its hot loop: each worker reuses a single
// deck, fixed-size hole-card array, and a scratch slice for the other players'
// hole cards. The hero is always seat 0; remaining seats are dealt cards but
// no actions (their cards are only used as deck removals for table-aware
// strategies).
package sim

import (
	"math/rand/v2"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
	"ultimate-poker/internal/game"
	"ultimate-poker/internal/paytables"
	"ultimate-poker/internal/strategy"
)

// Config parameterizes a single run.
type Config struct {
	Hands      uint64            // total hands across all workers
	Workers    int               // 0 = runtime.NumCPU()
	Variant    paytables.Variant // paytable in effect
	Factory    strategy.Factory  // builds one Strategy per worker
	Seed       uint64            // base seed; each worker gets seed XOR workerID
	NumPlayers int               // table size including the hero (1..9)
	AnteUnit   int64             // ante size in chip units (typically 1)
	PlaceTrips bool              // whether the hero places the Trips wager every hand
}

// ProgressFunc is invoked periodically with (done, total) hand counts. Pass
// nil to disable progress reporting.
type ProgressFunc func(done, total uint64)

// Run executes the configured experiment and returns aggregated stats.
func Run(cfg Config, progress ProgressFunc) (Stats, time.Duration) {
	workers := cfg.Workers
	if workers <= 0 {
		workers = runtime.NumCPU()
	}
	if cfg.NumPlayers < 1 {
		cfg.NumPlayers = 1
	}
	if cfg.AnteUnit <= 0 {
		cfg.AnteUnit = 1
	}

	perWorker := cfg.Hands / uint64(workers)
	extra := cfg.Hands - perWorker*uint64(workers)

	var counter atomic.Uint64

	stopProgress := make(chan struct{})
	if progress != nil {
		go func() {
			t := time.NewTicker(2 * time.Second)
			defer t.Stop()
			for {
				select {
				case <-stopProgress:
					return
				case <-t.C:
					progress(counter.Load(), cfg.Hands)
				}
			}
		}()
	}

	start := time.Now()
	results := make([]Stats, workers)
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		hands := perWorker
		if w == workers-1 {
			hands += extra
		}
		wg.Add(1)
		go func(workerID int, hands uint64) {
			defer wg.Done()
			rng := rand.New(rand.NewPCG(cfg.Seed, uint64(workerID)+1))
			strat := cfg.Factory()
			runWorker(rng, strat, cfg, hands, &results[workerID], &counter)
		}(w, hands)
	}
	wg.Wait()
	elapsed := time.Since(start)
	close(stopProgress)

	var total Stats
	for i := range results {
		total.Merge(&results[i])
	}
	return total, elapsed
}

const progressBatch = 10_000

func runWorker(rng *rand.Rand, strat strategy.Strategy, cfg Config, hands uint64, s *Stats, counter *atomic.Uint64) {
	deck := cards.NewDeck() // one-time alloc; shuffled in place every hand
	var holes [9][2]cards.Card
	var otherBuf [16]cards.Card

	n := cfg.NumPlayers
	ante := cfg.AnteUnit
	placeTrips := cfg.PlaceTrips
	variant := cfg.Variant

	for i := uint64(0); i < hands; i++ {
		deck.Shuffle(rng)

		for p := 0; p < n; p++ {
			holes[p][0] = deck.Draw()
			holes[p][1] = deck.Draw()
		}
		var dealer [2]cards.Card
		dealer[0] = deck.Draw()
		dealer[1] = deck.Draw()
		var board [5]cards.Card
		for j := 0; j < 5; j++ {
			board[j] = deck.Draw()
		}

		others := otherBuf[:0]
		for p := 1; p < n; p++ {
			others = append(others, holes[p][0], holes[p][1])
		}

		out := playHero(strat, variant, holes[0], dealer, board, others, ante, placeTrips, rng)

		s.Hands++
		s.AnteNet += out.AnteNet
		s.BlindNet += out.BlindNet
		s.PlayNet += out.PlayNet
		s.TripsNet += out.TripsNet
		if out.DealerQualified {
			s.DealerQual++
		}
		if out.Folded {
			s.Folds++
		}
		s.PlayerCatHist[out.PlayerCategory]++

		if (i+1)%progressBatch == 0 {
			counter.Add(progressBatch)
		}
	}
	if rem := hands % progressBatch; rem != 0 {
		counter.Add(rem)
	}
}

type heroOutcome struct {
	AnteNet         int64
	BlindNet        int64
	PlayNet         int64
	TripsNet        int64
	PlayerCategory  eval.Category
	DealerCategory  eval.Category
	DealerQualified bool
	Folded          bool
}

func playHero(
	strat strategy.Strategy,
	variant paytables.Variant,
	hole [2]cards.Card,
	dealer [2]cards.Card,
	board [5]cards.Card,
	otherHoles []cards.Card,
	ante int64,
	placeTrips bool,
	rng *rand.Rand,
) heroOutcome {
	var play int64
	folded := false

	switch strat.PreFlop(strategy.PreFlopCtx{
		Variant:    variant,
		Hole:       hole,
		OtherHoles: otherHoles,
		RNG:        rng,
	}) {
	case game.PreFlopBet3x:
		play = 3 * ante
	case game.PreFlopBet4x:
		play = 4 * ante
	default:
		switch strat.Flop(strategy.FlopCtx{
			Variant:    variant,
			Hole:       hole,
			Flop:       [3]cards.Card{board[0], board[1], board[2]},
			OtherHoles: otherHoles,
			RNG:        rng,
		}) {
		case game.FlopBet2x:
			play = 2 * ante
		default:
			if strat.River(strategy.RiverCtx{
				Variant:    variant,
				Hole:       hole,
				Board:      board,
				OtherHoles: otherHoles,
				RNG:        rng,
			}) == game.RiverFold {
				folded = true
			} else {
				play = ante
			}
		}
	}

	var hero7 [7]cards.Card
	hero7[0] = hole[0]
	hero7[1] = hole[1]
	copy(hero7[2:], board[:])
	heroHV := eval.Evaluate7(hero7)
	heroCat := heroHV.Category()

	var dealer7 [7]cards.Card
	dealer7[0] = dealer[0]
	dealer7[1] = dealer[1]
	copy(dealer7[2:], board[:])
	dealerHV := eval.Evaluate7(dealer7)
	dealerCat := dealerHV.Category()
	dealerQual := dealerCat >= eval.OnePair

	out := heroOutcome{
		PlayerCategory:  heroCat,
		DealerCategory:  dealerCat,
		DealerQualified: dealerQual,
		Folded:          folded,
	}

	if placeTrips {
		out.TripsNet = settleTrips(ante, heroCat, variant.Trips)
	}

	if folded {
		out.AnteNet = -ante
		out.BlindNet = -ante
		return out
	}

	switch {
	case heroHV > dealerHV:
		if dealerQual {
			out.AnteNet = ante
		}
		out.PlayNet = play
		if heroCat >= eval.Straight {
			out.BlindNet = settleBlind(ante, heroCat, variant.Blind)
		}
	case heroHV < dealerHV:
		// Per CA AG rules: when the dealer does not qualify, the Ante PUSHES
		// regardless of whether the player won, lost, or tied against the
		// dealer's hand. Only Play and Blind are resolved normally.
		if dealerQual {
			out.AnteNet = -ante
		}
		out.BlindNet = -ante
		out.PlayNet = -play
	}

	return out
}

func settleTrips(stake int64, cat eval.Category, pt paytables.TripsPayout) int64 {
	if stake <= 0 {
		return 0
	}
	var r paytables.Ratio
	switch cat {
	case eval.RoyalFlush:
		r = pt.Royal
	case eval.StraightFlush:
		r = pt.StraightFlush
	case eval.FourOfAKind:
		r = pt.FourOfAKind
	case eval.FullHouse:
		r = pt.FullHouse
	case eval.Flush:
		r = pt.Flush
	case eval.Straight:
		r = pt.Straight
	case eval.ThreeOfAKind:
		r = pt.ThreeOfAKind
	default:
		return -stake
	}
	return r.Apply(stake)
}

func settleBlind(stake int64, cat eval.Category, pt paytables.BlindPayout) int64 {
	switch cat {
	case eval.RoyalFlush:
		return pt.Royal.Apply(stake)
	case eval.StraightFlush:
		return pt.StraightFlush.Apply(stake)
	case eval.FourOfAKind:
		return pt.FourOfAKind.Apply(stake)
	case eval.FullHouse:
		return pt.FullHouse.Apply(stake)
	case eval.Flush:
		return pt.Flush.Apply(stake)
	case eval.Straight:
		return pt.Straight.Apply(stake)
	}
	return 0
}
