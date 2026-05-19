// Package strategy defines a pluggable decision policy for Ultimate Texas
// Hold'em and ships several reference implementations.
//
// A strategy makes three decisions per hand: pre-flop, flop, and river. Each
// decision sees only the information that decision would have at the table,
// plus optionally the other players' hole cards (for "table-aware" strategies
// where we control every seat).
package strategy

import (
	"math/rand/v2"

	"ultimate-poker/internal/cards"
	"ultimate-poker/internal/game"
	"ultimate-poker/internal/paytables"
)

// PreFlopCtx is what a strategy sees before any community cards are revealed.
type PreFlopCtx struct {
	Variant    paytables.Variant
	Hole       [2]cards.Card
	OtherHoles []cards.Card // empty for solo strategies
	RNG        *rand.Rand
}

// FlopCtx is what a strategy sees after the first 3 community cards.
type FlopCtx struct {
	Variant    paytables.Variant
	Hole       [2]cards.Card
	Flop       [3]cards.Card
	OtherHoles []cards.Card
	RNG        *rand.Rand
}

// RiverCtx is what a strategy sees after all 5 community cards.
type RiverCtx struct {
	Variant    paytables.Variant
	Hole       [2]cards.Card
	Board      [5]cards.Card
	OtherHoles []cards.Card
	RNG        *rand.Rand
}

// Strategy is a UTH decision policy. Per-worker instances are built via Factory.
type Strategy interface {
	Name() string
	PreFlop(ctx PreFlopCtx) game.PreFlopAction
	Flop(ctx FlopCtx) game.FlopAction
	River(ctx RiverCtx) game.RiverAction
}

// Factory builds a fresh Strategy for each worker goroutine. Stateful strategies
// can hold per-worker state without locking by relying on this contract.
type Factory func() Strategy
