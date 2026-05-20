import type { BetSettings } from '../lib/bets';

export type BetPayouts = {
  bet: number;
  ante: number;
  play: number;
  trips: number;
  bonus: number;
};

interface Props {
  bets: BetSettings;
  play: number; // dynamic — derived from the player's committed multiplier × Ante
  payouts?: BetPayouts | null;
}

function fmtPayout(p: number): string {
  if (Math.abs(p) < 0.01) return '0';
  const sign = p > 0 ? '+' : '';
  return sign + (Number.isInteger(p) ? p.toString() : p.toFixed(1));
}

function payoutColor(p: number): string {
  if (p > 0.005) return 'text-emerald-300';
  if (p < -0.005) return 'text-rose-300';
  return 'text-white/50';
}

export function BetRow({ bets, play, payouts }: Props) {
  const cells: Array<{ key: keyof BetPayouts; label: string; value: number }> = [
    { key: 'bet', label: 'Bet', value: bets.bet },
    { key: 'ante', label: 'Ante', value: bets.ante },
    { key: 'play', label: 'Play', value: play },
    { key: 'trips', label: 'Trips', value: bets.trips },
    { key: 'bonus', label: 'Bonus', value: bets.bonus },
  ];

  return (
    <div className="grid grid-cols-5 gap-1 px-1 py-1 bg-feltDark/60 border-t border-white/10">
      {cells.map(({ key, label, value }) => {
        const dim = value === 0 && !payouts;
        const payout = payouts ? payouts[key] : undefined;
        return (
          <div
            key={key}
            className={`rounded-md py-1 text-center ${
              dim ? 'bg-white/5 text-white/40' : 'bg-white/10 text-white'
            }`}
          >
            {payout !== undefined && (
              <div
                className={`text-[11px] font-extrabold leading-tight tabular-nums ${payoutColor(
                  payout
                )}`}
              >
                {fmtPayout(payout)}
              </div>
            )}
            <div className="text-[9px] uppercase tracking-wider text-white/50 leading-tight">
              {label}
            </div>
            <div className="text-lg font-extrabold leading-tight tabular-nums">
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
