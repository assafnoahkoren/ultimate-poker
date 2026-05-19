package game

import (
	"math/rand/v2"
	"testing"

	"ultimate-poker/internal/paytables"
)

func TestNewHand_DealsCorrectly(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	h, err := NewHand(paytables.UTH01, []int64{5, 5, 5}, []int64{1, 0, 2}, rng)
	if err != nil {
		t.Fatalf("NewHand: %v", err)
	}
	if len(h.Players) != 3 {
		t.Fatalf("got %d players, want 3", len(h.Players))
	}
	// All distinct cards.
	seen := map[uint8]bool{}
	add := func(c uint8) {
		if seen[c] {
			t.Fatalf("duplicate card %d", c)
		}
		seen[c] = true
	}
	for _, p := range h.Players {
		add(uint8(p.Hole[0]))
		add(uint8(p.Hole[1]))
	}
	add(uint8(h.Dealer[0]))
	add(uint8(h.Dealer[1]))
	for _, c := range h.Board {
		add(uint8(c))
	}
	if len(seen) != 13 { // 3*2 + 2 + 5 = 13
		t.Fatalf("got %d unique cards, want 13", len(seen))
	}
}

func TestFullFlow_AllCheckThenFold(t *testing.T) {
	rng := rand.New(rand.NewPCG(42, 0))
	h, err := NewHand(paytables.UTH01, []int64{5}, []int64{0}, rng)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range h.PendingAt(DecidePreFlop) {
		if err := h.SubmitPreFlop(id, PreFlopCheck); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range h.PendingAt(DecideFlop) {
		if err := h.SubmitFlop(id, FlopCheck); err != nil {
			t.Fatal(err)
		}
	}
	for _, id := range h.PendingAt(DecideRiver) {
		if err := h.SubmitRiver(id, RiverFold); err != nil {
			t.Fatal(err)
		}
	}
	outs, err := h.Settle()
	if err != nil {
		t.Fatal(err)
	}
	if len(outs) != 1 {
		t.Fatalf("got %d outcomes, want 1", len(outs))
	}
	o := outs[0]
	if !o.Folded {
		t.Fatal("expected folded=true")
	}
	// Folded: lose Ante + Blind = -10, Play = 0, Trips = 0
	if o.AnteNet != -5 || o.BlindNet != -5 || o.PlayNet != 0 || o.TripsNet != 0 {
		t.Fatalf("unexpected outcome %+v", o)
	}
	if o.TotalNet != -10 {
		t.Fatalf("TotalNet = %d, want -10", o.TotalNet)
	}
}

func TestSubmit_OutOfOrder(t *testing.T) {
	rng := rand.New(rand.NewPCG(7, 7))
	h, _ := NewHand(paytables.UTH01, []int64{5}, []int64{0}, rng)
	// Cannot submit flop before pre-flop.
	if err := h.SubmitFlop(0, FlopCheck); err == nil {
		t.Fatal("expected error submitting flop before preflop")
	}
	// Settle should error if not all done.
	if _, err := h.Settle(); err == nil {
		t.Fatal("expected error settling before all done")
	}
}
