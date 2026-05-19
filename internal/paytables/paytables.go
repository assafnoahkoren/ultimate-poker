// Package paytables defines the Blind and Trips paytables for Ultimate Texas
// Hold'em. The four published variants UTH-01..UTH-04 are exported.
package paytables

import "fmt"

// Ratio expresses a payout as "Num to Den" (e.g., 3:2 = {Num:3, Den:2}).
type Ratio struct {
	Num, Den int64
}

// Apply returns the payout amount (excluding the original stake) for a given stake.
func (r Ratio) Apply(stake int64) int64 {
	if r.Den == 0 {
		return 0
	}
	return stake * r.Num / r.Den
}

// BlindPayout enumerates Blind-bet payouts; categories below Straight push (not lose).
type BlindPayout struct {
	Royal         Ratio
	StraightFlush Ratio
	FourOfAKind   Ratio
	FullHouse     Ratio
	Flush         Ratio
	Straight      Ratio
}

// TripsPayout enumerates Trips-bonus payouts; categories below Three of a Kind lose.
type TripsPayout struct {
	Royal         Ratio
	StraightFlush Ratio
	FourOfAKind   Ratio
	FullHouse     Ratio
	Flush         Ratio
	Straight      Ratio
	ThreeOfAKind  Ratio
}

// Variant bundles a paytable ID with its Blind and Trips schedules.
type Variant struct {
	ID    string
	Blind BlindPayout
	Trips TripsPayout
}

var (
	// UTH-01: the most common Vegas-style paytable.
	UTH01 = Variant{
		ID: "UTH-01",
		Blind: BlindPayout{
			Royal:         Ratio{500, 1},
			StraightFlush: Ratio{50, 1},
			FourOfAKind:   Ratio{10, 1},
			FullHouse:     Ratio{3, 1},
			Flush:         Ratio{3, 2},
			Straight:      Ratio{1, 1},
		},
		Trips: TripsPayout{
			Royal:         Ratio{50, 1},
			StraightFlush: Ratio{40, 1},
			FourOfAKind:   Ratio{30, 1},
			FullHouse:     Ratio{9, 1},
			Flush:         Ratio{7, 1},
			Straight:      Ratio{4, 1},
			ThreeOfAKind:  Ratio{3, 1},
		},
	}

	UTH02 = Variant{
		ID:    "UTH-02",
		Blind: UTH01.Blind,
		Trips: TripsPayout{
			Royal:         Ratio{50, 1},
			StraightFlush: Ratio{40, 1},
			FourOfAKind:   Ratio{30, 1},
			FullHouse:     Ratio{8, 1},
			Flush:         Ratio{6, 1},
			Straight:      Ratio{5, 1},
			ThreeOfAKind:  Ratio{3, 1},
		},
	}

	UTH03 = Variant{
		ID:    "UTH-03",
		Blind: UTH01.Blind,
		Trips: TripsPayout{
			Royal:         Ratio{50, 1},
			StraightFlush: Ratio{40, 1},
			FourOfAKind:   Ratio{30, 1},
			FullHouse:     Ratio{8, 1},
			Flush:         Ratio{7, 1},
			Straight:      Ratio{4, 1},
			ThreeOfAKind:  Ratio{3, 1},
		},
	}

	UTH04 = Variant{
		ID:    "UTH-04",
		Blind: UTH01.Blind,
		Trips: TripsPayout{
			Royal:         Ratio{50, 1},
			StraightFlush: Ratio{40, 1},
			FourOfAKind:   Ratio{20, 1},
			FullHouse:     Ratio{7, 1},
			Flush:         Ratio{6, 1},
			Straight:      Ratio{5, 1},
			ThreeOfAKind:  Ratio{3, 1},
		},
	}
)

// ByID looks up a variant by its ID (e.g., "UTH-01").
func ByID(id string) (Variant, error) {
	switch id {
	case UTH01.ID:
		return UTH01, nil
	case UTH02.ID:
		return UTH02, nil
	case UTH03.ID:
		return UTH03, nil
	case UTH04.ID:
		return UTH04, nil
	}
	return Variant{}, fmt.Errorf("unknown variant %q", id)
}

// All returns the four published variants in order.
func All() []Variant { return []Variant{UTH01, UTH02, UTH03, UTH04} }
