// Command uth runs an interactive Ultimate Texas Hold'em table where one user
// controls all seats against the dealer.
package main

import (
	"bufio"
	"fmt"
	"math/rand/v2"
	"os"
	"strconv"
	"strings"
	"time"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/equity"
	"ultimate-poker/internal/game"
	"ultimate-poker/internal/paytables"
)

const equityTrials = 3000

func main() {
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 0, 1024), 1024*1024)

	fmt.Println("=== Ultimate Texas Hold'em ===")
	fmt.Println()

	variant := paytables.UTH02
	fmt.Printf("Paytable: %s\n", variant.ID)
	numPlayers := promptInt(in, "Number of players", 2)
	if numPlayers < 1 || numPlayers > 9 {
		fmt.Println("number of players must be 1..9")
		os.Exit(1)
	}
	startBank := promptInt64(in, "Starting bankroll per player", 1000)
	const fixedAnte int64 = 5
	const fixedTrips int64 = 0
	fmt.Printf("Ante (Blind matches): %d   Trips: %d\n", fixedAnte, fixedTrips)

	banks := make([]int64, numPlayers)
	for i := range banks {
		banks[i] = startBank
	}

	rng := rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0xC0FFEE))
	handNum := 0

	fmt.Println()
	fmt.Println("Equity legend:")
	fmt.Println("  solo  = win% vs a random dealer; treats every unseen card as unknown")
	fmt.Println("  table = same, but removes the other players' hole cards from the dealer's pool")

	for {
		handNum++
		fmt.Printf("\n========== Hand %d ==========\n", handNum)
		printBankrolls(banks)

		antes := make([]int64, numPlayers)
		trips := make([]int64, numPlayers)
		for i := 0; i < numPlayers; i++ {
			antes[i] = fixedAnte
			trips[i] = fixedTrips
		}

		h, err := game.NewHand(variant, antes, trips, rng)
		if err != nil {
			fmt.Println("error:", err)
			continue
		}

		fmt.Println("\n--- Hole cards ---")
		for _, p := range h.Players {
			fmt.Printf("  Player %d: %s %s\n", p.ID+1, p.Hole[0], p.Hole[1])
		}

		// Pre-flop round.
		fmt.Println("\n--- Pre-flop ---")
		for _, id := range h.PendingAt(game.DecidePreFlop) {
			p := h.Players[id]
			fmt.Printf("  Player %d [%s %s]\n", p.ID+1, p.Hole[0], p.Hole[1])
			showEquity(p.Hole, nil, otherHoleCards(h, id), rng)
			a := promptPreFlop(in)
			if err := h.SubmitPreFlop(id, a); err != nil {
				fmt.Println("error:", err)
				return
			}
			if a != game.PreFlopCheck {
				fmt.Printf("    -> %s (Play=%d)\n", a, p.Play)
			}
		}

		// Flop round (only if anyone is still pending).
		flop := h.Flop()
		fmt.Printf("\n--- Flop: %s %s %s ---\n", flop[0], flop[1], flop[2])
		flopPending := h.PendingAt(game.DecideFlop)
		if len(flopPending) == 0 {
			fmt.Println("  (no one to act)")
		}
		for _, id := range flopPending {
			p := h.Players[id]
			fmt.Printf("  Player %d [%s %s] + board [%s %s %s]\n",
				p.ID+1, p.Hole[0], p.Hole[1], flop[0], flop[1], flop[2])
			showEquity(p.Hole, []cards.Card{flop[0], flop[1], flop[2]}, otherHoleCards(h, id), rng)
			a := promptFlop(in)
			if err := h.SubmitFlop(id, a); err != nil {
				fmt.Println("error:", err)
				return
			}
			if a != game.FlopCheck {
				fmt.Printf("    -> %s (Play=%d)\n", a, p.Play)
			}
		}

		// River round.
		fmt.Printf("\n--- Turn: %s   River: %s ---\n", h.Turn(), h.River())
		riverPending := h.PendingAt(game.DecideRiver)
		if len(riverPending) == 0 {
			fmt.Println("  (no one to act)")
		}
		for _, id := range riverPending {
			p := h.Players[id]
			board := h.Board
			fmt.Printf("  Player %d [%s %s] + board [%s %s %s %s %s]\n",
				p.ID+1, p.Hole[0], p.Hole[1],
				board[0], board[1], board[2], board[3], board[4])
			showEquity(p.Hole, board[:], otherHoleCards(h, id), rng)
			a := promptRiver(in)
			if err := h.SubmitRiver(id, a); err != nil {
				fmt.Println("error:", err)
				return
			}
			fmt.Printf("    -> %s\n", a)
		}

		// Showdown.
		outs, err := h.Settle()
		if err != nil {
			fmt.Println("error:", err)
			return
		}
		fmt.Println("\n--- Showdown ---")
		fmt.Printf("  Dealer: %s %s\n", h.Dealer[0], h.Dealer[1])
		fmt.Printf("  Board:  %s %s %s | %s | %s\n",
			h.Board[0], h.Board[1], h.Board[2], h.Board[3], h.Board[4])
		fmt.Printf("  Dealer hand: %s%s\n", outs[0].DealerCategory, qualMark(outs[0].DealerQualified))

		fmt.Println()
		fmt.Println("  Player results:")
		for _, o := range outs {
			tag := o.PlayerCategory.String()
			if o.Folded {
				tag = "folded"
			}
			banks[o.PlayerID] += o.TotalNet
			fmt.Printf("    P%d  hand=%-15s  ante=%+d  blind=%+d  play=%+d  trips=%+d  total=%+d  bank=%d\n",
				o.PlayerID+1, tag,
				o.AnteNet, o.BlindNet, o.PlayNet, o.TripsNet, o.TotalNet,
				banks[o.PlayerID])
		}

		again := promptString(in, "\nAnother hand? (y/n)", "y")
		if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(again)), "y") {
			break
		}
	}

	fmt.Println("\nFinal bankrolls:")
	printBankrolls(banks)
}

func otherHoleCards(h *game.Hand, exceptID int) []cards.Card {
	out := make([]cards.Card, 0, 2*(len(h.Players)-1))
	for _, p := range h.Players {
		if p.ID == exceptID {
			continue
		}
		out = append(out, p.Hole[0], p.Hole[1])
	}
	return out
}

func showEquity(hole [2]cards.Card, board, otherHoles []cards.Card, rng *rand.Rand) {
	solo := equity.Compute(hole, board, nil, equityTrials, rng)
	table := equity.Compute(hole, board, otherHoles, equityTrials, rng)
	fmt.Printf("    solo:  win %5.1f%%  tie %4.1f%%  lose %5.1f%%  (n=%d)\n",
		solo.Win*100, solo.Tie*100, solo.Lose*100, solo.Trials)
	if len(otherHoles) == 0 {
		return
	}
	fmt.Printf("    table: win %5.1f%%  tie %4.1f%%  lose %5.1f%%  (n=%d)\n",
		table.Win*100, table.Tie*100, table.Lose*100, table.Trials)
}

func qualMark(q bool) string {
	if q {
		return ""
	}
	return " (does not qualify)"
}

func printBankrolls(banks []int64) {
	parts := make([]string, len(banks))
	for i, b := range banks {
		parts[i] = fmt.Sprintf("P%d=%d", i+1, b)
	}
	fmt.Println("  bankrolls:", strings.Join(parts, "  "))
}

// --- prompts ---

func readLine(in *bufio.Scanner) string {
	if !in.Scan() {
		return ""
	}
	return strings.TrimSpace(in.Text())
}

func promptString(in *bufio.Scanner, label, def string) string {
	fmt.Printf("%s [%s]: ", label, def)
	s := readLine(in)
	if s == "" {
		return def
	}
	return s
}

func promptInt(in *bufio.Scanner, label string, def int) int {
	for {
		fmt.Printf("%s [%d]: ", label, def)
		s := readLine(in)
		if s == "" {
			return def
		}
		v, err := strconv.Atoi(s)
		if err == nil {
			return v
		}
		fmt.Println("  please enter an integer")
	}
}

func promptInt64(in *bufio.Scanner, label string, def int64) int64 {
	for {
		fmt.Printf("%s [%d]: ", label, def)
		s := readLine(in)
		if s == "" {
			return def
		}
		v, err := strconv.ParseInt(s, 10, 64)
		if err == nil {
			return v
		}
		fmt.Println("  please enter an integer")
	}
}

func promptPreFlop(in *bufio.Scanner) game.PreFlopAction {
	for {
		fmt.Print("    action [c]heck, [3]x bet, [4]x bet: ")
		s := strings.ToLower(readLine(in))
		switch s {
		case "", "c", "check":
			return game.PreFlopCheck
		case "3", "3x":
			return game.PreFlopBet3x
		case "4", "4x":
			return game.PreFlopBet4x
		}
		fmt.Println("    invalid; choose c, 3, or 4")
	}
}

func promptFlop(in *bufio.Scanner) game.FlopAction {
	for {
		fmt.Print("    action [c]heck, [b]et 2x: ")
		s := strings.ToLower(readLine(in))
		switch s {
		case "", "c", "check":
			return game.FlopCheck
		case "b", "2", "2x", "bet":
			return game.FlopBet2x
		}
		fmt.Println("    invalid; choose c or b")
	}
}

func promptRiver(in *bufio.Scanner) game.RiverAction {
	for {
		fmt.Print("    action [f]old, [b]et 1x: ")
		s := strings.ToLower(readLine(in))
		switch s {
		case "f", "fold":
			return game.RiverFold
		case "", "b", "1", "1x", "bet":
			return game.RiverBet1x
		}
		fmt.Println("    invalid; choose f or b")
	}
}

