// Command strategysim runs the strategy-comparison campaign across multiple
// UTH strategies and table sizes, writing per-cell results to a CSV.
//
// Usage:
//
//	go run ./cmd/strategysim --hands 10000000 --output results.csv
//
// Flags:
//
//	--hands N    hands per (strategy, table-size) cell
//	--output F   path to CSV results file
//	--workers W  worker goroutines per cell (default: runtime.NumCPU())
//	--seed S     base RNG seed
//	--sizes      comma-separated list of table sizes to sweep (default: 1,2,3,4,5,6)
//	--strats     comma-separated subset of strategies (default: all four)
package main

import (
	"encoding/csv"
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

type strategyEntry struct {
	Name    string
	Factory strategy.Factory
}

var allStrategies = []strategyEntry{
	{"always-check", strategy.AlwaysCheck()},
	{"always-4x", strategy.Always4x()},
	{"optimal", strategy.Optimal()},
	{"optimal-table", strategy.OptimalTable()},
	{"ev-optimal", strategy.EVOptimal()},
	{"ev-optimal-table", strategy.EVOptimalTable()},
}

func main() {
	var (
		hands   = flag.Uint64("hands", 10_000_000, "hands per (strategy, table-size) cell")
		output  = flag.String("output", "results.csv", "CSV output file")
		workers = flag.Int("workers", runtime.NumCPU(), "worker goroutines per cell")
		seed    = flag.Uint64("seed", 42, "base RNG seed")
		sizes   = flag.String("sizes", "1,2,3,4,5,6", "comma-separated table sizes")
		strats  = flag.String("strats", "", "comma-separated strategy subset (default: all)")
	)
	flag.Parse()

	tableSizes, err := parseIntList(*sizes)
	if err != nil {
		fail("parsing --sizes: %v", err)
	}
	if len(tableSizes) == 0 {
		fail("no table sizes given")
	}

	strategies := allStrategies
	if *strats != "" {
		strategies, err = pickStrategies(*strats)
		if err != nil {
			fail("parsing --strats: %v", err)
		}
	}

	variant := paytables.UTH02

	totalCells := len(strategies) * len(tableSizes)
	totalHands := uint64(totalCells) * *hands

	f, err := os.Create(*output)
	if err != nil {
		fail("creating output: %v", err)
	}
	defer f.Close()
	w := csv.NewWriter(f)
	defer w.Flush()
	if err := w.Write([]string{
		"strategy", "table_size", "hands",
		"ante_net", "blind_net", "play_net", "trips_net", "total_net",
		"ev_per_ante", "house_edge_pct",
		"fold_rate", "dealer_qual_rate",
		"elapsed_sec", "hands_per_sec",
	}); err != nil {
		fail("writing header: %v", err)
	}
	w.Flush()

	fmt.Printf("UTH strategy campaign\n")
	fmt.Printf("  variant: %s   hands/cell: %s   total hands: %s\n",
		variant.ID, fmtBig(*hands), fmtBig(totalHands))
	fmt.Printf("  strategies: %s\n", strategyNames(strategies))
	fmt.Printf("  table sizes: %v\n", tableSizes)
	fmt.Printf("  workers: %d   seed: %d\n", *workers, *seed)
	fmt.Printf("  output: %s\n\n", *output)

	overallStart := time.Now()
	cellNum := 0
	for _, sd := range strategies {
		for _, n := range tableSizes {
			cellNum++
			fmt.Printf("[%d/%d] strategy=%-13s table_size=%d  hands=%s\n",
				cellNum, totalCells, sd.Name, n, fmtBig(*hands))

			// AnteUnit = 100 so that fractional payouts like the 3:2 Blind on a
			// Flush (1.5 ante) are exact integers (150) and don't truncate.
			const anteUnit = 100
			cfg := sim.Config{
				Hands:      *hands,
				Workers:    *workers,
				Variant:    variant,
				Factory:    sd.Factory,
				Seed:       *seed + uint64(cellNum)*101,
				NumPlayers: n,
				AnteUnit:   anteUnit,
				PlaceTrips: false,
			}

			cellStart := time.Now()
			stats, _ := sim.Run(cfg, func(done, total uint64) {
				elapsed := time.Since(cellStart).Seconds()
				if elapsed <= 0 || done == 0 {
					return
				}
				rate := float64(done) / elapsed
				pct := 100.0 * float64(done) / float64(total)
				etaSec := float64(total-done) / rate
				fmt.Printf("\r  %5.1f%%  %s / %s  (%.0fk/s, ETA %s)        ",
					pct, fmtBig(done), fmtBig(total), rate/1000,
					time.Duration(etaSec*float64(time.Second)).Round(time.Second))
			})
			elapsed := time.Since(cellStart)
			rate := float64(stats.Hands) / elapsed.Seconds()

			fmt.Printf("\r  done in %-12s  %.0fk hands/sec               \n",
				elapsed.Round(time.Millisecond), rate/1000)

			total := stats.TotalNet()
			// EVPerAnte is in raw units; divide by anteUnit for ante-relative EV.
			evPerAnte := stats.EVPerAnte() / float64(anteUnit)
			fmt.Printf("    EV/ante=%+.5f  house_edge=%+.3f%%  fold=%.2f%%  dealer_qual=%.2f%%\n\n",
				evPerAnte, -evPerAnte*100,
				100*float64(stats.Folds)/float64(stats.Hands),
				100*float64(stats.DealerQual)/float64(stats.Hands))

			row := []string{
				sd.Name,
				strconv.Itoa(n),
				strconv.FormatUint(stats.Hands, 10),
				strconv.FormatInt(stats.AnteNet, 10),
				strconv.FormatInt(stats.BlindNet, 10),
				strconv.FormatInt(stats.PlayNet, 10),
				strconv.FormatInt(stats.TripsNet, 10),
				strconv.FormatInt(total, 10),
				fmt.Sprintf("%.6f", evPerAnte),
				fmt.Sprintf("%.4f", -evPerAnte*100),
				fmt.Sprintf("%.4f", float64(stats.Folds)/float64(stats.Hands)),
				fmt.Sprintf("%.4f", float64(stats.DealerQual)/float64(stats.Hands)),
				fmt.Sprintf("%.2f", elapsed.Seconds()),
				fmt.Sprintf("%.0f", rate),
			}
			if err := w.Write(row); err != nil {
				fail("writing row: %v", err)
			}
			w.Flush()
		}
	}

	fmt.Printf("All %d cells done. Total wall time: %s\n",
		totalCells, time.Since(overallStart).Round(time.Second))
	fmt.Printf("Results written to %s\n", *output)
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

func pickStrategies(spec string) ([]strategyEntry, error) {
	want := map[string]bool{}
	for _, p := range strings.Split(spec, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			want[p] = true
		}
	}
	var out []strategyEntry
	for _, s := range allStrategies {
		if want[s.Name] {
			out = append(out, s)
			delete(want, s.Name)
		}
	}
	if len(want) > 0 {
		var unknown []string
		for k := range want {
			unknown = append(unknown, k)
		}
		return nil, fmt.Errorf("unknown strategies: %s (known: %s)",
			strings.Join(unknown, ", "),
			strategyNames(allStrategies))
	}
	return out, nil
}

func strategyNames(s []strategyEntry) string {
	names := make([]string, len(s))
	for i, e := range s {
		names[i] = e.Name
	}
	return strings.Join(names, ", ")
}

func fmtBig(n uint64) string {
	s := strconv.FormatUint(n, 10)
	// Insert commas every three digits from the right.
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
