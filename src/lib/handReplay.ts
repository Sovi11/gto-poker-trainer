import { parseCard } from '../engine/cards';
import { evaluateBest } from '../engine/evaluator';

// Replay engine for recorded hands.
//
// Pure state derivation: given a hand and how many steps have been played,
// return exactly what the table looks like. The animated view renders this and
// nothing else, so what you see can never drift from the real hand history.

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export interface BoardStep {
  t: 'board';
  street: Street;
  cards: string[];
}

export interface ActStep {
  t: 'act';
  p: number;
  a: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  amount?: number;
  to?: number;
  street: Street;
}

export interface ShowStep {
  t: 'show';
  p: number;
  cards: string[];
}

export type Step = BoardStep | ActStep | ShowStep;

export interface Hand {
  id: string;
  event: string;
  year?: number;
  currency: string;
  players: string[];
  stacks: number[];
  blinds: number[];
  antes: number[];
  bb: number;
  hole: (string[] | null)[];
  board: string[];
  steps: Step[];
  pot: number;
  potBB: number;
  source: string;
  /** Currency symbol from the source, when it recorded one. */
  symbol?: string;
  group: 'famous' | 'wsop' | 'pluribus' | 'online';
  /** Online archives record the site; names are hashed out of the data. */
  venue?: string;
  /** True when the source has no real player names to show. */
  anon?: boolean;
  /** Winners as recorded in the source, where it recorded them. */
  winners?: number[];
}

export interface TableState {
  /** Board cards revealed so far. */
  board: string[];
  /** Chips in front of each player on the current street. */
  bets: number[];
  /** Total each player has put in this hand. */
  contributed: number[];
  /** Chips left behind. */
  stacks: number[];
  folded: boolean[];
  /** Everything wagered so far, including chips still in front. */
  pot: number;
  /** The pot actually contested, with any uncalled bet handed back. */
  effectivePot: number;
  street: Street;
  /** Most recent action label per player, for the badge on their seat. */
  lastAction: (string | null)[];
  /** Whose cards are face up (they showed at showdown). */
  shown: boolean[];
}

/** Money is only ever accurate to cents; keep every total on that grid. */
function cents(x: number): number {
  return Math.round(x * 100) / 100;
}

/** The money prefix for a hand: its recorded symbol, else $ for USD games. */
export function moneySymbol(hand: Pick<Hand, 'symbol' | 'currency'>): string {
  return hand.symbol ?? (hand.currency === 'USD' ? '$' : '');
}

function label(step: ActStep, hand: Hand): string {
  const money = (n: number) => `${moneySymbol(hand)}${n.toLocaleString()}`;
  switch (step.a) {
    case 'fold':
      return 'fold';
    case 'check':
      return 'check';
    case 'call':
      return `call ${money(step.amount ?? 0)}`;
    case 'bet':
      return `bet ${money(step.to ?? 0)}`;
    case 'raise':
      return `raise to ${money(step.to ?? 0)}`;
  }
}

/** Table state after applying the first `count` steps. */
export function replayState(hand: Hand, count: number): TableState {
  const n = hand.players.length;
  const bets = hand.blinds.slice(0, n).map((b) => b || 0);
  while (bets.length < n) bets.push(0);
  const contributed = bets.map((b, i) => b + (hand.antes[i] || 0));
  const stacks = hand.stacks.map((s, i) => s - contributed[i]);
  const folded = new Array(n).fill(false);
  const lastAction: (string | null)[] = new Array(n).fill(null);
  const shown = new Array(n).fill(false);
  let board: string[] = [];
  let street: Street = 'preflop';

  for (let k = 0; k < Math.min(count, hand.steps.length); k++) {
    const step = hand.steps[k];
    if (step.t === 'board') {
      board = board.concat(step.cards);
      street = step.street;
      // New street: chips in front are swept into the pot.
      for (let i = 0; i < n; i++) {
        bets[i] = 0;
        lastAction[i] = null;
      }
    } else if (step.t === 'act') {
      const i = step.p;
      if (step.a === 'fold') {
        folded[i] = true;
      } else if (step.a === 'call' || step.a === 'bet' || step.a === 'raise') {
        const target = step.to ?? bets[i] + (step.amount ?? 0);
        // You can only put in what you have: calling a shove that covers you
        // puts you all-in for less, it does not lend you the difference.
        const added = Math.min(target - bets[i], stacks[i]);
        // Online games use decimal money, so round to cents at every step to
        // keep the running totals exact.
        bets[i] = cents(bets[i] + added);
        contributed[i] = cents(contributed[i] + added);
        stacks[i] = cents(stacks[i] - added);
      }
      lastAction[i] = label(step, hand);
    } else if (step.t === 'show') {
      shown[step.p] = true;
    }
  }

  const committedTotal = cents(contributed.reduce((a, b) => a + b, 0));

  return {
    board,
    bets,
    contributed,
    stacks,
    folded,
    pot: committedTotal,
    effectivePot: cents(committedTotal - uncalledExcess(contributed)),
    street,
    lastAction,
    shown,
  };
}

/**
 * The part of the biggest bet nobody could cover. It is returned to the bettor,
 * so it never really belongs to the pot.
 */
export function uncalledExcess(contributed: number[]): number {
  if (contributed.length < 2) return 0;
  const sorted = [...contributed].sort((a, b) => b - a);
  return Math.max(0, sorted[0] - sorted[1]);
}

/** Indices into hand.steps where `seat` has a decision to make. */
export function decisionPoints(hand: Hand, seat: number): number[] {
  const out: number[] = [];
  hand.steps.forEach((s, i) => {
    if (s.t === 'act' && s.p === seat) out.push(i);
  });
  return out;
}

export interface Choice {
  a: ActStep['a'];
  label: string;
  amount?: number;
}

/** The options to offer at a decision, derived from the table state. */
export function choicesAt(hand: Hand, stepIndex: number): Choice[] {
  const step = hand.steps[stepIndex];
  if (!step || step.t !== 'act') return [];
  const before = replayState(hand, stepIndex);
  const owed = Math.max(0, Math.max(...before.bets) - before.bets[step.p]);
  const money = (n: number) => `${moneySymbol(hand)}${n.toLocaleString()}`;

  if (owed > 0) {
    return [
      { a: 'fold', label: 'Fold' },
      { a: 'call', label: `Call ${money(owed)}`, amount: owed },
      { a: 'raise', label: 'Raise' },
    ];
  }
  return [
    { a: 'check', label: 'Check' },
    { a: 'bet', label: 'Bet' },
  ];
}

/** Did the player's guess match what was actually done? Bet and raise are the same intent. */
export function matches(choice: Choice['a'], actual: ActStep['a']): boolean {
  const family = (x: string) => (x === 'bet' || x === 'raise' ? 'aggressive' : x);
  return family(choice) === family(actual);
}

/**
 * The two seats worth playing: whoever put the most in and stayed longest.
 * Returned in a stable but non-obvious order so the label gives nothing away.
 */
export function candidateSeats(hand: Hand): number[] {
  const n = hand.players.length;
  const final = replayState(hand, hand.steps.length);
  const involvement = Array.from({ length: n }, (_, i) => {
    const acts = hand.steps.filter((s) => s.t === 'act' && s.p === i).length;
    const survived = final.folded[i] ? 0 : 40;
    const known = hand.hole[i] ? 25 : -1000; // you must be able to see your own cards
    return { i, score: final.contributed[i] / hand.bb + acts * 5 + survived + known };
  });
  return involvement
    .filter((x) => hand.hole[x.i]) // you must be able to see your own cards
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

/**
 * Who actually won, worked out from the cards. Preferred over the source's
 * `winnings` field only when that field is missing — this evaluates the real
 * hole cards against the real board, so it derives nothing that was not dealt.
 */
export function showdownWinners(hand: Hand): number[] {
  if (hand.winners && hand.winners.length) return hand.winners;
  const final = replayState(hand, hand.steps.length);
  const live = hand.players
    .map((_, i) => i)
    .filter((i) => !final.folded[i] && hand.hole[i]);
  if (live.length === 0) return [];
  if (live.length === 1) return live;
  if (hand.board.length < 5) return []; // cannot rank an unfinished board
  const board = hand.board.map(parseCard);
  const scored = live.map((i) => ({
    i,
    score: evaluateBest([...hand.hole[i]!.map(parseCard), ...board]),
  }));
  const best = Math.max(...scored.map((x) => x.score));
  return scored.filter((x) => x.score === best).map((x) => x.i);
}

/** Chips won or lost by a seat over the hand. */
export function seatResult(hand: Hand, seat: number): number {
  const final = replayState(hand, hand.steps.length);
  if (final.folded[seat]) return -final.contributed[seat];
  const contenders = final.folded.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  if (contenders.length === 1) return final.pot - final.contributed[seat];
  // Multiway showdown: the dataset does not record who scooped, so report the
  // chips committed rather than inventing a winner.
  return -final.contributed[seat];
}
