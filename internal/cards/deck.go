package cards

import "math/rand/v2"

// Deck is a 52-card deck with an internal draw cursor.
type Deck struct {
	Cards [DeckSize]Card
	pos   int
}

// NewDeck returns a fresh ordered deck.
func NewDeck() *Deck {
	d := &Deck{}
	for r := 0; r < NumRanks; r++ {
		for s := 0; s < NumSuits; s++ {
			d.Cards[r*NumSuits+s] = New(r, s)
		}
	}
	return d
}

// Shuffle performs an in-place Fisher-Yates shuffle and resets the draw cursor.
func (d *Deck) Shuffle(rng *rand.Rand) {
	d.pos = 0
	for i := len(d.Cards) - 1; i > 0; i-- {
		j := rng.IntN(i + 1)
		d.Cards[i], d.Cards[j] = d.Cards[j], d.Cards[i]
	}
}

// Draw returns the next card and advances the cursor.
func (d *Deck) Draw() Card {
	c := d.Cards[d.pos]
	d.pos++
	return c
}

// Remaining returns the number of undrawn cards.
func (d *Deck) Remaining() int { return DeckSize - d.pos }
