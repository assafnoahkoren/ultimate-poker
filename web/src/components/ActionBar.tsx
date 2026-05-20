import type { GameState } from '../lib/state';
import { advance, startGame } from '../lib/state';

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
}

export function ActionBar({ state, setState }: Props) {
  const phase = state.phase.kind;
  const isAdvice =
    phase === 'preflop-advice' ||
    phase === 'flop-advice' ||
    phase === 'river-advice';
  const isShowdown = phase === 'showdown';
  const enabled = isAdvice || isShowdown;

  const label = isShowdown
    ? 'Next hand'
    : isAdvice
    ? 'Continue →'
    : phase === 'setup'
    ? 'Choose number of players'
    : 'Pick cards to continue';

  const onClick = () => {
    if (isShowdown) setState(startGame(state, state.numPlayers));
    else if (isAdvice) setState(advance(state));
  };

  return (
    <div className="px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-feltDark border-t border-white/10">
      <button
        onClick={onClick}
        disabled={!enabled}
        className={`
          w-full py-3 rounded-lg font-extrabold text-base transition-colors
          ${enabled
            ? 'bg-yellow-400 text-black active:bg-yellow-500 shadow'
            : 'bg-white/10 text-white/40'}
        `}
      >
        {label}
      </button>
    </div>
  );
}
