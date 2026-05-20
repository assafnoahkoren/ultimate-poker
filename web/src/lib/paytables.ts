// Blind ("Bet") paytable for Ultimate Texas Hold'em.
//
// Pays out on a winning hand of straight or higher, on a Num:Den ratio (e.g.
// Flush is 3:2 by default — bet 2 chips, win 3). Below straight on a winning
// hand the Blind pushes; on a losing hand it's lost outright.
//
// We keep the active paytable as a module-level singleton so the strategy
// and settlement code (which call blindRatio() everywhere) automatically
// pick up the user's edits without threading the paytable through every
// function signature. The App-level React state mirrors it for reactivity.

import { Category } from './eval';

export interface Ratio {
  num: number;
  den: number;
}

export interface BlindPaytable {
  royalFlush: Ratio;
  straightFlush: Ratio;
  fourOfAKind: Ratio;
  fullHouse: Ratio;
  flush: Ratio;
  straight: Ratio;
}

export const DEFAULT_BLIND: BlindPaytable = {
  royalFlush: { num: 500, den: 1 },
  straightFlush: { num: 50, den: 1 },
  fourOfAKind: { num: 10, den: 1 },
  fullHouse: { num: 3, den: 1 },
  flush: { num: 3, den: 2 },
  straight: { num: 1, den: 1 },
};

export const BLIND_ROW_LABELS: Array<{ key: keyof BlindPaytable; label: string; short: string }> = [
  { key: 'royalFlush', label: 'Royal flush', short: 'Royal' },
  { key: 'straightFlush', label: 'Straight flush', short: 'Str Flush' },
  { key: 'fourOfAKind', label: 'Four of a kind', short: '4 of Kind' },
  { key: 'fullHouse', label: 'Full house', short: 'Full' },
  { key: 'flush', label: 'Flush', short: 'Flush' },
  { key: 'straight', label: 'Straight', short: 'Straight' },
];

function clone(p: BlindPaytable): BlindPaytable {
  return {
    royalFlush: { ...p.royalFlush },
    straightFlush: { ...p.straightFlush },
    fourOfAKind: { ...p.fourOfAKind },
    fullHouse: { ...p.fullHouse },
    flush: { ...p.flush },
    straight: { ...p.straight },
  };
}

const STORAGE_KEY = 'uth-coach-blind-paytable';

export function loadBlindPaytable(): BlindPaytable {
  if (typeof localStorage === 'undefined') return clone(DEFAULT_BLIND);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_BLIND);
    const parsed = JSON.parse(raw) as Partial<Record<keyof BlindPaytable, Ratio>>;
    const out = clone(DEFAULT_BLIND);
    for (const k of Object.keys(out) as (keyof BlindPaytable)[]) {
      const v = parsed[k];
      if (
        v &&
        typeof v.num === 'number' &&
        typeof v.den === 'number' &&
        Number.isFinite(v.num) &&
        Number.isFinite(v.den) &&
        v.den !== 0
      ) {
        out[k] = { num: v.num, den: v.den };
      }
    }
    return out;
  } catch {
    return clone(DEFAULT_BLIND);
  }
}

export function saveBlindPaytable(p: BlindPaytable): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

// ---- active-paytable singleton ----

let _active: BlindPaytable = loadBlindPaytable();

export function getActiveBlindPaytable(): BlindPaytable {
  return _active;
}

export function setActiveBlindPaytable(p: BlindPaytable): void {
  _active = clone(p);
  saveBlindPaytable(_active);
}

// Returns the Blind payout ratio for a given hero hand category. Categories
// below Straight push on a win, so they return {0,1} ("push" is the empty
// ratio — settle() only applies blindRatio when heroCat >= Straight).
export function blindRatio(cat: number): Ratio {
  switch (cat) {
    case Category.RoyalFlush:
      return _active.royalFlush;
    case Category.StraightFlush:
      return _active.straightFlush;
    case Category.FourOfAKind:
      return _active.fourOfAKind;
    case Category.FullHouse:
      return _active.fullHouse;
    case Category.Flush:
      return _active.flush;
    case Category.Straight:
      return _active.straight;
  }
  return { num: 0, den: 1 };
}
