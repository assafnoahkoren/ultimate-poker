// Common Progressive Bonus side bet for UTH.
//
// Pays are on a "for one" basis (the win amount *includes* the stake) — so
// "9" on Three of a Kind means a $1 bet gets $9 back, net profit $8.
// Combinations are over all C(52, 5) = 2,598,960 5-card hands made from the
// player's 2 hole cards + the 3 flop cards (turn/river are not used).

export interface BonusPaytable {
  royalFlush: number;
  straightFlush: number;
  fourOfAKind: number;
  fullHouse: number;
  flush: number;
  straight: number;
  threeOfAKind: number;
}

export const BONUS_COMBOS = {
  royalFlush: 4,
  straightFlush: 36,
  fourOfAKind: 624,
  fullHouse: 3_744,
  flush: 5_108,
  straight: 10_200,
  threeOfAKind: 54_912,
  allOther: 2_524_332,
} as const;

export const BONUS_TOTAL_COMBOS = 2_598_960;

// Default: matches the "Common Progressive" table with a $1000 base jackpot
// (Royal = 100% of jackpot, Straight Flush = 10%). Adjust to taste in settings.
export const DEFAULT_BONUS: BonusPaytable = {
  royalFlush: 1000,
  straightFlush: 100,
  fourOfAKind: 300,
  fullHouse: 50,
  flush: 40,
  straight: 30,
  threeOfAKind: 9,
};

export const BONUS_ROW_LABELS: Array<{ key: keyof BonusPaytable; label: string; short: string }> = [
  { key: 'royalFlush', label: 'Royal flush', short: 'Royal' },
  { key: 'straightFlush', label: 'Straight flush', short: 'Str Flush' },
  { key: 'fourOfAKind', label: 'Four of a kind', short: '4 of Kind' },
  { key: 'fullHouse', label: 'Full house', short: 'Full' },
  { key: 'flush', label: 'Flush', short: 'Flush' },
  { key: 'straight', label: 'Straight', short: 'Straight' },
  { key: 'threeOfAKind', label: 'Three of a kind', short: '3 of Kind' },
];

export function bonusProbability(key: keyof BonusPaytable | 'allOther'): number {
  return BONUS_COMBOS[key] / BONUS_TOTAL_COMBOS;
}

// Per-row "for-one" return contribution = pays × probability.
export function bonusRowReturn(key: keyof BonusPaytable, p: BonusPaytable): number {
  return (p[key] * BONUS_COMBOS[key]) / BONUS_TOTAL_COMBOS;
}

// Total player return per unit bet on the "for one" basis:
//   sum(pays × prob_win) − 1
// (losing rows contribute −1 × prob_lose, which is folded into the −1).
export function bonusReturn(p: BonusPaytable): number {
  let weighted = 0;
  for (const { key } of BONUS_ROW_LABELS) {
    weighted += p[key] * BONUS_COMBOS[key];
  }
  return weighted / BONUS_TOTAL_COMBOS - 1;
}

const STORAGE_KEY = 'uth-coach-bonus-paytable';

export function loadBonusPaytable(): BonusPaytable {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_BONUS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BONUS };
    const parsed = JSON.parse(raw) as Partial<BonusPaytable>;
    const out = { ...DEFAULT_BONUS };
    for (const k of Object.keys(out) as (keyof BonusPaytable)[]) {
      const v = parsed[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_BONUS };
  }
}

export function saveBonusPaytable(p: BonusPaytable): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
