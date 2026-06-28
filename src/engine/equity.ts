import { Card, mulberry32, parseCard } from './cards';
import { evaluateBest } from './evaluator';

export interface EquityResult {
  win: number; // fraction
  tie: number;
  lose: number;
  equity: number; // win + tie/2
  iterations: number;
  exact: boolean;
}

// Compute equity of handA vs handB given optional board, using Monte Carlo
// (or exact enumeration when the remaining-card space is small enough).
export function handVsHandEquity(
  handA: [Card, Card],
  handB: [Card, Card],
  board: Card[] = [],
  iterations = 25000,
  seed = 0xc0ffee,
): EquityResult {
  const dead = new Set<number>([...handA, ...handB, ...board]);
  const remaining: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) remaining.push(c);

  const need = 5 - board.length;

  // Exact enumeration when feasible (<= ~2 cards to come over small deck).
  const exactSpace = combosCount(remaining.length, need);
  const useExact = exactSpace > 0 && exactSpace <= 30000;

  let win = 0,
    tie = 0,
    total = 0;

  const aCards = [handA[0], handA[1], 0, 0, 0, 0, 0];
  const bCards = [handB[0], handB[1], 0, 0, 0, 0, 0];

  const settle = (fullBoard: Card[]) => {
    for (let i = 0; i < 5; i++) {
      aCards[2 + i] = fullBoard[i];
      bCards[2 + i] = fullBoard[i];
    }
    const sa = evaluateBest(aCards);
    const sb = evaluateBest(bCards);
    if (sa > sb) win++;
    else if (sa === sb) tie++;
    total++;
  };

  if (useExact) {
    const base = board.slice();
    enumerate(remaining, need, (chosen) => settle(base.concat(chosen)));
  } else {
    const rng = mulberry32(seed);
    const pool = remaining.slice();
    const base = board.slice();
    for (let it = 0; it < iterations; it++) {
      // partial Fisher-Yates to pick `need` cards
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(rng() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      settle(base.concat(pool.slice(0, need)));
    }
  }

  const w = win / total;
  const t = tie / total;
  return {
    win: w,
    tie: t,
    lose: 1 - w - t,
    equity: w + t / 2,
    iterations: total,
    exact: useExact,
  };
}

function combosCount(n: number, k: number): number {
  if (k === 0) return 1;
  if (k > n) return 0;
  let num = 1,
    den = 1;
  for (let i = 0; i < k; i++) {
    num *= n - i;
    den *= i + 1;
  }
  return num / den;
}

function enumerate(cards: Card[], k: number, cb: (chosen: Card[]) => void): void {
  const n = cards.length;
  const idx: number[] = [];
  const rec = (start: number) => {
    if (idx.length === k) {
      cb(idx.map((i) => cards[i]));
      return;
    }
    for (let i = start; i < n; i++) {
      idx.push(i);
      rec(i + 1);
      idx.pop();
    }
  };
  rec(0);
}

// Convenience: equity from string hands like "AhKh" vs "QsQd" on board "2c7d9h".
export function equityFromStrings(a: string, b: string, boardStr = '', iterations = 25000): EquityResult {
  const ha: [Card, Card] = [parseCard(a.slice(0, 2)), parseCard(a.slice(2, 4))];
  const hb: [Card, Card] = [parseCard(b.slice(0, 2)), parseCard(b.slice(2, 4))];
  const board: Card[] = [];
  for (let i = 0; i + 1 < boardStr.length; i += 2) board.push(parseCard(boardStr.slice(i, i + 2)));
  return handVsHandEquity(ha, hb, board, iterations);
}

// Board-aware strength: equity of `hand` vs one random opponent hand given the
// current board, running out remaining streets. This is what bots use to gauge
// how strong they actually are on a given flop/turn/river.
export function equityVsRandomOnBoard(
  hand: [Card, Card],
  board: Card[],
  iterations = 1000,
  seed = 4321,
): number {
  const dead = new Set<number>([...hand, ...board]);
  const remaining: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) remaining.push(c);
  const rng = mulberry32(seed >>> 0);
  const need = 5 - board.length;

  let win = 0,
    tie = 0,
    total = 0;
  const aCards = [hand[0], hand[1], 0, 0, 0, 0, 0];
  const bCards = [0, 0, 0, 0, 0, 0, 0];

  for (let it = 0; it < iterations; it++) {
    const pool = remaining.slice();
    // draw opponent 2 cards + `need` board cards
    const draws = 2 + need;
    for (let i = 0; i < draws; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    bCards[0] = pool[0];
    bCards[1] = pool[1];
    const runout = pool.slice(2, 2 + need);
    const fullBoard = board.concat(runout);
    for (let i = 0; i < 5; i++) {
      aCards[2 + i] = fullBoard[i];
      bCards[2 + i] = fullBoard[i];
    }
    const sa = evaluateBest(aCards);
    const sb = evaluateBest(bCards);
    if (sa > sb) win++;
    else if (sa === sb) tie++;
    total++;
  }
  return (win + tie / 2) / total;
}

// Equity of a single hand vs a random hand (used by some training drills).
export function handVsRandomEquity(hand: [Card, Card], iterations = 20000, seed = 1234): EquityResult {
  const dead = new Set<number>(hand);
  const remaining: Card[] = [];
  for (let c = 0; c < 52; c++) if (!dead.has(c)) remaining.push(c);
  const rng = mulberry32(seed);

  let win = 0,
    tie = 0,
    total = 0;
  const aCards = [hand[0], hand[1], 0, 0, 0, 0, 0];
  const bCards = [0, 0, 0, 0, 0, 0, 0];

  for (let it = 0; it < iterations; it++) {
    const pool = remaining.slice();
    for (let i = 0; i < 7; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    bCards[0] = pool[0];
    bCards[1] = pool[1];
    const board = pool.slice(2, 7);
    for (let i = 0; i < 5; i++) {
      aCards[2 + i] = board[i];
      bCards[2 + i] = board[i];
    }
    const sa = evaluateBest(aCards);
    const sb = evaluateBest(bCards);
    if (sa > sb) win++;
    else if (sa === sb) tie++;
    total++;
  }
  const w = win / total;
  const t = tie / total;
  return { win: w, tie: t, lose: 1 - w - t, equity: w + t / 2, iterations: total, exact: false };
}
