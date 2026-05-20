import { CATEGORY_LABELS } from '../lib/eval';
import type { GameState } from '../lib/state';
import { pickPrompt, reset, startGame } from '../lib/state';
import { CardChip } from './CardChip';
import type { FlopAction, PreFlopAction, RiverAction } from '../lib/strategy';

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
}

const actionLabel = (
  a: PreFlopAction | FlopAction | RiverAction | null
): { label: string; color: string } | null => {
  if (a === null) return null;
  switch (a) {
    case 'bet4x':
      return { label: 'BET 4×', color: 'bg-emerald-500 text-white' };
    case 'bet2x':
      return { label: 'BET 2×', color: 'bg-emerald-500 text-white' };
    case 'bet1x':
      return { label: 'BET 1×', color: 'bg-emerald-500 text-white' };
    case 'check':
      return { label: 'CHECK', color: 'bg-amber-400 text-black' };
    case 'fold':
      return { label: 'FOLD', color: 'bg-rose-500 text-white' };
  }
};

export function GameView({ state, setState }: Props) {
  const isSetup = state.phase.kind === 'setup';
  const isShowdown = state.phase.kind === 'showdown';

  const activePlayerIdx =
    state.phase.kind === 'dealing-holes' ? state.phase.playerIdx : -1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-feltDark/80 border-b border-white/10">
        <div className="text-xs uppercase tracking-widest text-white/60">UTH Coach</div>
        <div className="text-sm font-semibold">{pickPrompt(state)}</div>
        <button
          onClick={() => setState(reset())}
          className="text-xs px-2 py-1 rounded bg-white/10 active:bg-white/20"
        >
          Reset
        </button>
      </div>

      {isSetup ? (
        <SetupView state={state} setState={setState} />
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* Community cards */}
          <div className="bg-feltDark/50 rounded-lg p-2">
            <div className="text-[10px] uppercase text-white/50 mb-1">Board</div>
            <div className="flex gap-1.5 items-center">
              <CardChip card={state.board[0]} highlight={state.phase.kind === 'dealing-flop' && state.phase.slot === 0} />
              <CardChip card={state.board[1]} highlight={state.phase.kind === 'dealing-flop' && state.phase.slot === 1} />
              <CardChip card={state.board[2]} highlight={state.phase.kind === 'dealing-flop' && state.phase.slot === 2} />
              <div className="w-px h-12 bg-white/20 mx-1" />
              <CardChip card={state.board[3]} highlight={state.phase.kind === 'dealing-turn'} />
              <CardChip card={state.board[4]} highlight={state.phase.kind === 'dealing-river'} />
            </div>
          </div>

          {/* Dealer */}
          <div className="bg-feltDark/50 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase text-white/50">Dealer</div>
              {isShowdown && state.players[0]?.result && (
                <div className="text-xs">
                  {CATEGORY_LABELS[state.players[0].result.dealerCat]}
                  {!state.players[0].result.dealerQual && (
                    <span className="text-amber-300 ml-1">(no qual)</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <CardChip
                card={state.dealer[0]}
                highlight={state.phase.kind === 'dealing-dealer' && state.phase.slot === 0}
              />
              <CardChip
                card={state.dealer[1]}
                highlight={state.phase.kind === 'dealing-dealer' && state.phase.slot === 1}
              />
            </div>
          </div>

          {/* Players */}
          {state.players.map((p, i) => {
            const isActive = i === activePlayerIdx;
            const currentAction =
              state.phase.kind === 'preflop-advice'
                ? p.preFlop
                : state.phase.kind === 'flop-advice' && p.flop
                ? p.flop
                : state.phase.kind === 'river-advice' && p.river
                ? p.river
                : null;
            const committedAction = p.river ?? p.flop ?? p.preFlop;
            const action = currentAction ?? committedAction;
            const al = actionLabel(action);

            return (
              <div
                key={i}
                className={`bg-feltDark/50 rounded-lg p-2 ${
                  isActive ? 'ring-2 ring-yellow-400' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] uppercase text-white/50">
                    Player {i + 1}
                  </div>
                  {al && (
                    <div
                      className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${al.color}`}
                    >
                      {al.label}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <CardChip
                      card={p.hole[0]}
                      highlight={isActive && state.phase.kind === 'dealing-holes' && state.phase.slot === 0}
                    />
                    <CardChip
                      card={p.hole[1]}
                      highlight={isActive && state.phase.kind === 'dealing-holes' && state.phase.slot === 1}
                    />
                  </div>
                  {p.play > 0 && (
                    <div className="text-[11px] text-white/60">
                      Play {p.play}× · staked {2 + p.play}
                    </div>
                  )}
                  {p.folded && <div className="text-[11px] text-rose-300">folded</div>}
                  {isShowdown && p.result && (
                    <PlayerResult result={p.result} />
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

function SetupView({ state, setState }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <div className="text-lg font-semibold">Players at the table</div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            onClick={() => setState(startGame(state, n))}
            className="w-20 h-20 rounded-2xl bg-yellow-400 text-black text-3xl font-extrabold active:bg-yellow-500 shadow"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="text-xs text-white/50 text-center max-w-xs mt-2">
        Strategy: optimal rule-based · Ante and Blind = 1 chip each · UTH-02 paytable
      </div>
    </div>
  );
}

function PlayerResult({ result }: { result: NonNullable<import('../lib/strategy').SettleResult> }) {
  const sign = result.totalNet > 0 ? '+' : '';
  const color =
    result.totalNet > 0
      ? 'text-emerald-300'
      : result.totalNet < 0
      ? 'text-rose-300'
      : 'text-white/70';
  return (
    <div className="ml-auto text-right">
      <div className="text-[11px] text-white/70">
        {result.folded ? 'folded' : CATEGORY_LABELS[result.heroCat]}
      </div>
      <div className={`text-sm font-bold ${color}`}>
        {sign}
        {result.totalNet.toFixed(1)}
      </div>
    </div>
  );
}
