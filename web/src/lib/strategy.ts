// Strategy for Ultimate Texas Hold'em with EV-aware reporting.
//
// Each phase's advice function returns both the recommended action AND the
// underlying stats (equity + EV under each action + stake committed) so the
// UI can show why the strategy is choosing what it chose.
//
//   Pre-flop:  rule-based decision (matches Wizard published list);
//              MC stats for display.
//   Flop:      decision = P(win) > P(lose) from a 1000-trial MC;
//              stats include EV under bet-2× vs check-and-bet-1× using the
//              actual paytable (so Blind 3:2 on flush, etc. are weighted).
//   River:     exact 990-dealer-hand enumeration; bet 1× iff EV(bet) >
//              EV(fold) = −2 ante.

import type { Card } from './cards';
import { rankOf, suitOf } from './cards';
import type { Category } from './eval';
import { Category as Cat, categoryOf, evaluate7 } from './eval';
import { blindRatio } from './paytables';

export type PreFlopAction = 'check' | 'bet4x';
export type FlopAction = 'check' | 'bet2x';
export type RiverAction = 'fold' | 'bet1x';

// Aggregated stats from MC or exact enumeration.
//
// Outcome model per (hero vs dealer) sample:
//   net = anteBlind + play × playSign
// where:
//   anteBlind  = ante + blind result (depends on dealer-qualify rule + paytable)
//   playSign   = +1 on win, −1 on loss, 0 on tie
//   play       = the Play wager size (4× / 2× / 1× / 0× depending on phase)
//
// EV under a play size P is `evNonPlay + P × playSign` (both averaged).
export interface AdviceStats {
  win: number;      // P(win)
  tie: number;      // P(tie)
  lose: number;     // P(lose)
  trials: number;   // sample size (or exact-enum count)
  evNonPlay: number;
  playSign: number;
  // Pre-computed convenience values:
  equity: number;   // P(win) + 0.5·P(tie)
}

export interface PreFlopAdvice {
  action: PreFlopAction;
  stats: AdviceStats;
  evBet: number;        // EV per hand if bet 4× pre-flop
  evCheck: number;      // EV per hand if check (approx: bet 1× at river)
  stakeBet: number;     // total chips committed if bet (ante+blind+play)
  stakeCheck: number;
}

export interface FlopAdvice {
  action: FlopAction;
  stats: AdviceStats;
  evBet: number;        // EV per hand if bet 2× at flop
  evCheck: number;      // EV per hand if check (approx: bet 1× at river)
  stakeBet: number;
  stakeCheck: number;
}

export interface RiverAdvice {
  action: RiverAction;
  stats: AdviceStats;
  evBet: number;        // EV per hand if bet 1× at river
  evFold: number;       // always −2 ante (sunk ante + blind)
  stakeBet: number;
  stakeFold: number;
}

// ---------- decision helpers (existing rule for pre-flop) ----------

function shouldBet4xPreFlop(h: [Card, Card]): boolean {
  const r1 = rankOf(h[0]);
  const r2 = rankOf(h[1]);
  const suited = suitOf(h[0]) === suitOf(h[1]);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  if (r1 === r2) return r1 >= 1; // pair 3s+
  if (high === 12) return true;
  if (high === 11) return suited ? true : low >= 3;
  if (high === 10) return suited ? low >= 4 : low >= 6;
  if (high === 9) return suited ? low >= 6 : low === 8;
  return false;
}

// ---------- shared accumulator ----------

interface Accum {
  wins: number;
  ties: number;
  losses: number;
  sumNonPlay: number;
  sumPlaySign: number;
}

// Increment the accumulator from a single hero-vs-dealer showdown.
function record(
  hhv: number,
  dhv: number,
  heroCat: Category,
  dealerCat: Category,
  acc: Accum
): void {
  const dealerQual = dealerCat >= Cat.OnePair;
  if (hhv > dhv) {
    acc.wins++;
    const ante = dealerQual ? 1 : 0;
    let blind = 0;
    if (heroCat >= Cat.Straight) {
      const r = blindRatio(heroCat);
      blind = r.num / r.den;
    }
    acc.sumNonPlay += ante + blind;
    acc.sumPlaySign += 1;
  } else if (hhv < dhv) {
    acc.losses++;
    const ante = dealerQual ? -1 : 0;
    acc.sumNonPlay += ante - 1; // -1 for blind loss
    acc.sumPlaySign -= 1;
  } else {
    acc.ties++;
  }
}

function buildPool(hole: [Card, Card], visibleBoard: Card[], otherHoles: Card[]): Card[] {
  const inDeck = new Array(52).fill(true);
  inDeck[hole[0]] = false;
  inDeck[hole[1]] = false;
  for (const c of visibleBoard) inDeck[c] = false;
  for (const c of otherHoles) inDeck[c] = false;
  const pool: Card[] = [];
  for (let i = 0; i < 52; i++) if (inDeck[i]) pool.push(i);
  return pool;
}

function finalize(acc: Accum, trials: number): AdviceStats {
  const win = acc.wins / trials;
  const tie = acc.ties / trials;
  const lose = acc.losses / trials;
  return {
    win,
    tie,
    lose,
    trials,
    evNonPlay: acc.sumNonPlay / trials,
    playSign: acc.sumPlaySign / trials,
    equity: win + 0.5 * tie,
  };
}

// ---------- Monte Carlo for pre-flop and flop ----------

function mcSample(
  hole: [Card, Card],
  visibleBoard: Card[],
  otherHoles: Card[],
  trials: number
): AdviceStats {
  const pool = buildPool(hole, visibleBoard, otherHoles);
  const needBoard = 5 - visibleBoard.length;
  const needed = 2 + needBoard;

  const hero7: number[] = [hole[0], hole[1], 0, 0, 0, 0, 0];
  const dealer7: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < visibleBoard.length; i++) {
    hero7[2 + i] = visibleBoard[i];
    dealer7[2 + i] = visibleBoard[i];
  }

  const acc: Accum = { wins: 0, ties: 0, losses: 0, sumNonPlay: 0, sumPlaySign: 0 };

  for (let t = 0; t < trials; t++) {
    // Partial Fisher-Yates over pool: take first `needed` cards.
    for (let i = 0; i < needed; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    dealer7[0] = pool[0];
    dealer7[1] = pool[1];
    for (let i = 0; i < needBoard; i++) {
      hero7[2 + visibleBoard.length + i] = pool[2 + i];
      dealer7[2 + visibleBoard.length + i] = pool[2 + i];
    }
    const hhv = evaluate7(hero7);
    const dhv = evaluate7(dealer7);
    record(hhv, dhv, categoryOf(hhv), categoryOf(dhv), acc);
  }
  return finalize(acc, trials);
}

// ---------- Exact enumeration for river ----------

function exactRiver(
  hole: [Card, Card],
  board: [Card, Card, Card, Card, Card],
  otherHoles: Card[]
): AdviceStats {
  const pool = buildPool(hole, board, otherHoles);

  const hero7: number[] = [hole[0], hole[1], board[0], board[1], board[2], board[3], board[4]];
  const dealer7: number[] = [0, 0, board[0], board[1], board[2], board[3], board[4]];
  const hhv = evaluate7(hero7);
  const heroCat = categoryOf(hhv);

  const acc: Accum = { wins: 0, ties: 0, losses: 0, sumNonPlay: 0, sumPlaySign: 0 };
  let combos = 0;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      dealer7[0] = pool[i];
      dealer7[1] = pool[j];
      const dhv = evaluate7(dealer7);
      record(hhv, dhv, heroCat, categoryOf(dhv), acc);
      combos++;
    }
  }
  return finalize(acc, combos);
}

// ---------- phase-specific advice ----------

const PREFLOP_TRIALS = 2000;
const FLOP_TRIALS = 1000;

export function preFlopAdvice(
  hole: [Card, Card],
  otherHoles: Card[] = []
): PreFlopAdvice {
  const stats = mcSample(hole, [], otherHoles, PREFLOP_TRIALS);
  const action: PreFlopAction = shouldBet4xPreFlop(hole) ? 'bet4x' : 'check';
  const evBet = stats.evNonPlay + 4 * stats.playSign;
  const evCheck = stats.evNonPlay + 1 * stats.playSign;
  return {
    action,
    stats,
    evBet,
    evCheck,
    stakeBet: 6, // ante + blind + 4× play
    stakeCheck: 3, // ante + blind + 1× play (assuming bet at river)
  };
}

export function flopAdvice(
  hole: [Card, Card],
  flop: [Card, Card, Card],
  otherHoles: Card[] = []
): FlopAdvice {
  const stats = mcSample(hole, [flop[0], flop[1], flop[2]], otherHoles, FLOP_TRIALS);
  // Decision: bet 2× iff EV(bet 2×) > EV(check + bet 1× at river). The non-
  // play parts cancel, so this is equivalent to playSign > 0 (i.e. P(win) >
  // P(lose)). We use the EV diff directly to be explicit.
  const evBet = stats.evNonPlay + 2 * stats.playSign;
  const evCheck = stats.evNonPlay + 1 * stats.playSign;
  const action: FlopAction = evBet > evCheck ? 'bet2x' : 'check';
  return {
    action,
    stats,
    evBet,
    evCheck,
    stakeBet: 4, // ante + blind + 2× play
    stakeCheck: 3, // ante + blind + 1× play
  };
}

export function riverAdvice(
  hole: [Card, Card],
  board: [Card, Card, Card, Card, Card],
  otherHoles: Card[] = []
): RiverAdvice {
  const stats = exactRiver(hole, board, otherHoles);
  const evBet = stats.evNonPlay + 1 * stats.playSign;
  const evFold = -2;
  const action: RiverAction = evBet > evFold ? 'bet1x' : 'fold';
  return {
    action,
    stats,
    evBet,
    evFold,
    stakeBet: 3, // ante + blind + 1× play
    stakeFold: 2, // ante + blind (lost)
  };
}

// ---------- showdown settlement (unchanged) ----------

export interface SettleResult {
  anteNet: number;
  blindNet: number;
  playNet: number;
  totalNet: number;
  heroCat: Category;
  dealerCat: Category;
  dealerQual: boolean;
  folded: boolean;
}

export function settle(
  hole: [Card, Card],
  board: [Card, Card, Card, Card, Card],
  dealer: [Card, Card],
  play: number,
  folded: boolean
): SettleResult {
  const ante = 1;
  const hero7 = [hole[0], hole[1], board[0], board[1], board[2], board[3], board[4]];
  const dealer7 = [dealer[0], dealer[1], board[0], board[1], board[2], board[3], board[4]];
  const heroHV = evaluate7(hero7);
  const dealerHV = evaluate7(dealer7);
  const heroCat = categoryOf(heroHV);
  const dealerCat = categoryOf(dealerHV);
  const dealerQual = dealerCat >= Cat.OnePair;

  if (folded) {
    return {
      anteNet: -ante,
      blindNet: -ante,
      playNet: 0,
      totalNet: -2 * ante,
      heroCat,
      dealerCat,
      dealerQual,
      folded: true,
    };
  }

  let anteNet = 0;
  let blindNet = 0;
  let playNet = 0;
  if (heroHV > dealerHV) {
    if (dealerQual) anteNet = ante;
    playNet = play;
    if (heroCat >= Cat.Straight) {
      const r = blindRatio(heroCat);
      blindNet = (ante * r.num) / r.den;
    }
  } else if (heroHV < dealerHV) {
    if (dealerQual) anteNet = -ante;
    blindNet = -ante;
    playNet = -play;
  }
  return {
    anteNet,
    blindNet,
    playNet,
    totalNet: anteNet + blindNet + playNet,
    heroCat,
    dealerCat,
    dealerQual,
    folded: false,
  };
}
