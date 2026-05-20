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
import type { BetSettings } from '../lib/bets';
import { BET_FIELDS, DEFAULT_BETS } from '../lib/bets';

interface Props {
  paytable: TripsPaytable;
  setPaytable: (p: TripsPaytable) => void;
  bets: BetSettings;
  setBets: (b: BetSettings) => void;
  onClose: () => void;
}

export function SettingsScreen({
  paytable,
  setPaytable,
  bets,
  setBets,
  onClose,
}: Props) {
  const ret = tripsReturn(paytable);

  const updatePay = (key: keyof TripsPaytable, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setPaytable({ ...paytable, [key]: n });
  };

  const updateBet = (key: keyof BetSettings, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setBets({ ...bets, [key]: n });
  };

  return (
    <div className="absolute inset-0 z-50 bg-feltDark flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-feltDark border-b border-white/10">
        <div className="text-sm font-semibold">Settings</div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPaytable({ ...DEFAULT_TRIPS });
              setBets({ ...DEFAULT_BETS });
            }}
            className="text-xs px-2 py-1 rounded bg-white/10 active:bg-white/20"
          >
            Reset all
          </button>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 rounded bg-yellow-400 text-black font-bold active:bg-yellow-500"
          >
            Done
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Bet sizes */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-white/60">
            Bet sizes (same for all players)
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {BET_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col">
                <label className="text-[10px] uppercase text-white/50 text-center mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={bets[key]}
                  onChange={(e) => updateBet(key, e.target.value)}
                  className="w-full bg-white/10 rounded px-1.5 py-2 text-center text-white font-extrabold text-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/40">
            Play is dynamic (4× / 2× / 1× × Ante driven by the strategy) so
            it's not editable here. Trips and Bonus are placeholders.
          </div>
        </section>

        {/* Trips paytable */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-white/60">
            Trips paytable
          </h2>
          <div className="text-[11px] text-white/60">
            Combinations are fixed (over all C(52,7) = {TRIPS_TOTAL_COMBOS.toLocaleString()} 7-card deals).
            Edit "Pays" to see the return shift.
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
                      onChange={(e) => updatePay(key, e.target.value)}
                      className="w-full bg-white/10 rounded px-1.5 py-1 text-right text-white font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                  <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
                    {(prob * 100).toFixed(3)}%
                  </div>
                  <div className="px-2 py-1.5 text-right tabular-nums">
                    {r >= 0 ? '+' : ''}
                    {r.toFixed(5)}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-[1.4fr_1fr_0.9fr_1fr_1.1fr] text-xs items-center border-t border-white/10 bg-white/5">
              <div className="px-2 py-1.5 text-white/70">All other</div>
              <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
                {TRIPS_COMBOS.allOther.toLocaleString()}
              </div>
              <div className="px-2 py-1.5 text-right text-white/60">−1</div>
              <div className="px-2 py-1.5 text-right text-white/60 tabular-nums">
                {(probabilityOf('allOther') * 100).toFixed(3)}%
              </div>
              <div className="px-2 py-1.5 text-right text-rose-300 tabular-nums">
                −{(TRIPS_COMBOS.allOther / TRIPS_TOTAL_COMBOS).toFixed(5)}
              </div>
            </div>

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

          <div className="text-[11px] text-white/60">
            <span className="text-white/40">House edge:</span>{' '}
            <span className="font-bold">{(-ret * 100).toFixed(3)}%</span>{' '}
            <span className="text-white/40">on the Trips bet</span>
          </div>
        </section>
      </div>
    </div>
  );
}
