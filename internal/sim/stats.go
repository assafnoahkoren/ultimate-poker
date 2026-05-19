package sim

// Stats accumulates per-hand outcomes across many hands of a single
// (strategy, table size) configuration.
//
// Net fields are signed sums in units of the ante. Counts are unsigned.
type Stats struct {
	Hands         uint64
	AnteNet       int64
	BlindNet      int64
	PlayNet       int64
	TripsNet      int64
	DealerQual    uint64
	Folds         uint64
	PlayerCatHist [10]uint64 // index = eval.Category
}

// Merge adds another Stats into the receiver.
func (s *Stats) Merge(o *Stats) {
	s.Hands += o.Hands
	s.AnteNet += o.AnteNet
	s.BlindNet += o.BlindNet
	s.PlayNet += o.PlayNet
	s.TripsNet += o.TripsNet
	s.DealerQual += o.DealerQual
	s.Folds += o.Folds
	for i := range s.PlayerCatHist {
		s.PlayerCatHist[i] += o.PlayerCatHist[i]
	}
}

// TotalNet returns the signed sum of all four wagers.
func (s *Stats) TotalNet() int64 {
	return s.AnteNet + s.BlindNet + s.PlayNet + s.TripsNet
}

// EVPerAnte returns the expected net per unit Ante.
func (s *Stats) EVPerAnte() float64 {
	if s.Hands == 0 {
		return 0
	}
	return float64(s.TotalNet()) / float64(s.Hands)
}

// HouseEdgePct returns the house edge on Ante in percent.
func (s *Stats) HouseEdgePct() float64 {
	return -s.EVPerAnte() * 100
}
