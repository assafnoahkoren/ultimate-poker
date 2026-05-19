// Command equitysim measures how much "table" equity (where we remove the
// other players' hole cards from the dealer's possible pool) differs from
// "solo" equity (where we treat all unseen cards as unknown).
//
// For each table size and game phase, it samples many random hands, computes
// both equities for the hero (seat 0), and reports:
//
//	bias    = mean(solo - table)            -- systematic offset
//	std     = stddev(solo - table)          -- spread, including MC noise
//	|Δ|mean = mean(|solo - table|)          -- typical shift magnitude
//	|Δ|max  = max(|solo - table|)           -- worst single-hand shift
//
// MC noise contributes ~sqrt(2) * 1/sqrt(trials) to std on its own, so for
// preflop/flop the smallest detectable effect is roughly that floor. River
// numbers are exact enumerations (no MC noise).
package main

import (
	"fmt"
	"math"
	"math/rand/v2"
	"runtime"
	"sync"
	"time"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/equity"
)

const (
	samplesPerCell = 300
	mcTrials       = 3000
)

type phase struct {
	name       string
	boardCount int
}

var phases = []phase{
	{"preflop", 0},
	{"flop", 3},
	{"river", 5},
}

var tableSizes = []int{2, 3, 4, 5, 6}

func main() {
	start := time.Now()
	workers := runtime.NumCPU()

	fmt.Printf("Equity comparison: solo (no other-hole info) vs table (other holes removed)\n")
	fmt.Printf("Samples per cell: %d   MC trials per equity: %d   Workers: %d\n",
		samplesPerCell, mcTrials, workers)
	fmt.Printf("MC noise floor on std(Δ) at this trial count: ~%.2f%%\n\n",
		100*math.Sqrt(2.0/float64(mcTrials)*0.25)) // sqrt(2 * p(1-p)/n) with p≈0.5

	header := fmt.Sprintf("%-5s %-8s %5s | %7s %7s | %+7s %7s %7s %7s",
		"size", "phase", "n", "soloW%", "tableW%", "bias%", "std%", "|Δ|mean", "|Δ|max")
	fmt.Println(header)
	fmt.Println(repeat("-", len(header)))

	for _, n := range tableSizes {
		for _, ph := range phases {
			res := runCell(n, ph, samplesPerCell, mcTrials, workers)
			fmt.Printf("%-5d %-8s %5d | %7.2f %7.2f | %+7.3f %7.3f %7.3f %7.3f\n",
				n, ph.name, res.samples,
				res.meanSolo*100, res.meanTable*100,
				res.bias*100, res.std*100,
				res.meanAbs*100, res.max*100)
		}
		fmt.Println()
	}

	fmt.Printf("Total wall time: %s\n", time.Since(start).Round(time.Millisecond))
}

type cellResult struct {
	samples                            int
	meanSolo, meanTable                float64
	bias, std, meanAbs, max            float64
}

func runCell(numPlayers int, ph phase, samples, trials, workers int) cellResult {
	perWorker := samples / workers
	actual := perWorker * workers

	type acc struct {
		sumSolo, sumTable     float64
		sumDiff, sumDiffSq    float64
		sumAbs                float64
		max                   float64
		n                     int
	}

	results := make([]acc, workers)
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			rng := rand.New(rand.NewPCG(
				0xA11CE+uint64(numPlayers)*131+uint64(ph.boardCount),
				uint64(workerID)+1,
			))
			var a acc
			for i := 0; i < perWorker; i++ {
				hero, others, board := sampleHand(rng, numPlayers, ph.boardCount)
				solo := equity.Compute(hero, board, nil, trials, rng)
				table := equity.Compute(hero, board, others, trials, rng)
				diff := solo.Win - table.Win
				abs := math.Abs(diff)
				a.sumSolo += solo.Win
				a.sumTable += table.Win
				a.sumDiff += diff
				a.sumDiffSq += diff * diff
				a.sumAbs += abs
				if abs > a.max {
					a.max = abs
				}
				a.n++
			}
			results[workerID] = a
		}(w)
	}
	wg.Wait()

	var t acc
	for _, r := range results {
		t.sumSolo += r.sumSolo
		t.sumTable += r.sumTable
		t.sumDiff += r.sumDiff
		t.sumDiffSq += r.sumDiffSq
		t.sumAbs += r.sumAbs
		if r.max > t.max {
			t.max = r.max
		}
		t.n += r.n
	}

	n := float64(t.n)
	meanDiff := t.sumDiff / n
	varDiff := t.sumDiffSq/n - meanDiff*meanDiff
	if varDiff < 0 {
		varDiff = 0
	}
	_ = actual
	return cellResult{
		samples:   t.n,
		meanSolo:  t.sumSolo / n,
		meanTable: t.sumTable / n,
		bias:      meanDiff,
		std:       math.Sqrt(varDiff),
		meanAbs:   t.sumAbs / n,
		max:       t.max,
	}
}

func sampleHand(rng *rand.Rand, numPlayers, boardCount int) (hero [2]cards.Card, others, board []cards.Card) {
	deck := cards.NewDeck()
	deck.Shuffle(rng)
	hero[0] = deck.Draw()
	hero[1] = deck.Draw()
	others = make([]cards.Card, 0, 2*(numPlayers-1))
	for i := 0; i < numPlayers-1; i++ {
		others = append(others, deck.Draw(), deck.Draw())
	}
	board = make([]cards.Card, boardCount)
	for i := 0; i < boardCount; i++ {
		board[i] = deck.Draw()
	}
	return
}

func repeat(s string, n int) string {
	out := make([]byte, 0, len(s)*n)
	for i := 0; i < n; i++ {
		out = append(out, s...)
	}
	return string(out)
}
