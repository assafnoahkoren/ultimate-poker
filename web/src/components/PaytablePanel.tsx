import type { TripsPaytable } from '../lib/trips';
import { TRIPS_ROW_LABELS } from '../lib/trips';

interface Props {
  paytable: TripsPaytable;
}

export function PaytablePanel({ paytable }: Props) {
  return (
    <div className="bg-feltDark/50 rounded-lg p-2 text-[10px] flex flex-col">
      <div className="text-white/50 uppercase tracking-wider mb-1">Trips</div>
      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-[2px]">
        {TRIPS_ROW_LABELS.map(({ key, short }) => (
          <div key={key} className="contents">
            <span className="text-white/70">{short}</span>
            <span className="text-white font-bold text-right">{paytable[key]}</span>
          </div>
        ))}
        <span className="text-white/70">Other</span>
        <span className="text-white/60 text-right">−1</span>
      </div>
    </div>
  );
}
