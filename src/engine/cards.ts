// Core card representation. A card is an integer 0..51.
// rank = card % 13 (0=2, 1=3, ... 8=T, 9=J, 10=Q, 11=K, 12=A)
// suit = floor(card / 13) (0=c, 1=d, 2=h, 3=s)

export type Card = number;

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['c', 'd', 'h', 's'] as const;
export const SUIT_SYMBOLS: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

export function rankOf(card: Card): number {
  return card % 13;
}

export function suitOf(card: Card): number {
  return Math.floor(card / 13);
}

export function makeCard(rank: number, suit: number): Card {
  return suit * 13 + rank;
}

export function cardToString(card: Card): string {
  return RANKS[rankOf(card)] + SUITS[suitOf(card)];
}

// Parse a card like "Ah", "Td", "2c" into a Card int.
export function parseCard(str: string): Card {
  const r = str[0].toUpperCase();
  const s = str[1].toLowerCase();
  const rank = RANKS.indexOf(r as (typeof RANKS)[number]);
  const suit = SUITS.indexOf(s as (typeof SUITS)[number]);
  if (rank < 0 || suit < 0) throw new Error(`Invalid card: ${str}`);
  return makeCard(rank, suit);
}

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < 52; i++) deck.push(i);
  return deck;
}

// Fisher-Yates shuffle, optionally seeded for reproducible deals.
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Simple seedable PRNG (mulberry32) for deterministic Monte Carlo / deals.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
