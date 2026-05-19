package strategy

import (
	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
	"ultimate-poker/internal/game"
	"ultimate-poker/internal/paytables"
)

// optimalRules implements the published Wizard-of-Odds UTH strategy for the
// pre-flop and flop, and a true EV-maximization decision at the river.
//
// When TableAware is true, the river EV calculation removes the other players'
// hole cards from the dealer's possible-card pool (since we control every seat
// at the table and therefore know them).
type optimalRules struct {
	TableAware bool
}

// Optimal returns the published-optimal strategy using only single-seat info.
func Optimal() Factory { return func() Strategy { return optimalRules{TableAware: false} } }

// OptimalTable returns the published-optimal strategy with a table-aware river.
func OptimalTable() Factory { return func() Strategy { return optimalRules{TableAware: true} } }

func (o optimalRules) Name() string {
	if o.TableAware {
		return "optimal-table"
	}
	return "optimal"
}

func (o optimalRules) PreFlop(ctx PreFlopCtx) game.PreFlopAction {
	if shouldBet4xPreFlop(ctx.Hole) {
		return game.PreFlopBet4x
	}
	return game.PreFlopCheck
}

func (o optimalRules) Flop(ctx FlopCtx) game.FlopAction {
	if shouldBet2xFlop(ctx.Hole, ctx.Flop) {
		return game.FlopBet2x
	}
	return game.FlopCheck
}

func (o optimalRules) River(ctx RiverCtx) game.RiverAction {
	var otherHoles []cards.Card
	if o.TableAware {
		otherHoles = ctx.OtherHoles
	}
	return riverOptimalEV(ctx.Hole, ctx.Board, otherHoles, ctx.Variant)
}

// shouldBet4xPreFlop encodes the published Wizard-of-Odds pre-flop bet rule:
//
//   - any pair
//   - any Ace
//   - K with any suited kicker (K2s+), or offsuit kicker 5+ (K5o+)
//   - Q with suited kicker 6+ (Q6s+), or offsuit kicker 8+ (Q8o+)
//   - J with suited kicker 8+ (J8s+), or offsuit kicker T (JTo)
func shouldBet4xPreFlop(h [2]cards.Card) bool {
	r1, r2 := h[0].Rank(), h[1].Rank()
	suited := h[0].Suit() == h[1].Suit()

	high, low := r1, r2
	if low > high {
		high, low = low, high
	}

	// Rank encoding: 0=2, 1=3, …, 8=T, 9=J, 10=Q, 11=K, 12=A.
	switch {
	case r1 == r2:
		// Pair of 3s or higher (pocket 22 is a check per published optimal).
		return r1 >= 1
	case high == 12:
		return true // any Ace
	case high == 11: // King
		if suited {
			return true // any suited K
		}
		return low >= 3 // K5o+ (5 = rank 3)
	case high == 10: // Queen
		if suited {
			return low >= 4 // Q6s+ (6 = rank 4)
		}
		return low >= 6 // Q8o+ (8 = rank 6)
	case high == 9: // Jack
		if suited {
			return low >= 6 // J8s+
		}
		return low == 8 // JTo only (T = rank 8)
	}
	return false
}

// shouldBet2xFlop is a near-published flop rule:
//
//   - Trips or better → bet
//   - Hidden pair (pocket pair) → bet
//   - Pair using a hole card that isn't bottom pair → bet
//   - 4-flush draw where hero holds at least one card in the flush suit with
//     rank T+ (i.e., would make at least a T-high flush) → bet
//   - Otherwise check
//
// This is close to but not exactly the Wizard-of-Odds optimum; it ignores
// pure straight draws and a handful of edge cases that contribute <0.5% to
// total EV.
func shouldBet2xFlop(hole [2]cards.Card, flop [3]cards.Card) bool {
	holeRanks := [2]int{hole[0].Rank(), hole[1].Rank()}
	holeSuits := [2]int{hole[0].Suit(), hole[1].Suit()}
	boardRanks := [3]int{flop[0].Rank(), flop[1].Rank(), flop[2].Rank()}
	boardSuits := [3]int{flop[0].Suit(), flop[1].Suit(), flop[2].Suit()}

	var rankCount [13]int
	rankCount[holeRanks[0]]++
	rankCount[holeRanks[1]]++
	for _, r := range boardRanks {
		rankCount[r]++
	}

	// Trips or better.
	for _, n := range rankCount {
		if n >= 3 {
			return true
		}
	}

	// Hidden pair.
	if holeRanks[0] == holeRanks[1] {
		return true
	}

	// Pair using hole card, unless it's bottom pair on the flop.
	for _, hr := range holeRanks {
		if rankCount[hr] >= 2 {
			higher := 0
			for _, br := range boardRanks {
				if br != hr && br > hr {
					higher++
				}
			}
			if higher <= 1 {
				return true
			}
		}
	}

	// 4-flush draw with a hero card of T+ in the flush suit.
	var suitCount [4]int
	suitCount[holeSuits[0]]++
	suitCount[holeSuits[1]]++
	for _, s := range boardSuits {
		suitCount[s]++
	}
	for s := 0; s < 4; s++ {
		if suitCount[s] != 4 {
			continue
		}
		heroHighInSuit := -1
		for i := 0; i < 2; i++ {
			if holeSuits[i] == s && holeRanks[i] > heroHighInSuit {
				heroHighInSuit = holeRanks[i]
			}
		}
		// rank 8 == ten ("T"); bet if hero contributes at least a T to the draw.
		if heroHighInSuit >= 8 {
			return true
		}
	}

	return false
}

// riverOptimalEV makes the EV-optimal river decision by enumerating every
// possible dealer hole-card combination from the unseen pool, computing the
// settlement for each, and betting iff EV(bet) > EV(fold) = -2 ante units.
//
// If otherHoles is non-empty, those cards are removed from the dealer pool
// (table-aware mode).
func riverOptimalEV(hole [2]cards.Card, board [5]cards.Card, otherHoles []cards.Card, variant paytables.Variant) game.RiverAction {
	// Build dealer pool: 52 minus hero + board + otherHoles.
	var inDeck [52]bool
	for i := range inDeck {
		inDeck[i] = true
	}
	inDeck[hole[0]] = false
	inDeck[hole[1]] = false
	for _, c := range board {
		inDeck[c] = false
	}
	for _, c := range otherHoles {
		inDeck[c] = false
	}
	var pool [52]cards.Card
	np := 0
	for i := 0; i < 52; i++ {
		if inDeck[i] {
			pool[np] = cards.Card(i)
			np++
		}
	}

	var hero7 [7]cards.Card
	hero7[0] = hole[0]
	hero7[1] = hole[1]
	copy(hero7[2:], board[:])
	heroHV := eval.Evaluate7(hero7)
	heroCat := heroHV.Category()

	var dealer7 [7]cards.Card
	copy(dealer7[2:], board[:])

	blindMult := blindMultiplier(heroCat, variant.Blind) // numerator with denominator factored to int math
	blindDen := blindDenominator(heroCat, variant.Blind)

	// Sum EV over all C(np, 2) dealer hands. We accumulate in units scaled by
	// blindDen so we can stay in integer math.
	//
	// EV(bet) per dealer hand:
	//   win:   +ante (push if dealer no-qual)  + play  + blind*ratio (if straight+)
	//   lose:  -ante - play - blind
	//   tie:   0
	// EV(fold) per dealer hand: -ante - blind  (constant)
	//
	// We compare sums; ante/blind/play units are equal to 1 each in this run.
	const ante = 1
	var sumNetBet int64
	var sumNetFold int64
	combos := 0
	for i := 0; i < np; i++ {
		for j := i + 1; j < np; j++ {
			dealer7[0] = pool[i]
			dealer7[1] = pool[j]
			dealerHV := eval.Evaluate7(dealer7)
			dealerCat := dealerHV.Category()
			dealerQual := dealerCat >= eval.OnePair

			// Net of bet decision (counted with units scaled by blindDen for integer math).
			//
			// Per the CA AG rules: when the dealer does not qualify, the Ante
			// pushes regardless of who wins. Play and Blind resolve normally.
			var net int64
			switch {
			case heroHV > dealerHV:
				if dealerQual {
					net += ante * int64(blindDen) // ante 1:1
				}
				net += ante * int64(blindDen) // play 1:1
				net += int64(blindMult)       // blind paid per paytable (or 0 if pre-straight)
			case heroHV < dealerHV:
				if dealerQual {
					net -= ante * int64(blindDen) // ante lost only when dealer qualified
				}
				net -= ante * int64(blindDen) // play lost
				net -= ante * int64(blindDen) // blind lost
			}
			sumNetBet += net
			sumNetFold -= 2 * ante * int64(blindDen) // fold loses ante + blind
			combos++
		}
	}
	if sumNetBet > sumNetFold {
		return game.RiverBet1x
	}
	return game.RiverFold
}

// blindMultiplier returns the Blind-bet payout numerator for the given hand
// category, expressed as (Num / Den) where Den = blindDenominator(...).
//
// Returns 0 for categories below Straight (Blind pushes on a winning
// less-than-straight, lost on losing — handled elsewhere).
func blindMultiplier(cat eval.Category, pt paytables.BlindPayout) int64 {
	r := blindRatio(cat, pt)
	return r.Num
}

func blindDenominator(cat eval.Category, pt paytables.BlindPayout) int64 {
	r := blindRatio(cat, pt)
	if r.Den == 0 {
		return 1
	}
	return r.Den
}

func blindRatio(cat eval.Category, pt paytables.BlindPayout) paytables.Ratio {
	switch cat {
	case eval.RoyalFlush:
		return pt.Royal
	case eval.StraightFlush:
		return pt.StraightFlush
	case eval.FourOfAKind:
		return pt.FourOfAKind
	case eval.FullHouse:
		return pt.FullHouse
	case eval.Flush:
		return pt.Flush
	case eval.Straight:
		return pt.Straight
	}
	return paytables.Ratio{Num: 0, Den: 1}
}
