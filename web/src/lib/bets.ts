// Bet-size settings shown in the row above the card picker.
//
// These are display-only for now — the underlying game logic still settles
// with ante = blind = 1 — so editing them changes the chip labels but not the
// strategy's chosen actions. Trips and Bonus are placeholders for future
// integration with the Trips paytable and a (not-yet-implemented) Bonus
// wager.

// Play is excluded from this struct — it's dynamic (4× / 2× / 1× × Ante,
// driven by the strategy's chosen action) and rendered from per-hand state,
// not from settings.
export interface BetSettings {
  bet: number;
  ante: number;
  trips: number;
  bonus: number;
}

export const DEFAULT_BETS: BetSettings = {
  bet: 1,
  ante: 1,
  trips: 0,
  bonus: 0,
};

export const BET_FIELDS: Array<{ key: keyof BetSettings; label: string }> = [
  { key: 'bet', label: 'Bet' },
  { key: 'ante', label: 'Ante' },
  { key: 'trips', label: 'Trips' },
  { key: 'bonus', label: 'Bonus' },
];

const STORAGE_KEY = 'uth-coach-bets';

export function loadBets(): BetSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_BETS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BETS };
    const parsed = JSON.parse(raw) as Partial<BetSettings>;
    const out = { ...DEFAULT_BETS };
    for (const k of Object.keys(out) as (keyof BetSettings)[]) {
      const v = parsed[k];
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_BETS };
  }
}

export function saveBets(b: BetSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // ignore
  }
}
