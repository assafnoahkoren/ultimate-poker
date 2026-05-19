package eval

import (
	"math/rand/v2"
	"testing"

	"ultimate-poker/internal/cards"
)

func BenchmarkEvaluate7(b *testing.B) {
	rng := rand.New(rand.NewPCG(1, 1))
	deck := cards.NewDeck()
	deck.Shuffle(rng)
	var hand [7]cards.Card
	for i := 0; i < 7; i++ {
		hand[i] = deck.Cards[i]
	}
	b.ResetTimer()
	var sink HandValue
	for i := 0; i < b.N; i++ {
		sink = Evaluate7(hand)
	}
	_ = sink
}
