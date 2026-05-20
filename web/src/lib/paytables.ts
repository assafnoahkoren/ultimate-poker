// UTH-02 Blind paytable. The base game (Ante + Blind + Play) doesn't depend on
// the Trips paytable, so all four published variants share these numbers.

import { Category } from './eval';

export interface Ratio {
  num: number;
  den: number;
}

export const BLIND_PAYTABLE: Record<number, Ratio> = {
  [Category.RoyalFlush]: { num: 500, den: 1 },
  [Category.StraightFlush]: { num: 50, den: 1 },
  [Category.FourOfAKind]: { num: 10, den: 1 },
  [Category.FullHouse]: { num: 3, den: 1 },
  [Category.Flush]: { num: 3, den: 2 },
  [Category.Straight]: { num: 1, den: 1 },
};

export function blindRatio(cat: Category): Ratio {
  return BLIND_PAYTABLE[cat] ?? { num: 0, den: 1 };
}
