// Trips bonus paytable (UTH base game has Trips as an optional side bet).
//
// Combinations are fixed: they're the count of 5-card hand categories produced
// by the best-five-of-seven across all C(52, 7) = 133,784,560 random 7-card
// deals. "All other" lumps high card + pair + two pair together (Trips loses
// on anything below three of a kind).
//
// Pays are user-editable. The "return" column is Pays × Probability and the
// total return = sum(Pays × Prob); house edge = −total return.

export interface TripsPaytable {
  royalFlush: number;
  straightFlush: number;
  fourOfAKind: number;
  fullHouse: number;
  flush: number;
  straight: number;
  threeOfAKind: number;
}

export const TRIPS_COMBOS = {
  royalFlush: 4_324,
  straightFlush: 37_260,
  fourOfAKind: 224_848,
  fullHouse: 3_473_184,
  flush: 4_047_644,
  straight: 6_180_020,
  threeOfAKind: 6_461_620,
  allOther: 113_355_660,
} as const;

export const TRIPS_TOTAL_COMBOS = 133_784_560;

// UTH-02 Trips: 50 / 40 / 30 / 8 / 6 / 5 / 3 → -1.904% return.
export const DEFAULT_TRIPS: TripsPaytable = {
  royalFlush: 50,
  straightFlush: 40,
  fourOfAKind: 30,
  fullHouse: 8,
  flush: 6,
  straight: 5,
  threeOfAKind: 3,
};

export const TRIPS_ROW_LABELS: Array<{ key: keyof TripsPaytable; label: string; short: string }> = [
  { key: 'royalFlush', label: 'Royal flush', short: 'Royal' },
  { key: 'straightFlush', label: 'Straight flush', short: 'Str Flush' },
  { key: 'fourOfAKind', label: 'Four of a kind', short: '4 of Kind' },
  { key: 'fullHouse', label: 'Full house', short: 'Full' },
  { key: 'flush', label: 'Flush', short: 'Flush' },
  { key: 'straight', label: 'Straight', short: 'Straight' },
  { key: 'threeOfAKind', label: 'Three of a kind', short: '3 of Kind' },
];

export function probabilityOf(key: keyof TripsPaytable | 'allOther'): number {
  return TRIPS_COMBOS[key] / TRIPS_TOTAL_COMBOS;
}

// Return per unit Trips wager: sum of pay × probability across all categories.
// "All other" loses one unit.
export function tripsReturn(p: TripsPaytable): number {
  let weighted = 0;
  for (const { key } of TRIPS_ROW_LABELS) {
    weighted += p[key] * TRIPS_COMBOS[key];
  }
  weighted += -1 * TRIPS_COMBOS.allOther;
  return weighted / TRIPS_TOTAL_COMBOS;
}

// Per-row return for display.
export function rowReturn(key: keyof TripsPaytable, p: TripsPaytable): number {
  return (p[key] * TRIPS_COMBOS[key]) / TRIPS_TOTAL_COMBOS;
}

const STORAGE_KEY = 'uth-coach-trips-paytable';

export function loadTripsPaytable(): TripsPaytable {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_TRIPS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TRIPS };
    const parsed = JSON.parse(raw) as Partial<TripsPaytable>;
    const merged = { ...DEFAULT_TRIPS };
    for (const k of Object.keys(merged) as (keyof TripsPaytable)[]) {
      const v = parsed[k];
      if (typeof v === 'number' && Number.isFinite(v)) merged[k] = v;
    }
    return merged;
  } catch {
    return { ...DEFAULT_TRIPS };
  }
}

export function saveTripsPaytable(p: TripsPaytable): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
