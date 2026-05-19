package eval

import (
	"testing"

	"ultimate-poker/internal/cards"
)

func mk(rank, suit int) cards.Card { return cards.New(rank, suit) }

// Rank shortcuts: 0=2, 1=3, ..., 8=T, 9=J, 10=Q, 11=K, 12=A
// Suit shortcuts: 0=c, 1=d, 2=h, 3=s

func TestEvaluate5_Categories(t *testing.T) {
	tests := []struct {
		name string
		hand [5]cards.Card
		want Category
	}{
		{"royal flush", [5]cards.Card{mk(12, 3), mk(11, 3), mk(10, 3), mk(9, 3), mk(8, 3)}, RoyalFlush},
		{"straight flush 9-high", [5]cards.Card{mk(7, 0), mk(6, 0), mk(5, 0), mk(4, 0), mk(3, 0)}, StraightFlush},
		{"wheel straight flush", [5]cards.Card{mk(12, 1), mk(0, 1), mk(1, 1), mk(2, 1), mk(3, 1)}, StraightFlush},
		{"four of a kind", [5]cards.Card{mk(12, 0), mk(12, 1), mk(12, 2), mk(12, 3), mk(0, 0)}, FourOfAKind},
		{"full house", [5]cards.Card{mk(8, 0), mk(8, 1), mk(8, 2), mk(3, 0), mk(3, 1)}, FullHouse},
		{"flush", [5]cards.Card{mk(12, 2), mk(10, 2), mk(7, 2), mk(3, 2), mk(0, 2)}, Flush},
		{"straight ace-high", [5]cards.Card{mk(12, 0), mk(11, 1), mk(10, 2), mk(9, 3), mk(8, 0)}, Straight},
		{"wheel straight", [5]cards.Card{mk(12, 0), mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 0)}, Straight},
		{"three of a kind", [5]cards.Card{mk(7, 0), mk(7, 1), mk(7, 2), mk(2, 0), mk(0, 0)}, ThreeOfAKind},
		{"two pair", [5]cards.Card{mk(12, 0), mk(12, 1), mk(3, 0), mk(3, 1), mk(0, 0)}, TwoPair},
		{"one pair", [5]cards.Card{mk(12, 0), mk(12, 1), mk(7, 0), mk(3, 0), mk(0, 0)}, OnePair},
		{"high card", [5]cards.Card{mk(12, 0), mk(10, 1), mk(7, 2), mk(3, 3), mk(0, 0)}, HighCard},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := evaluate5(tc.hand).Category()
			if got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestEvaluate5_Ordering(t *testing.T) {
	// Higher categories beat lower categories.
	royalFlush := [5]cards.Card{mk(12, 3), mk(11, 3), mk(10, 3), mk(9, 3), mk(8, 3)}
	fourAces := [5]cards.Card{mk(12, 0), mk(12, 1), mk(12, 2), mk(12, 3), mk(0, 0)}
	if evaluate5(royalFlush) <= evaluate5(fourAces) {
		t.Fatal("royal flush should beat four of a kind")
	}

	// Higher kicker breaks tie.
	pairAcesK := [5]cards.Card{mk(12, 0), mk(12, 1), mk(11, 0), mk(7, 0), mk(2, 0)}
	pairAcesQ := [5]cards.Card{mk(12, 0), mk(12, 1), mk(10, 0), mk(7, 0), mk(2, 0)}
	if evaluate5(pairAcesK) <= evaluate5(pairAcesQ) {
		t.Fatal("pair of aces with K kicker should beat pair of aces with Q kicker")
	}

	// Wheel straight is the lowest straight (5-high), beaten by 6-high.
	wheel := [5]cards.Card{mk(12, 0), mk(0, 1), mk(1, 2), mk(2, 3), mk(3, 0)}
	sixHigh := [5]cards.Card{mk(4, 0), mk(3, 1), mk(2, 2), mk(1, 3), mk(0, 0)}
	if evaluate5(wheel) >= evaluate5(sixHigh) {
		t.Fatal("wheel should lose to 6-high straight")
	}
}

func TestEvaluate7(t *testing.T) {
	// 7 cards: AsKs Qs Js 9s 5d 2c → A-high flush in spades.
	seven := [7]cards.Card{
		mk(12, 3), mk(11, 3), mk(10, 3), mk(9, 3), mk(7, 3),
		mk(3, 1), mk(0, 0),
	}
	if got := Evaluate7(seven).Category(); got != Flush {
		t.Fatalf("got %v, want Flush", got)
	}

	// 7 cards with a royal: As Ks Qs Js Ts 5d 2c
	royal := [7]cards.Card{
		mk(12, 3), mk(11, 3), mk(10, 3), mk(9, 3), mk(8, 3),
		mk(3, 1), mk(0, 0),
	}
	if got := Evaluate7(royal).Category(); got != RoyalFlush {
		t.Fatalf("got %v, want RoyalFlush", got)
	}
}
