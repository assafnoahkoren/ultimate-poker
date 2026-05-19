// Package equity computes the win/tie/lose probability for a player vs a
// single dealer in Ultimate Texas Hold'em, given the cards currently known.
//
// When all 5 board cards are known, the result is exact (enumerates the 990 or
// so possible dealer hole-card combinations). Otherwise it runs a Monte Carlo
// simulation with the requested number of trials.
package equity

import (
	"math/rand/v2"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
)

// Result reports win/tie/lose probabilities. Trials is the number of dealer
// scenarios sampled (or fully enumerated, when the board is complete).
type Result struct {
	Win    float64
	Tie    float64
	Lose   float64
	Trials int
}

// Compute returns the hero's win probability against a single dealer.
//
//   - hole: the hero's two hole cards.
//   - board: 0, 3, 4, or 5 community cards already revealed.
//   - removed: other cards known to be out of the deck (e.g., other players'
//     hole cards in a multi-seat table).
//   - trials: Monte Carlo iteration count. Ignored when len(board) == 5.
//   - rng: shared RNG (per-goroutine; not safe for concurrent use).
func Compute(
	hole [2]cards.Card,
	board []cards.Card,
	removed []cards.Card,
	trials int,
	rng *rand.Rand,
) Result {
	pool := buildPool(hole, board, removed)
	if len(board) == 5 {
		return enumerateRiver(hole, [5]cards.Card{board[0], board[1], board[2], board[3], board[4]}, pool)
	}
	return monteCarlo(hole, board, pool, trials, rng)
}

func buildPool(hole [2]cards.Card, board, removed []cards.Card) []cards.Card {
	var inDeck [cards.DeckSize]bool
	for i := range inDeck {
		inDeck[i] = true
	}
	inDeck[hole[0]] = false
	inDeck[hole[1]] = false
	for _, c := range board {
		inDeck[c] = false
	}
	for _, c := range removed {
		inDeck[c] = false
	}
	pool := make([]cards.Card, 0, cards.DeckSize)
	for i := 0; i < cards.DeckSize; i++ {
		if inDeck[i] {
			pool = append(pool, cards.Card(i))
		}
	}
	return pool
}

func enumerateRiver(hole [2]cards.Card, board [5]cards.Card, pool []cards.Card) Result {
	var hero7, villain7 [7]cards.Card
	hero7[0] = hole[0]
	hero7[1] = hole[1]
	copy(hero7[2:], board[:])
	heroHV := eval.Evaluate7(hero7)
	copy(villain7[2:], board[:])

	var wins, ties, losses int
	for i := 0; i < len(pool); i++ {
		for j := i + 1; j < len(pool); j++ {
			villain7[0] = pool[i]
			villain7[1] = pool[j]
			villainHV := eval.Evaluate7(villain7)
			switch {
			case heroHV > villainHV:
				wins++
			case heroHV < villainHV:
				losses++
			default:
				ties++
			}
		}
	}
	total := wins + ties + losses
	if total == 0 {
		return Result{}
	}
	return Result{
		Win:    float64(wins) / float64(total),
		Tie:    float64(ties) / float64(total),
		Lose:   float64(losses) / float64(total),
		Trials: total,
	}
}

func monteCarlo(hole [2]cards.Card, board []cards.Card, pool []cards.Card, trials int, rng *rand.Rand) Result {
	var hero7, villain7 [7]cards.Card
	hero7[0] = hole[0]
	hero7[1] = hole[1]
	for i, c := range board {
		hero7[2+i] = c
		villain7[2+i] = c
	}
	boardOffset := 2 + len(board)
	needBoard := 5 - len(board)
	needed := 2 + needBoard

	// Work on a mutable copy of the pool; partial Fisher-Yates per trial.
	p := make([]cards.Card, len(pool))
	copy(p, pool)

	var wins, ties, losses int
	for t := 0; t < trials; t++ {
		for i := 0; i < needed; i++ {
			j := i + rng.IntN(len(p)-i)
			p[i], p[j] = p[j], p[i]
		}
		villain7[0] = p[0]
		villain7[1] = p[1]
		for i := 0; i < needBoard; i++ {
			hero7[boardOffset+i] = p[2+i]
			villain7[boardOffset+i] = p[2+i]
		}
		heroHV := eval.Evaluate7(hero7)
		villainHV := eval.Evaluate7(villain7)
		switch {
		case heroHV > villainHV:
			wins++
		case heroHV < villainHV:
			losses++
		default:
			ties++
		}
	}
	total := wins + ties + losses
	if total == 0 {
		return Result{}
	}
	return Result{
		Win:    float64(wins) / float64(total),
		Tie:    float64(ties) / float64(total),
		Lose:   float64(losses) / float64(total),
		Trials: total,
	}
}
