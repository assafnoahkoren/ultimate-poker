import type { GameState } from '../lib/state';
import { advance, startGame, undo } from '../lib/state';

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

  const canBack = state.history.length > 0;
  const onBack = () => setState(undo(state));

  return (
    <div className="flex items-stretch gap-2 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-feltDark border-t border-white/10">
      <button
        onClick={onBack}
        disabled={!canBack}
        aria-label="Undo last card"
        className={`
          w-12 rounded-lg flex items-center justify-center transition-colors
          ${canBack
            ? 'bg-white/15 text-white active:bg-white/25'
            : 'bg-white/5 text-white/25'}
        `}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
        </svg>
      </button>
      <button
        onClick={onClick}
        disabled={!enabled}
        className={`
          flex-1 py-3 rounded-lg font-extrabold text-base transition-colors
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
