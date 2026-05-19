// Package eval evaluates 5- and 7-card poker hands.
//
// For a 7-card hand, we iterate the C(7,5)=21 5-card subsets and keep the
// best. Each 5-card subset is classified by a count/bitmask scheme without
// any heap allocations or reflection-based sort, so a 7-card evaluation runs
// in a few microseconds.
//
// HandValue is a uint32 packing: top 4 bits = category, lower 20 bits = up to
// five 4-bit kickers in significance order. Higher uint32 == better hand.
package eval

import "ultimate-poker/internal/cards"

// Category names a poker hand class. Higher value beats lower.
type Category uint8

const (
	HighCard Category = iota
	OnePair
	TwoPair
	ThreeOfAKind
	Straight
	Flush
	FullHouse
	FourOfAKind
	StraightFlush
	RoyalFlush
)

var categoryNames = [...]string{
	"High card",
	"Pair",
	"Two pair",
	"Three of a kind",
	"Straight",
	"Flush",
	"Full house",
	"Four of a kind",
	"Straight flush",
	"Royal flush",
}

// String returns a human-readable category name.
func (c Category) String() string { return categoryNames[c] }

// HandValue is an ordered hand strength. Top 4 bits = category, lower 20 = kickers.
type HandValue uint32

// Category extracts the category portion.
func (h HandValue) Category() Category { return Category(h >> 20) }

// Evaluate7 returns the best 5-card HandValue from 7 cards.
func Evaluate7(c [7]cards.Card) HandValue {
	var best HandValue
	var five [5]cards.Card
	for i := 0; i < 7; i++ {
		for j := i + 1; j < 7; j++ {
			k := 0
			for m := 0; m < 7; m++ {
				if m == i || m == j {
					continue
				}
				five[k] = c[m]
				k++
			}
			if v := evaluate5(five); v > best {
				best = v
			}
		}
	}
	return best
}

// Evaluate5 returns the HandValue of exactly 5 cards.
func Evaluate5(c [5]cards.Card) HandValue { return evaluate5(c) }

const wheelMask uint16 = (1 << 12) | (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3)

func evaluate5(c [5]cards.Card) HandValue {
	var rankCount [cards.NumRanks]uint8
	var suitCount [cards.NumSuits]uint8
	var mask uint16
	for _, card := range c {
		r := uint(card) / 4
		s := uint(card) & 3
		rankCount[r]++
		suitCount[s]++
		mask |= 1 << r
	}

	isFlush := suitCount[0] == 5 || suitCount[1] == 5 || suitCount[2] == 5 || suitCount[3] == 5

	// Straight: highest 5 consecutive bits set, or the wheel A-2-3-4-5.
	straightHigh := -1
	for high := 12; high >= 4; high-- {
		if (mask>>uint(high-4))&0x1F == 0x1F {
			straightHigh = high
			break
		}
	}
	if straightHigh < 0 && mask&wheelMask == wheelMask {
		straightHigh = 3 // 5-high
	}

	// Collect ranks present in rank-desc order; at most 5 entries.
	// rcRank[i] = rank, rcCount[i] = count of that rank.
	var rcRank, rcCount [5]int8
	var n int8
	for r := int8(cards.NumRanks - 1); r >= 0; r-- {
		if rankCount[r] > 0 {
			rcRank[n] = r
			rcCount[n] = int8(rankCount[r])
			n++
		}
	}
	// Stable insertion sort by count desc (preserves rank-desc on ties).
	for i := int8(1); i < n; i++ {
		cr, cc := rcRank[i], rcCount[i]
		j := i
		for j > 0 && rcCount[j-1] < cc {
			rcRank[j], rcCount[j] = rcRank[j-1], rcCount[j-1]
			j--
		}
		rcRank[j], rcCount[j] = cr, cc
	}

	var cat Category
	switch {
	case isFlush && straightHigh == 12:
		cat = RoyalFlush
	case isFlush && straightHigh >= 0:
		cat = StraightFlush
	case rcCount[0] == 4:
		cat = FourOfAKind
	case rcCount[0] == 3 && rcCount[1] == 2:
		cat = FullHouse
	case isFlush:
		cat = Flush
	case straightHigh >= 0:
		cat = Straight
	case rcCount[0] == 3:
		cat = ThreeOfAKind
	case rcCount[0] == 2 && rcCount[1] == 2:
		cat = TwoPair
	case rcCount[0] == 2:
		cat = OnePair
	default:
		cat = HighCard
	}

	// Pack kickers in significance order. rcRank[i] is always valid for any
	// category-relevant index (n is at least 2 for paired hands, 5 for the rest).
	var k0, k1, k2, k3, k4 int8
	switch cat {
	case RoyalFlush, StraightFlush, Straight:
		k0 = int8(straightHigh)
	case FourOfAKind, FullHouse:
		k0, k1 = rcRank[0], rcRank[1]
	case ThreeOfAKind, TwoPair:
		k0, k1, k2 = rcRank[0], rcRank[1], rcRank[2]
	case OnePair:
		k0, k1, k2, k3 = rcRank[0], rcRank[1], rcRank[2], rcRank[3]
	case Flush, HighCard:
		k0, k1, k2, k3, k4 = rcRank[0], rcRank[1], rcRank[2], rcRank[3], rcRank[4]
	}

	h := HandValue(cat) << 20
	h |= HandValue(k0&0xF) << 16
	h |= HandValue(k1&0xF) << 12
	h |= HandValue(k2&0xF) << 8
	h |= HandValue(k3&0xF) << 4
	h |= HandValue(k4 & 0xF)
	return h
}
