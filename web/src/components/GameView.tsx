import type React from 'react';
import { CATEGORY_LABELS } from '../lib/eval';
import type { GameState, PlayerState } from '../lib/state';
import {
  pickPrompt,
  reset,
  setFlopAction,
  setPreFlopAction,
  setRiverAction,
  startGame,
} from '../lib/state';
import { CardChip } from './CardChip';
import { PaytablesPanel } from './PaytablesPanel';
import type { TripsPaytable } from '../lib/trips';
import type { BonusPaytable } from '../lib/bonus';
import type {
  FlopAction,
  PreFlopAction,
  RiverAction,
  SettleResult,
} from '../lib/strategy';
import type { ScaledOutcome } from '../lib/scaledOutcome';

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
  paytable: TripsPaytable;
  bonusPaytable: BonusPaytable;
  onEditPaytable: () => void;
  scaledByPlayer?: (ScaledOutcome | null)[] | null;
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

export function GameView({ state, setState, paytable, bonusPaytable, onEditPaytable, scaledByPlayer }: Props) {
  const isSetup = state.phase.kind === 'setup';
  const isShowdown = state.phase.kind === 'showdown';

  const activePlayerIdx =
    state.phase.kind === 'dealing-holes' ? state.phase.playerIdx : -1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-feltDark/80 border-b border-white/10 gap-2">
        <div className="text-xs uppercase tracking-widest text-white/60 shrink-0">UTH Coach</div>
        <div className="text-sm font-semibold flex-1 text-center truncate">{pickPrompt(state)}</div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEditPaytable}
            aria-label="Edit paytable"
            className="p-1.5 rounded bg-white/10 active:bg-white/20 text-white/80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={() => setState(reset())}
            className="text-xs px-2 py-1 rounded bg-white/10 active:bg-white/20"
          >
            Reset
          </button>
        </div>
      </div>

      {isSetup ? (
        <SetupView state={state} setState={setState} />
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* Board + Dealer (left column) and Trips paytable (right column) */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 space-y-2">
              {/* Community cards */}
              <div className="bg-feltDark/50 rounded-lg p-2">
                <div className="text-[10px] uppercase text-white/50 mb-1">Board</div>
                <div className="flex gap-1.5 items-center flex-wrap">
                  <CardChip card={state.board[0]} size="sm" highlight={state.phase.kind === 'dealing-flop' && state.phase.slot === 0} />
                  <CardChip card={state.board[1]} size="sm" highlight={state.phase.kind === 'dealing-flop' && state.phase.slot === 1} />
                  <CardChip card={state.board[2]} size="sm" highlight={state.phase.kind === 'dealing-flop' && state.phase.slot === 2} />
                  <div className="w-px h-10 bg-white/20 mx-0.5" />
                  <CardChip card={state.board[3]} size="sm" highlight={state.phase.kind === 'dealing-turn'} />
                  <CardChip card={state.board[4]} size="sm" highlight={state.phase.kind === 'dealing-river'} />
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
                    size="sm"
                    highlight={state.phase.kind === 'dealing-dealer' && state.phase.slot === 0}
                  />
                  <CardChip
                    card={state.dealer[1]}
                    size="sm"
                    highlight={state.phase.kind === 'dealing-dealer' && state.phase.slot === 1}
                  />
                </div>
              </div>
            </div>

            {/* Combined Trips + Bonus paytables (compact, single panel) */}
            <div className="w-32 shrink-0">
              <PaytablesPanel trips={paytable} bonus={bonusPaytable} />
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
                    <PlayerResult
                      result={p.result}
                      scaled={scaledByPlayer?.[i] ?? null}
                    />
                  )}
                </div>
                {!isShowdown && <AdviceStats player={p} phase={state.phase.kind} />}
                {!isShowdown && (
                  <ActionButtons
                    state={state}
                    setState={setState}
                    playerIdx={i}
                  />
                )}
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

function fmtPct(x: number): string {
  return (x * 100).toFixed(1) + '%';
}

function fmtEV(x: number): string {
  const s = x >= 0 ? '+' : '';
  return s + x.toFixed(2);
}

function evColor(x: number): string {
  return x > 0.005 ? 'text-emerald-300' : x < -0.005 ? 'text-rose-300' : 'text-white/70';
}

function AdviceStats({
  player,
  phase,
}: {
  player: PlayerState;
  phase: GameState['phase']['kind'];
}) {
  // Pick the advice most relevant to the player's current commitment.
  let stats: { win: number; tie: number; lose: number; trials: number } | null = null;
  let chosenLabel = '';
  let altLabel = '';
  let evChosen = 0;
  let evAlt = 0;
  let stakeChosen = 0;
  let exact = false;

  if (player.riverAdv) {
    const a = player.riverAdv;
    stats = a.stats;
    exact = true;
    if (a.action === 'bet1x') {
      chosenLabel = 'bet 1×';
      altLabel = 'fold';
      evChosen = a.evBet;
      evAlt = a.evFold;
      stakeChosen = a.stakeBet;
    } else {
      chosenLabel = 'fold';
      altLabel = 'bet 1×';
      evChosen = a.evFold;
      evAlt = a.evBet;
      stakeChosen = a.stakeFold;
    }
  } else if (player.flopAdv) {
    const a = player.flopAdv;
    stats = a.stats;
    if (a.action === 'bet2x') {
      chosenLabel = 'bet 2×';
      altLabel = 'check';
      evChosen = a.evBet;
      evAlt = a.evCheck;
      stakeChosen = a.stakeBet;
    } else {
      chosenLabel = 'check';
      altLabel = 'bet 2×';
      evChosen = a.evCheck;
      evAlt = a.evBet;
      stakeChosen = a.stakeCheck;
    }
  } else if (player.preFlopAdv) {
    const a = player.preFlopAdv;
    stats = a.stats;
    if (a.action === 'bet4x') {
      chosenLabel = 'bet 4×';
      altLabel = 'check';
      evChosen = a.evBet;
      evAlt = a.evCheck;
      stakeChosen = a.stakeBet;
    } else {
      chosenLabel = 'check';
      altLabel = 'bet 4×';
      evChosen = a.evCheck;
      evAlt = a.evBet;
      stakeChosen = a.stakeBet; // not really staked when checking, but shown for context
    }
  }

  if (!stats) return null;

  // Only show stats at advice phases (or later) to avoid showing stale numbers
  // during card-picking phases for prior advice.
  const showFor =
    phase === 'preflop-advice' ||
    phase === 'flop-advice' ||
    phase === 'river-advice' ||
    phase === 'dealing-flop' ||
    phase === 'dealing-turn' ||
    phase === 'dealing-river' ||
    phase === 'dealing-dealer';
  if (!showFor) return null;

  return (
    <div className="mt-2 px-2 py-1.5 rounded bg-black/20 text-[11px] leading-tight">
      <div className="flex items-center gap-3 text-white/70">
        <span>
          W <span className="text-white">{fmtPct(stats.win)}</span>
        </span>
        <span>
          T <span className="text-white">{fmtPct(stats.tie)}</span>
        </span>
        <span>
          L <span className="text-white">{fmtPct(stats.lose)}</span>
        </span>
        <span className="ml-auto text-white/40 text-[10px]">
          {exact ? `exact (n=${stats.trials})` : `MC n=${stats.trials}`}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-white/70">
          {chosenLabel}{' '}
          <span className={`font-bold ${evColor(evChosen)}`}>{fmtEV(evChosen)}</span>
        </span>
        <span className="text-white/40">vs</span>
        <span className="text-white/70">
          {altLabel}{' '}
          <span className={`font-bold ${evColor(evAlt)}`}>{fmtEV(evAlt)}</span>
        </span>
        {stakeChosen > 0 && (
          <span className="ml-auto text-white/40 text-[10px]">
            stake {stakeChosen}
          </span>
        )}
      </div>
    </div>
  );
}

function ActionButtons({
  state,
  setState,
  playerIdx,
}: {
  state: GameState;
  setState: (s: GameState) => void;
  playerIdx: number;
}) {
  const p = state.players[playerIdx];
  if (!p) return null;
  const phase = state.phase.kind;

  if (phase === 'preflop-advice' && p.preFlopAdv) {
    const opt = p.preFlopAdv.action;
    const sel = p.preFlop;
    return (
      <ButtonRow>
        <ChoiceButton
          label="CHECK"
          selected={sel === 'check'}
          optimal={opt === 'check'}
          selectedClass="bg-amber-400 text-black"
          onClick={() => setState(setPreFlopAction(state, playerIdx, 'check'))}
        />
        <ChoiceButton
          label="BET 4×"
          selected={sel === 'bet4x'}
          optimal={opt === 'bet4x'}
          selectedClass="bg-emerald-500 text-white"
          onClick={() => setState(setPreFlopAction(state, playerIdx, 'bet4x'))}
        />
      </ButtonRow>
    );
  }

  if (phase === 'flop-advice' && p.flopAdv) {
    const opt = p.flopAdv.action;
    const sel = p.flop;
    return (
      <ButtonRow>
        <ChoiceButton
          label="CHECK"
          selected={sel === 'check'}
          optimal={opt === 'check'}
          selectedClass="bg-amber-400 text-black"
          onClick={() => setState(setFlopAction(state, playerIdx, 'check'))}
        />
        <ChoiceButton
          label="BET 2×"
          selected={sel === 'bet2x'}
          optimal={opt === 'bet2x'}
          selectedClass="bg-emerald-500 text-white"
          onClick={() => setState(setFlopAction(state, playerIdx, 'bet2x'))}
        />
      </ButtonRow>
    );
  }

  if (phase === 'river-advice' && p.riverAdv) {
    const opt = p.riverAdv.action;
    const sel = p.river;
    return (
      <ButtonRow>
        <ChoiceButton
          label="FOLD"
          selected={sel === 'fold'}
          optimal={opt === 'fold'}
          selectedClass="bg-rose-500 text-white"
          onClick={() => setState(setRiverAction(state, playerIdx, 'fold'))}
        />
        <ChoiceButton
          label="BET 1×"
          selected={sel === 'bet1x'}
          optimal={opt === 'bet1x'}
          selectedClass="bg-emerald-500 text-white"
          onClick={() => setState(setRiverAction(state, playerIdx, 'bet1x'))}
        />
      </ButtonRow>
    );
  }
  return null;
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 mt-2">{children}</div>;
}

function ChoiceButton({
  label,
  selected,
  optimal,
  selectedClass,
  onClick,
}: {
  label: string;
  selected: boolean;
  optimal: boolean;
  selectedClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative py-2 rounded font-extrabold text-xs flex items-center justify-center gap-1 transition-colors ${
        selected
          ? `${selectedClass} shadow`
          : 'bg-white/10 text-white/70 active:bg-white/20'
      }`}
    >
      <span>{label}</span>
      {optimal && (
        <span
          className={`text-[10px] leading-none ${
            selected ? 'opacity-80' : 'text-yellow-300'
          }`}
          aria-label="optimal"
          title="strategy's recommended action"
        >
          ★
        </span>
      )}
    </button>
  );
}

function SetupView({
  state,
  setState,
}: {
  state: GameState;
  setState: (s: GameState) => void;
}) {
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
        Pre-flop: Wizard rules · Flop: live MC (1000 trials) · River: exact
        EV (990 dealer hands) · Ante &amp; Blind = 1 chip · UTH-02 paytable
      </div>
    </div>
  );
}

function PlayerResult({
  result,
  scaled,
}: {
  result: NonNullable<SettleResult>;
  scaled: ScaledOutcome | null;
}) {
  const total = scaled?.total ?? result.totalNet;
  const sign = total > 0 ? '+' : '';
  const color =
    total > 0
      ? 'text-emerald-300'
      : total < 0
      ? 'text-rose-300'
      : 'text-white/70';
  return (
    <div className="ml-auto text-right">
      <div className="text-[11px] text-white/70">
        {result.folded ? 'folded' : CATEGORY_LABELS[result.heroCat]}
      </div>
      <div className={`text-sm font-bold ${color} tabular-nums`}>
        {sign}
        {Number.isInteger(total) ? total : total.toFixed(1)}
      </div>
    </div>
  );
}
