// Display-layer scaling: the game logic settles in ante = 1 chip units; the
// user's BetSettings (Bet / Ante / Trips wager sizes) scale those outcomes
// for display. Trips isn't part of the core settlement, so we compute it
// here using the user's Trips wager and current Trips paytable.

import { Category } from './eval';
import type { Category as Cat } from './eval';
import type { SettleResult } from './strategy';
import type { TripsPaytable } from './trips';
import type { BetSettings } from './bets';

export interface ScaledOutcome {
  bet: number;   // Blind net (chip-scaled)
  ante: number;  // Ante net
  play: number;  // Play net (multiplier × ante)
  trips: number; // Trips net (computed from the user's wager + paytable)
  bonus: number; // placeholder, not wired
  total: number;
}

function tripsMultiplier(cat: Cat, p: TripsPaytable): number | null {
  switch (cat) {
    case Category.RoyalFlush:
      return p.royalFlush;
    case Category.StraightFlush:
      return p.straightFlush;
    case Category.FourOfAKind:
      return p.fourOfAKind;
    case Category.FullHouse:
      return p.fullHouse;
    case Category.Flush:
      return p.flush;
    case Category.Straight:
      return p.straight;
    case Category.ThreeOfAKind:
      return p.threeOfAKind;
    default:
      return null;
  }
}

// Trips wager wins by paytable if hero's best 5-card hand is 3oak+; loses
// otherwise. Per the published UTH rules, Trips pays even if the player
// folded — it depends only on the hero's 7-card hand strength, not on
// dealer qualification or comparison.
function tripsNet(
  heroCat: Cat,
  bets: BetSettings,
  paytable: TripsPaytable
): number {
  if (bets.trips <= 0) return 0;
  const m = tripsMultiplier(heroCat, paytable);
  if (m !== null) return bets.trips * m;
  return -bets.trips;
}

export function scaleOutcome(
  result: SettleResult,
  bets: BetSettings,
  paytable: TripsPaytable
): ScaledOutcome {
  const ante = result.anteNet * bets.ante;
  const bet = result.blindNet * bets.bet;
  // playNet from settle is already (multiplier × ante=1) so we re-scale by
  // the user's Ante to get chip units consistent with their setup.
  const play = result.playNet * bets.ante;
  const trips = tripsNet(result.heroCat, bets, paytable);
  return {
    bet,
    ante,
    play,
    trips,
    bonus: 0,
    total: bet + ante + play + trips,
  };
}
