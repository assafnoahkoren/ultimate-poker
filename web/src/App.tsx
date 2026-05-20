import { useEffect, useState } from 'react';
import { GameView } from './components/GameView';
import { CardPicker } from './components/CardPicker';
import { ActionBar } from './components/ActionBar';
import { SettingsScreen } from './components/SettingsScreen';
import { BetRow } from './components/BetRow';
import type { GameState } from './lib/state';
import { initialState, pickCard } from './lib/state';
import type { TripsPaytable } from './lib/trips';
import { loadTripsPaytable, saveTripsPaytable } from './lib/trips';
import type { BetSettings } from './lib/bets';
import { loadBets, saveBets } from './lib/bets';

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
        />
      </div>

      <BetRow bets={bets} />

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
