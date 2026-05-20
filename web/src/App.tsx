import { useState } from 'react';
import { GameView } from './components/GameView';
import { CardPicker } from './components/CardPicker';
import { ActionBar } from './components/ActionBar';
import type { GameState } from './lib/state';
import { initialState, pickCard } from './lib/state';

export default function App() {
  const [state, setState] = useState<GameState>(initialState);

  const pickerDisabled =
    state.phase.kind === 'setup' ||
    state.phase.kind === 'preflop-advice' ||
    state.phase.kind === 'flop-advice' ||
    state.phase.kind === 'river-advice' ||
    state.phase.kind === 'showdown';

  return (
    <div className="flex flex-col h-full">
      {/* Top: game state */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <GameView state={state} setState={setState} />
      </div>

      {/* Card picker */}
      <div className="border-t-2 border-white/10 bg-felt p-1">
        <CardPicker
          picked={state.picked}
          onPick={(c) => setState(pickCard(state, c))}
          disabled={pickerDisabled}
        />
      </div>

      {/* Persistent action bar */}
      <ActionBar state={state} setState={setState} />
    </div>
  );
}
