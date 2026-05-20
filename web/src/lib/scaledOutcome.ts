// Display-layer scaling: the game logic settles in ante = 1 chip units; the
// user's BetSettings (Bet / Ante / Trips wager sizes) scale those outcomes
// for display. Trips isn't part of the core settlement, so we compute it
// here using the user's Trips wager and current Trips paytable.

import type { Card } from './cards';
import { Category, categoryOf, evaluate5 } from './eval';
import type { Category as Cat } from './eval';
import type { SettleResult } from './strategy';
import type { TripsPaytable } from './trips';
import type { BonusPaytable } from './bonus';
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

// Common Progressive Bonus: pays on a "for one" basis using the 5-card hand
// made of (hole + flop). Win pays (stake × (pays − 1)), loss loses the stake.
// Paid out regardless of fold or dealer comparison — depends only on the
// player's flop-time 5-card hand.
function bonusPayout(cat: Cat, p: BonusPaytable): number {
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
      return 0; // for-one: no payout means you lose the stake
  }
}

function bonusNet(
  hole: [Card, Card],
  flop: [Card, Card, Card] | null,
  bets: BetSettings,
  paytable: BonusPaytable
): number {
  if (bets.bonus <= 0) return 0;
  if (!flop) return 0;
  const cards = [hole[0], hole[1], flop[0], flop[1], flop[2]];
  const cat = categoryOf(evaluate5(cards));
  const pays = bonusPayout(cat, paytable);
  return bets.bonus * (pays - 1);
}

export function scaleOutcome(
  result: SettleResult,
  hole: [Card, Card],
  flop: [Card, Card, Card] | null,
  bets: BetSettings,
  trips: TripsPaytable,
  bonus: BonusPaytable
): ScaledOutcome {
  const anteN = result.anteNet * bets.ante;
  const betN = result.blindNet * bets.bet;
  // playNet from settle is already (multiplier × ante=1) so we re-scale by
  // the user's Ante to get chip units consistent with their setup.
  const playN = result.playNet * bets.ante;
  const tripsN = tripsNet(result.heroCat, bets, trips);
  const bonusN = bonusNet(hole, flop, bets, bonus);
  return {
    bet: betN,
    ante: anteN,
    play: playN,
    trips: tripsN,
    bonus: bonusN,
    total: betN + anteN + playN + tripsN + bonusN,
  };
}
