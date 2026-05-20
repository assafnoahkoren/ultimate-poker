import type { TripsPaytable } from '../lib/trips';
import {
  DEFAULT_TRIPS,
  TRIPS_COMBOS,
  TRIPS_ROW_LABELS,
  TRIPS_TOTAL_COMBOS,
  probabilityOf,
  rowReturn,
  tripsReturn,
} from '../lib/trips';

interface Props {
  paytable: TripsPaytable;
  setPaytable: (p: TripsPaytable) => void;
  onClose: () => void;
}

export function SettingsScreen({ paytable, setPaytable, onClose }: Props) {
  const ret = tripsReturn(paytable);

  const update = (key: keyof TripsPaytable, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setPaytable({ ...paytable, [key]: n });
  };

  return (
    <div className="absolute inset-0 z-50 bg-feltDark/95 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-feltDark border-b border-white/10">
        <div className="text-sm font-semibold">Trips paytable</div>
        <div className="flex gap-2">
          <button
            onClick={() => setPaytable({ ...DEFAULT_TRIPS })}
            className="text-xs px-2 py-1 rounded bg-white/10 active:bg-white/20"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 rounded bg-yellow-400 text-black font-bold active:bg-yellow-500"
          >
            Done
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="text-[11px] text-white/60">
          Combinations are fixed (across all C(52,7) = {TRIPS_TOTAL_COMBOS.toLocaleString()} possible 7-card hands).
          Edit "Pays" to see how the return changes.
        </div>

        <div className="rounded-lg overflow-hidden border border-white/10">
          <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr] text-[10px] uppercase tracking-wider bg-white/5 text-white/50">
            <div className="px-2 py-1.5">Hand</div>
            <div className="px-2 py-1.5 text-right">Combos</div>
            <div className="px-2 py-1.5 text-right">Pays</div>
            <div className="px-2 py-1.5 text-right">Prob</div>
            <div className="px-2 py-1.5 text-right">Return</div>
          </div>

          {TRIPS_ROW_LABELS.map(({ key, label }) => {
            const prob = probabilityOf(key);
            const r = rowReturn(key, paytable);
            return (
              <div
                key={key}
                className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr] text-xs items-center border-t border-white/10"
              >
                <div className="px-2 py-1.5">{label}</div>
                <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
                  {TRIPS_COMBOS[key].toLocaleString()}
                </div>
                <div className="px-1 py-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={paytable[key]}
                    onChange={(e) => update(key, e.target.value)}
                    className="w-full bg-white/10 rounded px-1.5 py-1 text-right text-white font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
                  {prob.toFixed(6)}
                </div>
                <div className="px-2 py-1.5 text-right tabular-nums">
                  {r >= 0 ? '+' : ''}
                  {r.toFixed(5)}
                </div>
              </div>
            );
          })}

          {/* All other (loses 1) */}
          <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr] text-xs items-center border-t border-white/10 bg-white/5">
            <div className="px-2 py-1.5 text-white/70">All other</div>
            <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
              {TRIPS_COMBOS.allOther.toLocaleString()}
            </div>
            <div className="px-2 py-1.5 text-right text-white/60">−1</div>
            <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
              {probabilityOf('allOther').toFixed(6)}
            </div>
            <div className="px-2 py-1.5 text-right text-rose-300 tabular-nums">
              −{(TRIPS_COMBOS.allOther / TRIPS_TOTAL_COMBOS).toFixed(5)}
            </div>
          </div>

          {/* Total */}
          <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr] text-sm font-bold items-center border-t border-white/10 bg-black/30">
            <div className="px-2 py-2">Total</div>
            <div className="px-2 py-2 text-right text-white/60 tabular-nums">
              {TRIPS_TOTAL_COMBOS.toLocaleString()}
            </div>
            <div className="px-2 py-2 text-right text-white/60">—</div>
            <div className="px-2 py-2 text-right text-white/60">1</div>
            <div
              className={`px-2 py-2 text-right tabular-nums ${
                ret > 0 ? 'text-emerald-300' : ret < 0 ? 'text-rose-300' : 'text-white'
              }`}
            >
              {ret >= 0 ? '+' : ''}
              {ret.toFixed(5)}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-white/60 space-y-1">
          <div>
            <span className="text-white/40">House edge:</span>{' '}
            <span className="font-bold">
              {(-ret * 100).toFixed(3)}%
            </span>{' '}
            <span className="text-white/40">on the Trips bet</span>
          </div>
          <div className="text-white/40">
            Note: the Trips wager doesn't currently participate in the
            game — this is a reference table you can edit and inspect.
          </div>
        </div>
      </div>
    </div>
  );
}
