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
  SettleResult,
} from './strategy';
import { preFlopDecision, flopDecision, riverDecision, settle } from './strategy';

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
}

export function initialState(): GameState {
  return {
    numPlayers: 2,
    players: [],
    board: [null, null, null, null, null],
    dealer: [null, null],
    picked: new Set(),
    phase: { kind: 'setup' },
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
  };
}

export function reset(): GameState {
  return initialState();
}

// Called when the user taps a card. Adds the card to the appropriate slot
// based on the current phase and advances the state machine.
export function pickCard(state: GameState, card: Card): GameState {
  if (state.picked.has(card)) return state;
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

function applyPreFlopAdvice(state: GameState): GameState {
  const players = state.players.map((p) => {
    if (p.hole[0] === null || p.hole[1] === null) return p;
    const action = preFlopDecision([p.hole[0], p.hole[1]]);
    return {
      ...p,
      preFlop: action,
      play: action === 'bet4x' ? 4 : 0,
    };
  });
  return { ...state, players, phase: { kind: 'preflop-advice' } };
}

function applyFlopAdvice(state: GameState): GameState {
  const flop = state.board.slice(0, 3) as [Card, Card, Card];
  const players = state.players.map((p) => {
    if (p.preFlop === 'bet4x' || p.hole[0] === null || p.hole[1] === null) return p;
    const action = flopDecision([p.hole[0], p.hole[1]], flop);
    return {
      ...p,
      flop: action,
      play: action === 'bet2x' ? 2 : p.play,
    };
  });
  return { ...state, players, phase: { kind: 'flop-advice' } };
}

function applyRiverAdvice(state: GameState): GameState {
  const board = state.board as [Card, Card, Card, Card, Card];
  const players = state.players.map((p) => {
    if (p.play > 0 || p.hole[0] === null || p.hole[1] === null) return p;
    // Build otherHoles (the 2 hole cards of every other player) — known to us.
    const otherHoles: Card[] = [];
    for (const other of state.players) {
      if (other === p) continue;
      if (other.hole[0] !== null) otherHoles.push(other.hole[0]);
      if (other.hole[1] !== null) otherHoles.push(other.hole[1]);
    }
    const action = riverDecision([p.hole[0], p.hole[1]], board, otherHoles);
    return {
      ...p,
      river: action,
      play: action === 'bet1x' ? 1 : 0,
      folded: action === 'fold',
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
export function advance(state: GameState): GameState {
  switch (state.phase.kind) {
    case 'preflop-advice':
      // If every player committed to bet 4x or folded somehow, skip to dealer.
      // Otherwise proceed to flop.
      if (state.players.every((p) => p.play > 0)) {
        return { ...state, phase: { kind: 'dealing-dealer', slot: 0 } };
      }
      return { ...state, phase: { kind: 'dealing-flop', slot: 0 } };
    case 'flop-advice':
      // If every player is committed (bet pre-flop OR bet at flop), skip to dealer.
      if (state.players.every((p) => p.play > 0)) {
        return { ...state, phase: { kind: 'dealing-dealer', slot: 0 } };
      }
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
