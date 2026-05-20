// 5- and 7-card poker hand evaluator, ported from the Go internal/eval package.
//
// HandValue is a 24-bit packed integer: top 4 bits = category, lower 20 bits =
// up to five 4-bit kickers in significance order. Higher = better.

import type { Card } from './cards';
import { rankOf, suitOf } from './cards';

export const Category = {
  HighCard: 0,
  OnePair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
  RoyalFlush: 9,
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const CATEGORY_LABELS = [
  'High card',
  'Pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
  'Royal flush',
];

const WHEEL_MASK = (1 << 12) | (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3);

export function evaluate5(c: Card[]): number {
  const rankCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const suitCount = [0, 0, 0, 0];
  let mask = 0;
  for (let i = 0; i < 5; i++) {
    const r = rankOf(c[i]);
    rankCount[r]++;
    suitCount[suitOf(c[i])]++;
    mask |= 1 << r;
  }

  const isFlush =
    suitCount[0] === 5 ||
    suitCount[1] === 5 ||
    suitCount[2] === 5 ||
    suitCount[3] === 5;

  let straightHigh = -1;
  for (let high = 12; high >= 4; high--) {
    if (((mask >> (high - 4)) & 0x1f) === 0x1f) {
      straightHigh = high;
      break;
    }
  }
  if (straightHigh < 0 && (mask & WHEEL_MASK) === WHEEL_MASK) {
    straightHigh = 3; // 5-high wheel
  }

  // Collect ranks in rank-desc order with their counts (max 5 entries).
  const rcRank = [0, 0, 0, 0, 0];
  const rcCount = [0, 0, 0, 0, 0];
  let n = 0;
  for (let r = 12; r >= 0; r--) {
    if (rankCount[r] > 0) {
      rcRank[n] = r;
      rcCount[n] = rankCount[r];
      n++;
    }
  }
  // Stable insertion sort by count desc, preserves rank-desc on ties.
  for (let i = 1; i < n; i++) {
    const cr = rcRank[i];
    const cc = rcCount[i];
    let j = i;
    while (j > 0 && rcCount[j - 1] < cc) {
      rcRank[j] = rcRank[j - 1];
      rcCount[j] = rcCount[j - 1];
      j--;
    }
    rcRank[j] = cr;
    rcCount[j] = cc;
  }

  let cat: number;
  if (isFlush && straightHigh === 12) cat = Category.RoyalFlush;
  else if (isFlush && straightHigh >= 0) cat = Category.StraightFlush;
  else if (rcCount[0] === 4) cat = Category.FourOfAKind;
  else if (rcCount[0] === 3 && rcCount[1] === 2) cat = Category.FullHouse;
  else if (isFlush) cat = Category.Flush;
  else if (straightHigh >= 0) cat = Category.Straight;
  else if (rcCount[0] === 3) cat = Category.ThreeOfAKind;
  else if (rcCount[0] === 2 && rcCount[1] === 2) cat = Category.TwoPair;
  else if (rcCount[0] === 2) cat = Category.OnePair;
  else cat = Category.HighCard;

  let k0 = 0,
    k1 = 0,
    k2 = 0,
    k3 = 0,
    k4 = 0;
  switch (cat) {
    case Category.RoyalFlush:
    case Category.StraightFlush:
    case Category.Straight:
      k0 = straightHigh;
      break;
    case Category.FourOfAKind:
    case Category.FullHouse:
      k0 = rcRank[0];
      k1 = rcRank[1];
      break;
    case Category.ThreeOfAKind:
    case Category.TwoPair:
      k0 = rcRank[0];
      k1 = rcRank[1];
      k2 = rcRank[2];
      break;
    case Category.OnePair:
      k0 = rcRank[0];
      k1 = rcRank[1];
      k2 = rcRank[2];
      k3 = rcRank[3];
      break;
    case Category.Flush:
    case Category.HighCard:
      k0 = rcRank[0];
      k1 = rcRank[1];
      k2 = rcRank[2];
      k3 = rcRank[3];
      k4 = rcRank[4];
      break;
  }

  return (
    (cat << 20) |
    ((k0 & 0xf) << 16) |
    ((k1 & 0xf) << 12) |
    ((k2 & 0xf) << 8) |
    ((k3 & 0xf) << 4) |
    (k4 & 0xf)
  );
}

// Iterate all C(7,5)=21 subsets and return the best HandValue.
export function evaluate7(c: Card[]): number {
  let best = 0;
  const five = [0, 0, 0, 0, 0];
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      let k = 0;
      for (let m = 0; m < 7; m++) {
        if (m === i || m === j) continue;
        five[k++] = c[m];
      }
      const v = evaluate5(five);
      if (v > best) best = v;
    }
  }
  return best;
}

export function categoryOf(handValue: number): Category {
  return (handValue >>> 20) as Category;
}
