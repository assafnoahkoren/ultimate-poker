package strategy

import (
	"math/rand/v2"
	"runtime"
	"sync"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
)

// There are 169 distinct starting-hand classes in Hold'em:
//   - 13 pocket pairs
//   - 78 suited combos
//   - 78 offsuit combos
//
// We pack them into a 13×13 grid:
//   - On the diagonal (high == low): pocket pair
//   - Above the diagonal (high > low): suited combo
//   - Below the diagonal (low > high in cell, i.e., row=low, col=high): offsuit combo
// classIndex(high, low, suited) returns a unique index in [0, 169).

const preFlopTrialsPerClass = 50_000

var (
	preFlopEquity    [13 * 13]float64
	preFlopEquityErr error
	preFlopOnce      sync.Once
)

// classIndex maps a (high, low, suited) hand class to its grid index.
// For pairs (high == low), `suited` is ignored.
func classIndex(high, low int, suited bool) int {
	if high == low {
		return high*13 + low // diagonal
	}
	if suited {
		return high*13 + low // upper triangle (high > low)
	}
	return low*13 + high // lower triangle (offsuit)
}

func classIndexOfHole(hole [2]cards.Card) int {
	r1, r2 := hole[0].Rank(), hole[1].Rank()
	suited := hole[0].Suit() == hole[1].Suit()
	high, low := r1, r2
	if low > high {
		high, low = low, high
	}
	return classIndex(high, low, suited && high != low)
}

// PreFlopEquity returns the cached equity (P(win) + 0.5·P(tie)) for the given
// hole-card pair against one random opponent. Computes the full table lazily
// on first call (~5 seconds on 12 cores).
func PreFlopEquity(hole [2]cards.Card) float64 {
	EnsurePreFlopEquityTable()
	return preFlopEquity[classIndexOfHole(hole)]
}

// EnsurePreFlopEquityTable computes the 169-class equity table on first call.
func EnsurePreFlopEquityTable() {
	preFlopOnce.Do(func() {
		preFlopEquityErr = computePreFlopEquityTable()
	})
}

type classRep struct {
	idx  int
	hole [2]cards.Card
}

func allClassRepresentatives() []classRep {
	out := make([]classRep, 0, 169)
	for high := 0; high < 13; high++ {
		for low := 0; low <= high; low++ {
			if high == low {
				// Pocket pair: any two different suits work.
				out = append(out, classRep{
					idx:  classIndex(high, low, false),
					hole: [2]cards.Card{cards.New(high, 0), cards.New(high, 1)},
				})
				continue
			}
			// Suited: same suit.
			out = append(out, classRep{
				idx:  classIndex(high, low, true),
				hole: [2]cards.Card{cards.New(high, 0), cards.New(low, 0)},
			})
			// Offsuit: different suits.
			out = append(out, classRep{
				idx:  classIndex(high, low, false),
				hole: [2]cards.Card{cards.New(high, 0), cards.New(low, 1)},
			})
		}
	}
	return out
}

func computePreFlopEquityTable() error {
	classes := allClassRepresentatives()
	workers := runtime.NumCPU()
	if workers > len(classes) {
		workers = len(classes)
	}
	perWorker := (len(classes) + workers - 1) / workers

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		start := w * perWorker
		end := start + perWorker
		if end > len(classes) {
			end = len(classes)
		}
		if start >= end {
			continue
		}
		wg.Add(1)
		go func(workerID, start, end int) {
			defer wg.Done()
			rng := rand.New(rand.NewPCG(0xA11CEC1A55, uint64(workerID)+1))
			for i := start; i < end; i++ {
				preFlopEquity[classes[i].idx] = computeClassEquity(classes[i], preFlopTrialsPerClass, rng)
			}
		}(w, start, end)
	}
	wg.Wait()
	return nil
}

func computeClassEquity(c classRep, trials int, rng *rand.Rand) float64 {
	var pool [50]cards.Card
	np := 0
	for i := 0; i < 52; i++ {
		ci := cards.Card(i)
		if ci != c.hole[0] && ci != c.hole[1] {
			pool[np] = ci
			np++
		}
	}

	var hero7 [7]cards.Card
	hero7[0] = c.hole[0]
	hero7[1] = c.hole[1]
	var dealer7 [7]cards.Card

	wins, ties := 0, 0
	for t := 0; t < trials; t++ {
		// Partial Fisher-Yates: pick first 7 cards (2 dealer + 5 board).
		for i := 0; i < 7; i++ {
			j := i + rng.IntN(np-i)
			pool[i], pool[j] = pool[j], pool[i]
		}
		dealer7[0] = pool[0]
		dealer7[1] = pool[1]
		for i := 0; i < 5; i++ {
			hero7[2+i] = pool[2+i]
			dealer7[2+i] = pool[2+i]
		}
		hHV := eval.Evaluate7(hero7)
		dHV := eval.Evaluate7(dealer7)
		switch {
		case hHV > dHV:
			wins++
		case hHV == dHV:
			ties++
		}
	}
	return (float64(wins) + 0.5*float64(ties)) / float64(trials)
}
