import { mulberry32 } from '../engine/cards';
import {
  ActStep,
  Hand,
  candidateSeats,
  decisionPoints,
  replayState,
} from './handReplay';

// Picks the day's hand and its single frozen decision, deterministically, so
// every player worldwide faces the same spot. No backend involved: the day
// number and the hand library are the only inputs.

export interface DailySpot {
  hand: Hand;
  seat: number;
  /** Index into hand.steps where the replay freezes and asks. */
  step: number;
}

/**
 * How uncomfortable is this decision? Zero unless the seat is facing a bet —
 * a daily where the answer is "check" teaches nothing. Otherwise: the price
 * being asked, how deep into the hand it is, and how big the pot has grown.
 */
export function decisionScore(hand: Hand, seat: number, stepIdx: number): number {
  const step = hand.steps[stepIdx];
  if (!step || step.t !== 'act' || step.p !== seat) return 0;
  const before = replayState(hand, stepIdx);
  const owed = Math.max(0, Math.max(...before.bets) - before.bets[seat]);
  if (owed <= 0) return 0;
  const price = owed / (before.pot + owed); // pot-odds denominator
  const streetDepth = { preflop: 0, flop: 1, turn: 2, river: 3 }[before.street];
  const potBB = before.pot / hand.bb;
  return price * 10 + streetDepth * 2 + Math.min(potBB / 20, 5);
}

export interface BestDecision {
  seat: number;
  step: number;
  score: number;
}

/** The juiciest decision in the hand, across the seats worth playing. */
export function bestDecision(hand: Hand): BestDecision | null {
  let best: BestDecision | null = null;
  for (const seat of candidateSeats(hand)) {
    for (const step of decisionPoints(hand, seat)) {
      const score = decisionScore(hand, seat, step);
      if (score > 0 && (!best || score > best.score)) best = { seat, step, score };
    }
  }
  return best;
}

/** A spot must at least be a real bet on a real pot to carry a daily. */
export const MIN_DAILY_SCORE = 6;

/**
 * The day's spot. Filter to hands with a hard enough decision, then hash the
 * day to pick one. Deterministic given the same library; regenerating the
 * library can shift a day's pick, which is accepted.
 */
export function pickDaily(n: number, hands: Hand[]): DailySpot | null {
  const scored = hands
    .map((hand) => ({ hand, best: bestDecision(hand) }))
    .filter((x): x is { hand: Hand; best: BestDecision } => x.best !== null);
  if (scored.length === 0) return null;
  let pool = scored.filter((x) => x.best.score >= MIN_DAILY_SCORE);
  if (pool.length === 0) {
    // Guarded fallback: nothing clears the bar, take the hardest spot around.
    const top = scored.reduce((a, b) => (b.best.score > a.best.score ? b : a));
    pool = [top];
  }
  const rng = mulberry32((n * 2654435761) >>> 0);
  const pick = pool[Math.floor(rng() * pool.length)];
  return { hand: pick.hand, seat: pick.best.seat, step: pick.best.step };
}

/**
 * The scenario briefing shown before the table starts: everything a player
 * would genuinely know sitting down — and, for the famous hands, who they are.
 */
export function briefingLines(spot: DailySpot): string[] {
  const { hand, seat } = spot;
  const sym = hand.symbol ?? (hand.currency === 'USD' ? '$' : '');
  const money = (x: number) => `${sym}${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const lines: string[] = [];

  const where = hand.event || hand.venue || 'A recorded game';
  lines.push(hand.year ? `${where}, ${hand.year}.` : `${where}.`);

  const blinds = hand.blinds.filter(Boolean).map(money).join('/');
  lines.push(`${blinds} blinds, ${hand.players.length}-handed no-limit hold'em.`);

  const depth = Math.round(hand.stacks[seat] / hand.bb);
  if (hand.anon) {
    lines.push(`You are ${depth} big blinds deep. The names in this hand were not recorded.`);
  } else {
    lines.push(`You are ${hand.players[seat]}, ${depth} big blinds deep.`);
  }
  return lines;
}

/** What the real player actually chose at the frozen step, as a sentence. */
export function actualActionLabel(spot: DailySpot): string {
  const { hand, step } = spot;
  const act = hand.steps[step] as ActStep;
  const sym = hand.symbol ?? (hand.currency === 'USD' ? '$' : '');
  const money = (x: number) => `${sym}${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  switch (act.a) {
    case 'fold':
      return 'folded';
    case 'check':
      return 'checked';
    case 'call':
      return `called ${money(act.amount ?? 0)}`;
    case 'bet':
      return `bet ${money(act.to ?? 0)}`;
    case 'raise':
      return `raised to ${money(act.to ?? 0)}`;
  }
}
