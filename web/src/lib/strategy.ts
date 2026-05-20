// Optimal rule-based strategy for Ultimate Texas Hold'em (UTH-02 base game).
// Ported from internal/strategy/optimal.go.

import type { Card } from './cards';
import { rankOf, suitOf } from './cards';
import type { Category } from './eval';
import { Category as Cat, categoryOf, evaluate7 } from './eval';
import { blindRatio } from './paytables';

export type PreFlopAction = 'check' | 'bet4x';
export type FlopAction = 'check' | 'bet2x';
export type RiverAction = 'fold' | 'bet1x';

// Pre-flop: bet 4× per the Wizard-of-Odds rule set.
//   - any pair 3+
//   - any Ace
//   - K suited (any kicker), K offsuit kicker 5+
//   - Q suited kicker 6+, Q offsuit kicker 8+
//   - J suited kicker 8+, JT offsuit
export function preFlopDecision(hole: [Card, Card]): PreFlopAction {
  const r1 = rankOf(hole[0]);
  const r2 = rankOf(hole[1]);
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);

  if (r1 === r2) return r1 >= 1 ? 'bet4x' : 'check'; // pair of 3s+ (rank 1 = 3)
  if (high === 12) return 'bet4x'; // any A
  if (high === 11) {
    // King
    if (suited) return 'bet4x';
    return low >= 3 ? 'bet4x' : 'check'; // K5o+ (5 = rank 3)
  }
  if (high === 10) {
    // Queen
    if (suited) return low >= 4 ? 'bet4x' : 'check'; // Q6s+
    return low >= 6 ? 'bet4x' : 'check'; // Q8o+
  }
  if (high === 9) {
    // Jack
    if (suited) return low >= 6 ? 'bet4x' : 'check'; // J8s+
    return low === 8 ? 'bet4x' : 'check'; // JTo only
  }
  return 'check';
}

// Flop: bet 2× per the rule set used in the Go `optimal` strategy.
//   - trips+ → bet
//   - hidden pair (pocket pair) → bet
//   - top or middle pair using a hole card → bet
//   - 4-flush with hero T+ in the flush suit → bet
//   - otherwise check
export function flopDecision(
  hole: [Card, Card],
  flop: [Card, Card, Card]
): FlopAction {
  const holeRanks = [rankOf(hole[0]), rankOf(hole[1])];
  const holeSuits = [suitOf(hole[0]), suitOf(hole[1])];
  const boardRanks = [rankOf(flop[0]), rankOf(flop[1]), rankOf(flop[2])];
  const boardSuits = [suitOf(flop[0]), suitOf(flop[1]), suitOf(flop[2])];

  const rankCount: number[] = new Array(13).fill(0);
  rankCount[holeRanks[0]]++;
  rankCount[holeRanks[1]]++;
  for (const r of boardRanks) rankCount[r]++;

  // Trips or better.
  for (const n of rankCount) if (n >= 3) return 'bet2x';

  // Hidden pair (pocket pair).
  if (holeRanks[0] === holeRanks[1]) return 'bet2x';

  // Pair using a hole card, unless bottom pair on the flop.
  for (const hr of holeRanks) {
    if (rankCount[hr] >= 2) {
      let higher = 0;
      for (const br of boardRanks) {
        if (br !== hr && br > hr) higher++;
      }
      if (higher <= 1) return 'bet2x'; // top or middle pair
    }
  }

  // 4-flush draw with a hero card of T+ in the flush suit.
  const suitCount = [0, 0, 0, 0];
  suitCount[holeSuits[0]]++;
  suitCount[holeSuits[1]]++;
  for (const s of boardSuits) suitCount[s]++;
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] !== 4) continue;
    let heroHigh = -1;
    for (let i = 0; i < 2; i++) {
      if (holeSuits[i] === s && holeRanks[i] > heroHigh) {
        heroHigh = holeRanks[i];
      }
    }
    if (heroHigh >= 8) return 'bet2x'; // rank 8 = T
  }

  return 'check';
}

// River: exact EV-maximization. Enumerate every possible dealer hole-card pair
// from the unseen cards (52 minus hero's hole, board, and any other known
// hole cards). Bet 1× iff EV(bet) > EV(fold) = −2 ante.
export function riverDecision(
  hole: [Card, Card],
  board: [Card, Card, Card, Card, Card],
  otherHoles: Card[] = []
): RiverAction {
  const inDeck = new Array(52).fill(true);
  inDeck[hole[0]] = false;
  inDeck[hole[1]] = false;
  for (const c of board) inDeck[c] = false;
  for (const c of otherHoles) inDeck[c] = false;

  const pool: Card[] = [];
  for (let i = 0; i < 52; i++) if (inDeck[i]) pool.push(i);

  const hero7 = [hole[0], hole[1], board[0], board[1], board[2], board[3], board[4]];
  const heroHV = evaluate7(hero7);
  const heroCat = categoryOf(heroHV);
  const blindR = blindRatio(heroCat);
  const blindMult = blindR.num;
  const blindDen = blindR.den || 1;

  const dealer7 = [0, 0, board[0], board[1], board[2], board[3], board[4]];

  let sumBet = 0;
  let combos = 0;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      dealer7[0] = pool[i];
      dealer7[1] = pool[j];
      const dealerHV = evaluate7(dealer7);
      const dealerCat = categoryOf(dealerHV);
      const dealerQual = dealerCat >= Cat.OnePair;
      let net = 0;
      if (heroHV > dealerHV) {
        if (dealerQual) net += blindDen;
        net += blindDen;
        net += blindMult;
      } else if (heroHV < dealerHV) {
        if (dealerQual) net -= blindDen;
        net -= blindDen;
        net -= blindDen;
      }
      sumBet += net;
      combos++;
    }
  }
  const sumFold = -2 * blindDen * combos;
  return sumBet > sumFold ? 'bet1x' : 'fold';
}

// Showdown settlement using the same rules as the Go runner. AnteUnit = 1
// (so blind flush payouts of 3:2 become 1.5 — we use floats here).
export interface SettleResult {
  anteNet: number;
  blindNet: number;
  playNet: number;
  totalNet: number;
  heroCat: Category;
  dealerCat: Category;
  dealerQual: boolean;
  folded: boolean;
}

export function settle(
  hole: [Card, Card],
  board: [Card, Card, Card, Card, Card],
  dealer: [Card, Card],
  play: number, // 0, 1, 2, 3, or 4 (× ante)
  folded: boolean
): SettleResult {
  const ante = 1;
  const hero7 = [hole[0], hole[1], board[0], board[1], board[2], board[3], board[4]];
  const dealer7 = [dealer[0], dealer[1], board[0], board[1], board[2], board[3], board[4]];
  const heroHV = evaluate7(hero7);
  const dealerHV = evaluate7(dealer7);
  const heroCat = categoryOf(heroHV);
  const dealerCat = categoryOf(dealerHV);
  const dealerQual = dealerCat >= Cat.OnePair;

  if (folded) {
    return {
      anteNet: -ante,
      blindNet: -ante,
      playNet: 0,
      totalNet: -2 * ante,
      heroCat,
      dealerCat,
      dealerQual,
      folded: true,
    };
  }

  let anteNet = 0;
  let blindNet = 0;
  let playNet = 0;
  if (heroHV > dealerHV) {
    if (dealerQual) anteNet = ante;
    playNet = play;
    if (heroCat >= Cat.Straight) {
      const r = blindRatio(heroCat);
      blindNet = (ante * r.num) / r.den;
    }
  } else if (heroHV < dealerHV) {
    if (dealerQual) anteNet = -ante;
    blindNet = -ante;
    playNet = -play;
  }
  return {
    anteNet,
    blindNet,
    playNet,
    totalNet: anteNet + blindNet + playNet,
    heroCat,
    dealerCat,
    dealerQual,
    folded: false,
  };
}
