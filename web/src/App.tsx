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
import type { BonusPaytable } from './lib/bonus';
import { loadBonusPaytable, saveBonusPaytable } from './lib/bonus';
import type { BlindPaytable } from './lib/paytables';
import { loadBlindPaytable, setActiveBlindPaytable } from './lib/paytables';
import type { BetSettings } from './lib/bets';
import { loadBets, saveBets } from './lib/bets';
import type { ScaledOutcome } from './lib/scaledOutcome';
import { scaleOutcome } from './lib/scaledOutcome';
import { settle } from './lib/strategy';
import type { SettleResult } from './lib/strategy';
import type { Card } from './lib/cards';

export default function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [paytable, setPaytable] = useState<TripsPaytable>(() => loadTripsPaytable());
  const [bonusPaytable, setBonusPaytable] = useState<BonusPaytable>(() => loadBonusPaytable());
  const [blindPaytable, setBlindPaytableState] = useState<BlindPaytable>(() => loadBlindPaytable());
  const [bets, setBets] = useState<BetSettings>(() => loadBets());
  const [editingSettings, setEditingSettings] = useState(false);

  // Keep the module-level singleton in sync with React state synchronously,
  // so any settle() / blindRatio() call inside the next render uses the
  // edited paytable. The setter also persists to localStorage.
  const setBlindPaytable = (p: BlindPaytable) => {
    setActiveBlindPaytable(p);
    setBlindPaytableState(p);
  };

  useEffect(() => {
    saveTripsPaytable(paytable);
  }, [paytable]);

  useEffect(() => {
    saveBonusPaytable(bonusPaytable);
  }, [bonusPaytable]);

  useEffect(() => {
    saveBets(bets);
  }, [bets]);

  // Player 1's Play multiplier (4 / 2 / 1 / 0) — the bet row reflects one
  // player's perspective; other players' wagers and outcomes live in their
  // individual rows below. The × suffix in the Play box marks this as the
  // multiplier of the Ante, not a chip count.
  const play = state.players[0]?.play ?? 0;

  // Re-settle every player at showdown using the *current* Blind paytable.
  // The state machine's stored p.result was computed with whatever Blind
  // paytable was active when the showdown phase fired; if the user edits the
  // paytable later we recompute here so the displayed payouts stay live.
  const playerResults = useMemo<(SettleResult | null)[] | null>(() => {
    if (state.phase.kind !== 'showdown') return null;
    const board = state.board;
    const dealer = state.dealer;
    if (
      board[0] === null ||
      board[1] === null ||
      board[2] === null ||
      board[3] === null ||
      board[4] === null ||
      dealer[0] === null ||
      dealer[1] === null
    ) {
      return null;
    }
    const fullBoard: [Card, Card, Card, Card, Card] = [
      board[0], board[1], board[2], board[3], board[4],
    ];
    const fullDealer: [Card, Card] = [dealer[0], dealer[1]];
    return state.players.map((p) => {
      if (p.hole[0] === null || p.hole[1] === null) return null;
      return settle(
        [p.hole[0], p.hole[1]],
        fullBoard,
        fullDealer,
        p.play,
        p.folded
      );
    });
    // Re-run when blindPaytable changes so settle picks up the new ratios
    // (settle calls blindRatio() which reads the singleton we keep in sync).
  }, [state, blindPaytable]);

  // Per-player scaled outcomes — scales the ante=1 settlement results by the
  // user's bet sizes and computes Trips + Bonus from their paytables.
  const scaledByPlayer = useMemo<(ScaledOutcome | null)[] | null>(() => {
    if (state.phase.kind !== 'showdown' || !playerResults) return null;
    const flop =
      state.board[0] !== null &&
      state.board[1] !== null &&
      state.board[2] !== null
        ? ([state.board[0], state.board[1], state.board[2]] as [Card, Card, Card])
        : null;
    return state.players.map((p, i) => {
      const r = playerResults[i];
      if (!r || p.hole[0] === null || p.hole[1] === null) return null;
      return scaleOutcome(
        r,
        [p.hole[0], p.hole[1]],
        flop,
        bets,
        paytable,
        bonusPaytable
      );
    });
  }, [state, playerResults, bets, paytable, bonusPaytable]);

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
          bonusPaytable={bonusPaytable}
          blindPaytable={blindPaytable}
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
          bonusPaytable={bonusPaytable}
          setBonusPaytable={setBonusPaytable}
          blindPaytable={blindPaytable}
          setBlindPaytable={setBlindPaytable}
          bets={bets}
          setBets={setBets}
          onClose={() => setEditingSettings(false)}
        />
      )}
    </div>
  );
}
