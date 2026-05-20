// Card: packed uint8, rank = c >> 2, suit = c & 3.
// Ranks: 0=2, 1=3, ..., 8=T, 9=J, 10=Q, 11=K, 12=A.
// Suits: 0=♣, 1=♦, 2=♥, 3=♠.

export type Card = number;
export type Rank = number; // 0..12
export type Suit = number; // 0..3

export const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];
export const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];

export function makeCard(rank: Rank, suit: Suit): Card {
  return rank * 4 + suit;
}

export function rankOf(c: Card): Rank {
  return c >> 2;
}

export function suitOf(c: Card): Suit {
  return c & 3;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 1 || suit === 2; // diamonds, hearts
}

export function cardLabel(c: Card): string {
  return RANK_LABELS[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];
}

export const ALL_CARDS: Card[] = Array.from({ length: 52 }, (_, i) => i);
