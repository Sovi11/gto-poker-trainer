import { Card, rankOf, suitOf } from './cards';

// Hand category ranks, high = better.
export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

export const CATEGORY_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

// Pack a category + up to 5 tiebreaker ranks (0..12) into one comparable int.
function pack(category: number, tiebreakers: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) {
    score = score * 13 + (tiebreakers[i] ?? 0);
  }
  return score;
}

// Highest rank that completes a straight given a rank-presence boolean array.
// Returns the high card rank of the straight, or -1.
function straightHigh(present: boolean[]): number {
  // Ace can be low: treat as below 2.
  const wheel = present[12] && present[3] && present[2] && present[1] && present[0];
  for (let high = 12; high >= 4; high--) {
    if (present[high] && present[high - 1] && present[high - 2] && present[high - 3] && present[high - 4]) {
      return high;
    }
  }
  if (wheel) return 3; // 5-high straight (A-2-3-4-5), high card is the 5 (rank index 3)
  return -1;
}

// Evaluate exactly 5 cards. Returns a comparable integer score.
export function evaluate5(cards: Card[]): number {
  const rankCounts = new Array(13).fill(0);
  const suitCounts = new Array(4).fill(0);
  const suitRanks: number[][] = [[], [], [], []];

  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    rankCounts[r]++;
    suitCounts[s]++;
    suitRanks[s].push(r);
  }

  // Flush?
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) flushSuit = s;
  }

  const present = rankCounts.map((c) => c > 0);

  // Straight flush
  if (flushSuit >= 0) {
    const flushPresent = new Array(13).fill(false);
    for (const r of suitRanks[flushSuit]) flushPresent[r] = true;
    const sfHigh = straightHigh(flushPresent);
    if (sfHigh >= 0) return pack(CATEGORY.STRAIGHT_FLUSH, [sfHigh]);
  }

  // Group ranks by count for n-of-a-kind detection.
  const byCount: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] > 0) byCount[rankCounts[r]].push(r);
  }

  // Quads
  if (byCount[4].length) {
    const quad = byCount[4][0];
    const kicker = highestExcluding(rankCounts, [quad]);
    return pack(CATEGORY.QUADS, [quad, kicker]);
  }

  // Full house
  if (byCount[3].length >= 2) {
    return pack(CATEGORY.FULL_HOUSE, [byCount[3][0], byCount[3][1]]);
  }
  if (byCount[3].length === 1 && byCount[2].length >= 1) {
    return pack(CATEGORY.FULL_HOUSE, [byCount[3][0], byCount[2][0]]);
  }

  // Flush
  if (flushSuit >= 0) {
    const fr = suitRanks[flushSuit].slice().sort((a, b) => b - a).slice(0, 5);
    return pack(CATEGORY.FLUSH, fr);
  }

  // Straight
  const sHigh = straightHigh(present);
  if (sHigh >= 0) return pack(CATEGORY.STRAIGHT, [sHigh]);

  // Trips
  if (byCount[3].length === 1) {
    const trip = byCount[3][0];
    const kickers = topExcluding(rankCounts, [trip], 2);
    return pack(CATEGORY.TRIPS, [trip, ...kickers]);
  }

  // Two pair
  if (byCount[2].length >= 2) {
    const [p1, p2] = byCount[2];
    const kicker = highestExcluding(rankCounts, [p1, p2]);
    return pack(CATEGORY.TWO_PAIR, [p1, p2, kicker]);
  }

  // One pair
  if (byCount[2].length === 1) {
    const pair = byCount[2][0];
    const kickers = topExcluding(rankCounts, [pair], 3);
    return pack(CATEGORY.PAIR, [pair, ...kickers]);
  }

  // High card
  const highs = topExcluding(rankCounts, [], 5);
  return pack(CATEGORY.HIGH_CARD, highs);
}

function highestExcluding(rankCounts: number[], exclude: number[]): number {
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] > 0 && !exclude.includes(r)) return r;
  }
  return 0;
}

function topExcluding(rankCounts: number[], exclude: number[], n: number): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (rankCounts[r] > 0 && !exclude.includes(r)) out.push(r);
  }
  return out;
}

const COMBOS_7_CHOOSE_5: number[][] = (() => {
  const res: number[][] = [];
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) res.push([a, b, c, d, e]);
  return res;
})();

// Evaluate the best 5-card hand out of 5, 6, or 7 cards.
export function evaluateBest(cards: Card[]): number {
  if (cards.length === 5) return evaluate5(cards);
  if (cards.length === 7) {
    let best = -1;
    const buf = new Array(5);
    for (const combo of COMBOS_7_CHOOSE_5) {
      for (let i = 0; i < 5; i++) buf[i] = cards[combo[i]];
      const s = evaluate5(buf);
      if (s > best) best = s;
    }
    return best;
  }
  // General fallback for 6 cards.
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const s = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (s > best) best = s;
          }
  return best;
}

export function categoryOf(score: number): number {
  // score = category * 13^5 + ...
  return Math.floor(score / 371293); // 13^5
}

export function describeScore(score: number): string {
  return CATEGORY_NAMES[categoryOf(score)];
}
