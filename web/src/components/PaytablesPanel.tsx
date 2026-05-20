import type { TripsPaytable } from '../lib/trips';
import { TRIPS_ROW_LABELS } from '../lib/trips';
import type { BonusPaytable } from '../lib/bonus';

interface Props {
  trips: TripsPaytable;
  bonus: BonusPaytable;
}

// Single compact reference panel that lists Trips and Bonus payouts
// side-by-side, replacing the two stacked panels and trimming a lot of
// vertical empty space below the dealer cards.
export function PaytablesPanel({ trips, bonus }: Props) {
  return (
    <div className="bg-feltDark/50 rounded-lg p-2 text-[10px]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-[2px] items-center">
        <span />
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
              {trips[key]}
            </span>
            <span className="text-white font-bold text-right tabular-nums">
              {bonus[key]}
            </span>
          </div>
        ))}
        <span className="text-white/70 whitespace-nowrap">Other</span>
        <span className="text-white/60 text-right tabular-nums">−1</span>
        <span className="text-white/60 text-right tabular-nums">0</span>
      </div>
    </div>
  );
}
