import { useEffect, useMemo, useState } from 'react';
import { GameView } from './components/GameView';
import { CardPicker } from './components/CardPicker';
import { ActionBar } from './components/ActionBar';
import { SettingsScreen } from './components/SettingsScreen';
import { BetRow } from './components/BetRow';
import type { BetPayouts } from './components/BetRow';
import type { GameState } from './lib/state';
import { initialState, pickCard } from './lib/state';
import type { TripsPaytable } from './lib/trips';
import { loadTripsPaytable, saveTripsPaytable } from './lib/trips';
import type { BetSettings } from './lib/bets';
import { loadBets, saveBets } from './lib/bets';
import type { ScaledOutcome } from './lib/scaledOutcome';
import { scaleOutcome } from './lib/scaledOutcome';

export default function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [paytable, setPaytable] = useState<TripsPaytable>(() => loadTripsPaytable());
  const [bets, setBets] = useState<BetSettings>(() => loadBets());
  const [editingSettings, setEditingSettings] = useState(false);

  useEffect(() => {
    saveTripsPaytable(paytable);
  }, [paytable]);

  useEffect(() => {
    saveBets(bets);
  }, [bets]);

  // Player 1's Play multiplier (4 / 2 / 1 / 0) — the bet row reflects one
  // player's perspective; other players' wagers and outcomes live in their
  // individual rows below. The × suffix in the Play box marks this as the
  // multiplier of the Ante, not a chip count.
  const play = state.players[0]?.play ?? 0;

  // Per-player scaled outcomes — scales the ante=1 settlement results by the
  // user's bet sizes and computes Trips from the paytable.
  const scaledByPlayer = useMemo<(ScaledOutcome | null)[] | null>(() => {
    if (state.phase.kind !== 'showdown') return null;
    return state.players.map((p) =>
      p.result ? scaleOutcome(p.result, bets, paytable) : null
    );
  }, [state, bets, paytable]);

  // At showdown, surface Player 1's scaled outcome above each bet.
  const payouts: BetPayouts | null = useMemo(() => {
    const s = scaledByPlayer?.[0];
    if (!s) return null;
    return {
      bet: s.bet,
      ante: s.ante,
      play: s.play,
      trips: s.trips,
      bonus: s.bonus,
    };
  }, [scaledByPlayer]);

  const pickerDisabled =
    state.phase.kind === 'setup' ||
    state.phase.kind === 'preflop-advice' ||
    state.phase.kind === 'flop-advice' ||
    state.phase.kind === 'river-advice' ||
    state.phase.kind === 'showdown';

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 min-h-0 overflow-hidden">
        <GameView
          state={state}
          setState={setState}
          paytable={paytable}
          onEditPaytable={() => setEditingSettings(true)}
          scaledByPlayer={scaledByPlayer}
        />
      </div>

      <BetRow bets={bets} play={play} payouts={payouts} />

      <div className="border-t-2 border-white/10 bg-felt p-1">
        <CardPicker
          picked={state.picked}
          onPick={(c) => setState(pickCard(state, c))}
          disabled={pickerDisabled}
        />
      </div>

      <ActionBar state={state} setState={setState} />

      {editingSettings && (
        <SettingsScreen
          paytable={paytable}
          setPaytable={setPaytable}
          bets={bets}
          setBets={setBets}
          onClose={() => setEditingSettings(false)}
        />
      )}
    </div>
  );
}
