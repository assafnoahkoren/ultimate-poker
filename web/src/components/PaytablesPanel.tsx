import type { TripsPaytable } from '../lib/trips';
import { TRIPS_ROW_LABELS } from '../lib/trips';
import type { BonusPaytable } from '../lib/bonus';
import type { BlindPaytable } from '../lib/paytables';

interface Props {
  trips: TripsPaytable;
  bonus: BonusPaytable;
  blind: BlindPaytable;
}

// Format a Blind ratio like 3:2 → "3:2", 50:1 → "50". Categories below
// Straight aren't in the Blind paytable (push on win, lose on loss), so
// we render "—" for those rows.
function fmtBlind(blind: BlindPaytable, key: string): string {
  const r = (blind as unknown as Record<string, { num: number; den: number } | undefined>)[key];
  if (!r) return '—';
  if (r.den === 1) return String(r.num);
  return `${r.num}:${r.den}`;
}

// Single compact reference panel listing Bet (Blind), Trips, and Bonus
// payouts side-by-side. The panel sizes itself to its content so labels
// don't wrap.
export function PaytablesPanel({ trips, bonus, blind }: Props) {
  return (
    <div className="bg-feltDark/50 rounded-lg p-2 text-[10px]">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-[2px] items-center">
        <span />
        <span className="text-[9px] text-white/45 uppercase tracking-wider text-right font-semibold">
          Bet
        </span>
        <span className="text-[9px] text-white/45 uppercase tracking-wider text-right font-semibold">
          Trips
        </span>
        <span className="text-[9px] text-white/45 uppercase tracking-wider text-right font-semibold">
          Bonus
        </span>
        {TRIPS_ROW_LABELS.map(({ key, short }) => (
          <div key={key} className="contents">
            <span className="text-white/70 whitespace-nowrap">{short}</span>
            <span className="text-white font-bold text-right tabular-nums">
              {fmtBlind(blind, key)}
            </span>
            <span className="text-white font-bold text-right tabular-nums">
              {trips[key]}
            </span>
            <span className="text-white font-bold text-right tabular-nums">
              {bonus[key]}
            </span>
          </div>
        ))}
        <span className="text-white/70 whitespace-nowrap">Other</span>
        <span className="text-white/60 text-right tabular-nums">—</span>
        <span className="text-white/60 text-right tabular-nums">−1</span>
        <span className="text-white/60 text-right tabular-nums">0</span>
      </div>
    </div>
  );
}
