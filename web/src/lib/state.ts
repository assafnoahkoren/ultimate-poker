// Game state machine for the UTH coach.
//
// Flow:
//   1. setup: choose number of players (1..6)
//   2. dealing-holes (for each player): pick 2 cards
//   3. preflop-advice: show each player's pre-flop recommendation (auto-applied)
//   4. dealing-flop: pick 3 community cards
//   5. flop-advice: show flop recommendation for each player still pending
//   6. dealing-turn-river: pick 2 cards
//   7. river-advice: show river recommendation
//   8. dealing-dealer: pick dealer's 2 hole cards
//   9. showdown: per-player win/lose/tie with chip outcomes
//
// Each "advice" step also auto-applies the recommended action to that
// player's committed Play wager so the simulation progresses cleanly.

import type { Card } from './cards';
import type {
  PreFlopAction,
  FlopAction,
  RiverAction,
  PreFlopAdvice,
  FlopAdvice,
  RiverAdvice,
  SettleResult,
} from './strategy';
import { preFlopAdvice, flopAdvice, riverAdvice, settle } from './strategy';

export type Phase =
  | { kind: 'setup' }
  | { kind: 'dealing-holes'; playerIdx: number; slot: 0 | 1 }
  | { kind: 'preflop-advice' }
  | { kind: 'dealing-flop'; slot: 0 | 1 | 2 }
  | { kind: 'flop-advice' }
  | { kind: 'dealing-turn' }
  | { kind: 'dealing-river' }
  | { kind: 'river-advice' }
  | { kind: 'dealing-dealer'; slot: 0 | 1 }
  | { kind: 'showdown' };

export interface PlayerState {
  hole: [Card | null, Card | null];
  // The play wager actually committed (0, 1, 2, or 4 × ante).
  play: number;
  folded: boolean;
  // Per-phase decision made by the optimal strategy.
  preFlop: PreFlopAction | null;
  flop: FlopAction | null;
  river: RiverAction | null;
  // Per-phase advice details for the UI to display (equity + EV + stake).
  preFlopAdv: PreFlopAdvice | null;
  flopAdv: FlopAdvice | null;
  riverAdv: RiverAdvice | null;
  // Final settlement (set during showdown).
  result: SettleResult | null;
}

export interface GameState {
  numPlayers: number;
  players: PlayerState[];
  board: [Card | null, Card | null, Card | null, Card | null, Card | null];
  dealer: [Card | null, Card | null];
  picked: Set<Card>;
  phase: Phase;
  // Stack of prior states. Pushed on every card pick so we can undo back to
  // before the last pick (which also reverses any auto-applied advice).
  history: GameState[];
}

export function initialState(): GameState {
  return {
    numPlayers: 2,
    players: [],
    board: [null, null, null, null, null],
    dealer: [null, null],
    picked: new Set(),
    phase: { kind: 'setup' },
    history: [],
  };
}

export function newPlayer(): PlayerState {
  return {
    hole: [null, null],
    play: 0,
    folded: false,
    preFlop: null,
    flop: null,
    river: null,
    preFlopAdv: null,
    flopAdv: null,
    riverAdv: null,
    result: null,
  };
}

export function startGame(state: GameState, numPlayers: number): GameState {
  const players = Array.from({ length: numPlayers }, newPlayer);
  return {
    ...state,
    numPlayers,
    players,
    picked: new Set(),
    board: [null, null, null, null, null],
    dealer: [null, null],
    phase: { kind: 'dealing-holes', playerIdx: 0, slot: 0 },
    history: [],
  };
}

export function reset(): GameState {
  return initialState();
}

// Called when the user taps a card. Adds the card to the appropriate slot
// based on the current phase and advances the state machine. The previous
// state is pushed onto the history stack so `undo` can revert this pick.
export function pickCard(state: GameState, card: Card): GameState {
  if (state.picked.has(card)) return state;
  const snapshot = state;
  const result = pickCardInternal(state, card);
  return { ...result, history: [...state.history, snapshot] };
}

// Revert the last card pick. Returns the prior state (which itself has the
// history up to that point, so additional undos keep walking backward).
export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  return state.history[state.history.length - 1];
}

function pickCardInternal(state: GameState, card: Card): GameState {
  const picked = new Set(state.picked);
  picked.add(card);

  const next: GameState = { ...state, picked };

  switch (state.phase.kind) {
    case 'dealing-holes': {
      const { playerIdx, slot } = state.phase;
      const players = state.players.map((p, i) => {
        if (i !== playerIdx) return p;
        const hole = [...p.hole] as [Card | null, Card | null];
        hole[slot] = card;
        return { ...p, hole };
      });
      next.players = players;
      // Advance to next slot/player/phase.
      if (slot === 0) {
        next.phase = { kind: 'dealing-holes', playerIdx, slot: 1 };
      } else if (playerIdx + 1 < state.numPlayers) {
        next.phase = { kind: 'dealing-holes', playerIdx: playerIdx + 1, slot: 0 };
      } else {
        // All players' hole cards picked — apply pre-flop strategy.
        return applyPreFlopAdvice(next);
      }
      return next;
    }
    case 'dealing-flop': {
      const { slot } = state.phase;
      const board = [...state.board] as GameState['board'];
      board[slot] = card;
      next.board = board;
      if (slot < 2) {
        next.phase = { kind: 'dealing-flop', slot: (slot + 1) as 0 | 1 | 2 };
      } else {
        return applyFlopAdvice(next);
      }
      return next;
    }
    case 'dealing-turn': {
      const board = [...state.board] as GameState['board'];
      board[3] = card;
      next.board = board;
      next.phase = { kind: 'dealing-river' };
      return next;
    }
    case 'dealing-river': {
      const board = [...state.board] as GameState['board'];
      board[4] = card;
      next.board = board;
      return applyRiverAdvice(next);
    }
    case 'dealing-dealer': {
      const { slot } = state.phase;
      const dealer = [...state.dealer] as [Card | null, Card | null];
      dealer[slot] = card;
      next.dealer = dealer;
      if (slot === 0) {
        next.phase = { kind: 'dealing-dealer', slot: 1 };
      } else {
        return applyShowdown(next);
      }
      return next;
    }
    default:
      return state;
  }
}

function otherHolesOf(state: GameState, exceptIdx: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < state.players.length; i++) {
    if (i === exceptIdx) continue;
    const other = state.players[i];
    if (other.hole[0] !== null) out.push(other.hole[0]);
    if (other.hole[1] !== null) out.push(other.hole[1]);
  }
  return out;
}

function applyPreFlopAdvice(state: GameState): GameState {
  const players = state.players.map((p, i) => {
    if (p.hole[0] === null || p.hole[1] === null) return p;
    const adv = preFlopAdvice([p.hole[0], p.hole[1]], otherHolesOf(state, i));
    return {
      ...p,
      preFlop: adv.action,
      preFlopAdv: adv,
      play: adv.action === 'bet4x' ? 4 : 0,
    };
  });
  return { ...state, players, phase: { kind: 'preflop-advice' } };
}

function applyFlopAdvice(state: GameState): GameState {
  const flop = state.board.slice(0, 3) as [Card, Card, Card];
  const players = state.players.map((p, i) => {
    if (p.preFlop === 'bet4x' || p.hole[0] === null || p.hole[1] === null) return p;
    const adv = flopAdvice([p.hole[0], p.hole[1]], flop, otherHolesOf(state, i));
    return {
      ...p,
      flop: adv.action,
      flopAdv: adv,
      play: adv.action === 'bet2x' ? 2 : p.play,
    };
  });
  return { ...state, players, phase: { kind: 'flop-advice' } };
}

function applyRiverAdvice(state: GameState): GameState {
  const board = state.board as [Card, Card, Card, Card, Card];
  const players = state.players.map((p, i) => {
    if (p.play > 0 || p.hole[0] === null || p.hole[1] === null) return p;
    const adv = riverAdvice([p.hole[0], p.hole[1]], board, otherHolesOf(state, i));
    return {
      ...p,
      river: adv.action,
      riverAdv: adv,
      play: adv.action === 'bet1x' ? 1 : 0,
      folded: adv.action === 'fold',
    };
  });
  return { ...state, players, phase: { kind: 'river-advice' } };
}

function applyShowdown(state: GameState): GameState {
  const board = state.board as [Card, Card, Card, Card, Card];
  const dealer = state.dealer as [Card, Card];
  const players = state.players.map((p) => {
    if (p.hole[0] === null || p.hole[1] === null) return p;
    const result = settle([p.hole[0], p.hole[1]], board, dealer, p.play, p.folded);
    return { ...p, result };
  });
  return { ...state, players, phase: { kind: 'showdown' } };
}

// Manually advance from an advice screen to the next dealing phase.
//
// We always walk through every street (flop, turn, river) even when every
// player has already committed a bet, so the full board can be entered and
// the showdown can be evaluated against the real cards (e.g. to see whether
// the dealer ended up winning anyway).
export function advance(state: GameState): GameState {
  switch (state.phase.kind) {
    case 'preflop-advice':
      return { ...state, phase: { kind: 'dealing-flop', slot: 0 } };
    case 'flop-advice':
      return { ...state, phase: { kind: 'dealing-turn' } };
    case 'river-advice':
      return { ...state, phase: { kind: 'dealing-dealer', slot: 0 } };
    default:
      return state;
  }
}

export function pickPrompt(state: GameState): string {
  switch (state.phase.kind) {
    case 'setup':
      return 'Choose number of players';
    case 'dealing-holes': {
      const { playerIdx, slot } = state.phase;
      return `Player ${playerIdx + 1} — hole card ${slot + 1} of 2`;
    }
    case 'preflop-advice':
      return 'Pre-flop decisions';
    case 'dealing-flop':
      return `Flop card ${state.phase.slot + 1} of 3`;
    case 'flop-advice':
      return 'Flop decisions';
    case 'dealing-turn':
      return 'Turn card';
    case 'dealing-river':
      return 'River card';
    case 'river-advice':
      return 'River decisions';
    case 'dealing-dealer':
      return `Dealer hole card ${state.phase.slot + 1} of 2`;
    case 'showdown':
      return 'Showdown';
  }
}
