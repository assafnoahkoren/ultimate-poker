package strategy

import "ultimate-poker/internal/game"

// AlwaysCheck checks pre-flop and flop, then bets 1x at the river (never folds).
// It's the maximally passive but still rational baseline.
type alwaysCheck struct{}

// AlwaysCheck returns a factory for the always-check strategy.
func AlwaysCheck() Factory { return func() Strategy { return alwaysCheck{} } }

func (alwaysCheck) Name() string                          { return "always-check" }
func (alwaysCheck) PreFlop(PreFlopCtx) game.PreFlopAction { return game.PreFlopCheck }
func (alwaysCheck) Flop(FlopCtx) game.FlopAction          { return game.FlopCheck }
func (alwaysCheck) River(RiverCtx) game.RiverAction       { return game.RiverBet1x }

// Always4x bets 4x pre-flop on every hand.
type always4x struct{}

// Always4x returns a factory for the always-4x strategy.
func Always4x() Factory { return func() Strategy { return always4x{} } }

func (always4x) Name() string                          { return "always-4x" }
func (always4x) PreFlop(PreFlopCtx) game.PreFlopAction { return game.PreFlopBet4x }
func (always4x) Flop(FlopCtx) game.FlopAction          { return game.FlopBet2x }
func (always4x) River(RiverCtx) game.RiverAction       { return game.RiverBet1x }
