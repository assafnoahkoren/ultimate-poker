// Package game implements the Ultimate Texas Hold'em engine: dealing, the
// three player decision rounds, and per-player settlement against a single
// dealer.
//
// The engine is I/O-free; callers (CLI, simulator, etc.) drive it by reading
// pending players at each phase and submitting actions.
package game

import (
	"fmt"
	"math/rand/v2"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/eval"
	"ultimate-poker/internal/paytables"
)

// PreFlopAction is one of the legal pre-flop choices.
type PreFlopAction uint8

const (
	PreFlopCheck PreFlopAction = iota
	PreFlopBet3x
	PreFlopBet4x
)

func (a PreFlopAction) String() string {
	switch a {
	case PreFlopCheck:
		return "check"
	case PreFlopBet3x:
		return "bet 3x"
	case PreFlopBet4x:
		return "bet 4x"
	}
	return "?"
}

// FlopAction is one of the legal flop choices.
type FlopAction uint8

const (
	FlopCheck FlopAction = iota
	FlopBet2x
)

func (a FlopAction) String() string {
	switch a {
	case FlopCheck:
		return "check"
	case FlopBet2x:
		return "bet 2x"
	}
	return "?"
}

// RiverAction is one of the legal river choices.
type RiverAction uint8

const (
	RiverFold RiverAction = iota
	RiverBet1x
)

func (a RiverAction) String() string {
	switch a {
	case RiverFold:
		return "fold"
	case RiverBet1x:
		return "bet 1x"
	}
	return "?"
}

// Decision indicates which decision a player still owes.
type Decision uint8

const (
	DecidePreFlop Decision = iota
	DecideFlop
	DecideRiver
	DecideDone
)

// PlayerState holds one player's wagers and decisions for a single hand.
type PlayerState struct {
	ID     int
	Hole   [2]cards.Card
	Ante   int64
	Blind  int64 // always equals Ante
	Trips  int64 // 0 if not placed
	Play   int64 // 0 until they bet
	Folded bool
	Next   Decision
}

// Outcome is the settled result for one player.
type Outcome struct {
	PlayerID        int
	AnteNet         int64
	BlindNet        int64
	PlayNet         int64
	TripsNet        int64
	TotalNet        int64
	PlayerCategory  eval.Category
	DealerCategory  eval.Category
	DealerQualified bool
	Folded          bool
}

// Hand represents one round of Ultimate Texas Hold'em for N players vs the dealer.
type Hand struct {
	Variant  paytables.Variant
	Players  []*PlayerState
	Dealer   [2]cards.Card
	Board    [5]cards.Card
	settled  bool
	outcomes []Outcome
}

// NewHand deals a fresh hand. antes[i] and trips[i] are the wagers for player i;
// blind is always equal to ante. The deck is shuffled with rng before dealing.
func NewHand(variant paytables.Variant, antes, trips []int64, rng *rand.Rand) (*Hand, error) {
	if len(antes) == 0 {
		return nil, fmt.Errorf("at least one player required")
	}
	if len(antes) != len(trips) {
		return nil, fmt.Errorf("antes and trips length mismatch (%d vs %d)", len(antes), len(trips))
	}
	for i, a := range antes {
		if a <= 0 {
			return nil, fmt.Errorf("player %d: ante must be > 0", i)
		}
		if trips[i] < 0 {
			return nil, fmt.Errorf("player %d: trips wager cannot be negative", i)
		}
	}

	deck := cards.NewDeck()
	deck.Shuffle(rng)

	n := len(antes)
	players := make([]*PlayerState, n)
	for i := 0; i < n; i++ {
		players[i] = &PlayerState{
			ID:    i,
			Ante:  antes[i],
			Blind: antes[i],
			Trips: trips[i],
			Next:  DecidePreFlop,
		}
	}
	for i := 0; i < n; i++ {
		players[i].Hole[0] = deck.Draw()
		players[i].Hole[1] = deck.Draw()
	}
	var dealer [2]cards.Card
	dealer[0] = deck.Draw()
	dealer[1] = deck.Draw()
	var board [5]cards.Card
	for i := 0; i < 5; i++ {
		board[i] = deck.Draw()
	}
	return &Hand{
		Variant: variant,
		Players: players,
		Dealer:  dealer,
		Board:   board,
	}, nil
}

// PendingAt returns the IDs of players still owing the given decision, in seat order.
func (h *Hand) PendingAt(d Decision) []int {
	var out []int
	for _, p := range h.Players {
		if p.Next == d {
			out = append(out, p.ID)
		}
	}
	return out
}

// Flop returns the first three community cards.
func (h *Hand) Flop() [3]cards.Card {
	return [3]cards.Card{h.Board[0], h.Board[1], h.Board[2]}
}

// Turn returns the 4th community card.
func (h *Hand) Turn() cards.Card { return h.Board[3] }

// River returns the 5th community card.
func (h *Hand) River() cards.Card { return h.Board[4] }

// SubmitPreFlop records a pre-flop action.
func (h *Hand) SubmitPreFlop(playerID int, a PreFlopAction) error {
	p, err := h.player(playerID)
	if err != nil {
		return err
	}
	if p.Next != DecidePreFlop {
		return fmt.Errorf("player %d not pending pre-flop (status=%v)", playerID, p.Next)
	}
	switch a {
	case PreFlopCheck:
		p.Next = DecideFlop
	case PreFlopBet3x:
		p.Play = p.Ante * 3
		p.Next = DecideDone
	case PreFlopBet4x:
		p.Play = p.Ante * 4
		p.Next = DecideDone
	default:
		return fmt.Errorf("invalid pre-flop action %d", a)
	}
	return nil
}

// SubmitFlop records a flop action.
func (h *Hand) SubmitFlop(playerID int, a FlopAction) error {
	p, err := h.player(playerID)
	if err != nil {
		return err
	}
	if p.Next != DecideFlop {
		return fmt.Errorf("player %d not pending flop (status=%v)", playerID, p.Next)
	}
	switch a {
	case FlopCheck:
		p.Next = DecideRiver
	case FlopBet2x:
		p.Play = p.Ante * 2
		p.Next = DecideDone
	default:
		return fmt.Errorf("invalid flop action %d", a)
	}
	return nil
}

// SubmitRiver records a river action.
func (h *Hand) SubmitRiver(playerID int, a RiverAction) error {
	p, err := h.player(playerID)
	if err != nil {
		return err
	}
	if p.Next != DecideRiver {
		return fmt.Errorf("player %d not pending river (status=%v)", playerID, p.Next)
	}
	switch a {
	case RiverFold:
		p.Folded = true
		p.Next = DecideDone
	case RiverBet1x:
		p.Play = p.Ante
		p.Next = DecideDone
	default:
		return fmt.Errorf("invalid river action %d", a)
	}
	return nil
}

func (h *Hand) player(id int) (*PlayerState, error) {
	if id < 0 || id >= len(h.Players) {
		return nil, fmt.Errorf("invalid player id %d", id)
	}
	return h.Players[id], nil
}

// AllDone reports whether every player has reached DecideDone (bet or folded).
func (h *Hand) AllDone() bool {
	for _, p := range h.Players {
		if p.Next != DecideDone {
			return false
		}
	}
	return true
}
