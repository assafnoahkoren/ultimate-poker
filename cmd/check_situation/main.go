// One-off equity check for a specific UTH spot:
//   Hero:  6♦ 8♦
//   Flop:  8♣ T♥ J♠
//
// Reports hero's exact-enumeration equity by turn+river+dealer-hole-card combos.
package main

import (
	"fmt"
	"math/rand/v2"
	"time"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/equity"
)

func mk(rank, suit int) cards.Card { return cards.New(rank, suit) }

func main() {
	// Rank: 0=2 .. 8=T 9=J 10=Q 11=K 12=A
	// Suit: 0=♣ 1=♦ 2=♥ 3=♠
	hole := [2]cards.Card{mk(4, 1), mk(6, 1)}     // 6♦ 8♦
	flop := []cards.Card{mk(6, 0), mk(8, 2), mk(9, 3)} // 8♣ T♥ J♠

	fmt.Printf("Hero:  %s %s\n", hole[0], hole[1])
	fmt.Printf("Flop:  %s %s %s\n\n", flop[0], flop[1], flop[2])

	rng := rand.New(rand.NewPCG(uint64(time.Now().UnixNano()), 0xC0FFEE))

	// Use a large MC sample to nail down equity vs random dealer.
	const trials = 200_000
	start := time.Now()
	r := equity.Compute(hole, flop, nil, trials, rng)
	elapsed := time.Since(start)

	fmt.Printf("Equity at the flop vs a random dealer (Monte Carlo, n=%d)\n", r.Trials)
	fmt.Printf("  win  = %.2f%%\n", r.Win*100)
	fmt.Printf("  tie  = %.2f%%\n", r.Tie*100)
	fmt.Printf("  lose = %.2f%%\n", r.Lose*100)
	fmt.Printf("\nElapsed: %s\n", elapsed.Round(time.Millisecond))
}
