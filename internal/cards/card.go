// Package cards defines a poker card representation, a 52-card deck, and shuffling.
//
// Card is a packed uint8 where rank = c/4 (0..12 for 2..A) and suit = c%4 (0..3).
package cards

const (
	NumRanks = 13
	NumSuits = 4
	DeckSize = 52
)

// Card encodes a single playing card.
type Card uint8

// New builds a card from rank (0..12, where 0=2 and 12=A) and suit (0..3).
func New(rank, suit int) Card { return Card(rank*4 + suit) }

// Rank returns 0..12 (0=2, 12=A).
func (c Card) Rank() int { return int(c) / 4 }

// Suit returns 0..3.
func (c Card) Suit() int { return int(c) % 4 }

var (
	rankRunes   = []rune("23456789TJQKA")
	suitSymbols = []rune("♣♦♥♠")
	suitLetters = []rune("cdhs")
)

// String returns a human-friendly representation like "A♠".
func (c Card) String() string {
	return string(rankRunes[c.Rank()]) + string(suitSymbols[c.Suit()])
}

// Short returns an ASCII representation like "As".
func (c Card) Short() string {
	return string(rankRunes[c.Rank()]) + string(suitLetters[c.Suit()])
}

// RankRune returns the rune for a rank (0..12).
func RankRune(rank int) rune { return rankRunes[rank] }
