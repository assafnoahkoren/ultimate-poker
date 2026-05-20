// Command houseedge measures the UTH-02 house edge when the hero posts
// 1 Ante + 1 Blind + 1 Trips every hand, playing the rule-based optimal
// strategy. Results are reported under three denominators:
//
//	per-ante     -- the published convention (loss per 1 ante unit)
//	per-3-units  -- loss per round, divided by the 3 chips put down initially
//	per-hand     -- raw EV per hand, in ante units
//
// Usage:
//
//	go run ./cmd/houseedge --hands 10000000 --sizes 1,2,3,4,5,6
package main

import (
	"flag"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"ultimate-poker/internal/paytables"
	"ultimate-poker/internal/sim"
	"ultimate-poker/internal/strategy"
)

func main() {
	var (
		hands   = flag.Uint64("hands", 5_000_000, "hands per table-size cell")
		workers = flag.Int("workers", runtime.NumCPU(), "worker goroutines per cell")
		seed    = flag.Uint64("seed", 42, "base RNG seed")
		sizes   = flag.String("sizes", "1,2,3,4,5,6", "comma-separated table sizes")
	)
	flag.Parse()

	tableSizes, err := parseIntList(*sizes)
	if err != nil {
		fail("parsing --sizes: %v", err)
	}
	if len(tableSizes) == 0 {
		fail("no table sizes given")
	}

	variant := paytables.UTH02
	factory := strategy.Optimal()
	// AnteUnit=100 keeps fractional payouts (e.g. 3:2 Blind on Flush) as exact
	// integers so accumulation is loss-free.
	const anteUnit int64 = 100

	fmt.Printf("UTH-02 house edge with Ante=1, Blind=1, Trips=1, strategy=optimal\n")
	fmt.Printf("  hands/cell: %s   workers: %d   seed: %d\n\n",
		fmtBig(*hands), *workers, *seed)

	header := fmt.Sprintf("%-5s %12s | %9s %9s %9s %9s | %10s %12s %12s",
		"size",
		"hands",
		"ante%",
		"blind%",
		"play%",
		"trips%",
		"EV/hand",
		"edge/ante%",
		"edge/3-unit%")
	fmt.Println(header)
	fmt.Println(strings.Repeat("-", len(header)))

	overallStart := time.Now()
	for _, n := range tableSizes {
		cfg := sim.Config{
			Hands:      *hands,
			Workers:    *workers,
			Variant:    variant,
			Factory:    factory,
			Seed:       *seed + uint64(n)*101,
			NumPlayers: n,
			AnteUnit:   anteUnit,
			PlaceTrips: true,
		}

		stats, _ := sim.Run(cfg, nil)

		// All net figures are in raw chip units (anteUnit-scaled). Convert to
		// "ante units" by dividing by anteUnit so percentages match published
		// UTH analyses (which all express edge per 1 ante).
		hf := float64(stats.Hands)
		au := float64(anteUnit)

		anteEVPerHand := float64(stats.AnteNet) / hf / au
		blindEVPerHand := float64(stats.BlindNet) / hf / au
		playEVPerHand := float64(stats.PlayNet) / hf / au
		tripsEVPerHand := float64(stats.TripsNet) / hf / au
		totalEVPerHand := anteEVPerHand + blindEVPerHand + playEVPerHand + tripsEVPerHand

		edgePerAnte := -totalEVPerHand * 100
		edgePer3Unit := -totalEVPerHand / 3.0 * 100

		fmt.Printf("%-5d %12s | %+9.4f %+9.4f %+9.4f %+9.4f | %+10.5f %+12.4f %+12.4f\n",
			n,
			fmtBig(stats.Hands),
			anteEVPerHand*100,
			blindEVPerHand*100,
			playEVPerHand*100,
			tripsEVPerHand*100,
			totalEVPerHand,
			edgePerAnte,
			edgePer3Unit,
		)
	}

	fmt.Printf("\nTotal wall time: %s\n", time.Since(overallStart).Round(time.Millisecond))
	fmt.Println()
	fmt.Println("Reading the columns:")
	fmt.Println("  ante%/blind%/play%/trips%  -- per-bet EV per hand, as % of ante (signed; negative = house wins)")
	fmt.Println("  EV/hand                    -- net result per hand in ante units (sum of the four columns / 100)")
	fmt.Println("  edge/ante%                 -- house edge per ante unit posted (standard UTH convention)")
	fmt.Println("  edge/3-unit%               -- house edge per 3 chips initially put down (ante+blind+trips)")
}

func parseIntList(s string) ([]int, error) {
	var out []int
	for _, p := range strings.Split(s, ",") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		v, err := strconv.Atoi(p)
		if err != nil {
			return nil, fmt.Errorf("bad int %q: %w", p, err)
		}
		out = append(out, v)
	}
	return out, nil
}

func fmtBig(n uint64) string {
	s := strconv.FormatUint(n, 10)
	out := make([]byte, 0, len(s)+len(s)/3)
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, byte(ch))
	}
	return string(out)
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format+"\n", args...)
	os.Exit(1)
}
