package game

import (
	"fmt"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
	"ultimate-poker/internal/paytables"
)

// DealerHand returns the dealer's full 7-card combination (2 hole + 5 board).
func (h *Hand) DealerHand() [7]cards.Card {
	return [7]cards.Card{
		h.Dealer[0], h.Dealer[1],
		h.Board[0], h.Board[1], h.Board[2], h.Board[3], h.Board[4],
	}
}

// PlayerHand returns player N's 7-card combination.
func (h *Hand) PlayerHand(id int) ([7]cards.Card, error) {
	if id < 0 || id >= len(h.Players) {
		return [7]cards.Card{}, fmt.Errorf("invalid player id %d", id)
	}
	p := h.Players[id]
	return [7]cards.Card{
		p.Hole[0], p.Hole[1],
		h.Board[0], h.Board[1], h.Board[2], h.Board[3], h.Board[4],
	}, nil
}

// Settle evaluates all hands, applies the UTH settlement rules, and returns
// per-player outcomes. Settle is idempotent: repeat calls return the cached
// result without re-evaluating. It returns an error if any player has not yet
// reached DecideDone.
func (h *Hand) Settle() ([]Outcome, error) {
	if h.settled {
		return h.outcomes, nil
	}
	if !h.AllDone() {
		return nil, fmt.Errorf("cannot settle: not all players have acted")
	}

	dealer7 := h.DealerHand()
	dealerHV := eval.Evaluate7(dealer7)
	dealerCat := dealerHV.Category()
	dealerQualified := dealerCat >= eval.OnePair

	outcomes := make([]Outcome, len(h.Players))
	for i, p := range h.Players {
		player7, _ := h.PlayerHand(p.ID)
		playerHV := eval.Evaluate7(player7)
		playerCat := playerHV.Category()

		out := Outcome{
			PlayerID:        p.ID,
			PlayerCategory:  playerCat,
			DealerCategory:  dealerCat,
			DealerQualified: dealerQualified,
			Folded:          p.Folded,
		}

		// Trips pays from the player's own 7-card hand whenever it's a Three of
		// a Kind or better, regardless of fold/win/lose/push. Otherwise it loses.
		out.TripsNet = settleTrips(p.Trips, playerCat, h.Variant.Trips)

		if p.Folded {
			out.AnteNet = -p.Ante
			out.BlindNet = -p.Blind
			out.PlayNet = 0
		} else {
			switch {
			case playerHV > dealerHV:
				// Player wins. Ante pays 1:1 if dealer qualified; pushes otherwise.
				if dealerQualified {
					out.AnteNet = p.Ante
				}
				out.PlayNet = p.Play
				// Blind: per paytable if straight+; pushes on win with less than straight.
				if playerCat >= eval.Straight {
					out.BlindNet = settleBlind(p.Blind, playerCat, h.Variant.Blind)
				}
			case playerHV < dealerHV:
				// Per CA AG rules: when the dealer does not qualify, the Ante
				// pushes even if the player loses the hand comparison.
				if dealerQualified {
					out.AnteNet = -p.Ante
				}
				out.BlindNet = -p.Blind
				out.PlayNet = -p.Play
			default:
				// Tie: all push.
			}
		}

		out.TotalNet = out.AnteNet + out.BlindNet + out.PlayNet + out.TripsNet
		outcomes[i] = out
	}

	h.outcomes = outcomes
	h.settled = true
	return outcomes, nil
}

func settleTrips(stake int64, cat eval.Category, pt paytables.TripsPayout) int64 {
	if stake <= 0 {
		return 0
	}
	var r paytables.Ratio
	switch cat {
	case eval.RoyalFlush:
		r = pt.Royal
	case eval.StraightFlush:
		r = pt.StraightFlush
	case eval.FourOfAKind:
		r = pt.FourOfAKind
	case eval.FullHouse:
		r = pt.FullHouse
	case eval.Flush:
		r = pt.Flush
	case eval.Straight:
		r = pt.Straight
	case eval.ThreeOfAKind:
		r = pt.ThreeOfAKind
	default:
		return -stake
	}
	return r.Apply(stake)
}

func settleBlind(stake int64, cat eval.Category, pt paytables.BlindPayout) int64 {
	var r paytables.Ratio
	switch cat {
	case eval.RoyalFlush:
		r = pt.Royal
	case eval.StraightFlush:
		r = pt.StraightFlush
	case eval.FourOfAKind:
		r = pt.FourOfAKind
	case eval.FullHouse:
		r = pt.FullHouse
	case eval.Flush:
		r = pt.Flush
	case eval.Straight:
		r = pt.Straight
	default:
		return 0
	}
	return r.Apply(stake)
}
