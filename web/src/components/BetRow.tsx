import type { BetSettings } from '../lib/bets';
import { BET_FIELDS } from '../lib/bets';

interface Props {
  bets: BetSettings;
}

export function BetRow({ bets }: Props) {
  return (
    <div className="grid grid-cols-5 gap-1 px-1 py-1 bg-feltDark/60 border-t border-white/10">
      {BET_FIELDS.map(({ key, label }) => {
        const value = bets[key];
        const dim = value === 0;
        return (
          <div
            key={key}
            className={`rounded-md py-1 text-center ${
              dim ? 'bg-white/5 text-white/40' : 'bg-white/10 text-white'
            }`}
          >
            <div className="text-[9px] uppercase tracking-wider text-white/50 leading-tight">
              {label}
            </div>
            <div className="text-lg font-extrabold leading-tight">{value}</div>
          </div>
        );
      })}
    </div>
  );
}
