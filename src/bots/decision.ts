import { Card } from '../engine/cards';
import { equityVsRandomOnBoard } from '../engine/equity';
import { evaluateBest, categoryOf } from '../engine/evaluator';
import { BotProfile } from './personalities';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface Action {
  type: ActionType;
  amount: number; // total chips put in for this action (the bet/raise size, or call amount)
}

export interface DecisionContext {
  hole: [Card, Card];
  board: Card[]; // 0,3,4,5 cards
  pot: number;
  toCall: number; // chips needed to call (0 = checked to)
  stack: number; // bot's remaining stack
  minRaise: number; // minimum legal raise total
  bigBlind: number;
}

// Board-aware hand strength: equity vs a random hand given the current board.
function handStrength(hole: [Card, Card], board: Card[]): number {
  const iters = board.length === 0 ? 1200 : board.length >= 4 ? 700 : 1000;
  const seed = (hole[0] * 53 + hole[1] * 7 + board.reduce((a, c) => a + c, 0) * 101 + 1) >>> 0;
  return equityVsRandomOnBoard(hole, board, iters, seed);
}

// Made-hand category (0 high card .. 8 straight flush) on the current board.
function madeCategory(hole: [Card, Card], board: Card[]): number {
  if (board.length < 3) return -1;
  const cards = [hole[0], hole[1], ...board];
  return categoryOf(evaluateBest(cards.slice(0, Math.min(7, cards.length))));
}

export function decide(ctx: DecisionContext, bot: BotProfile, rng: () => number = Math.random): Action {
  const { toCall, pot, stack, minRaise } = ctx;
  const equity = handStrength(ctx.hole, ctx.board);
  const noise = (rng() - 0.5) * 2 * bot.tilt; // +/- tilt
  const adjEquity = clamp(equity + noise, 0, 1);
  const made = madeCategory(ctx.hole, ctx.board);

  // ---- Facing no bet: we can check or bet ----
  if (toCall <= 0) {
    const wantsValue = adjEquity > 0.6;
    const valueBet = wantsValue && rng() < bot.aggression;
    const bluff = !wantsValue && adjEquity < 0.45 && rng() < bot.bluffFreq;
    if (valueBet || bluff) {
      const size = sizeBet(ctx, bot, rng);
      return { type: 'bet', amount: size };
    }
    return { type: 'check', amount: 0 };
  }

  // ---- Facing a bet: fold / call / raise ----
  const potOdds = toCall / (pot + toCall); // equity needed to break even on a call
  // Calling stations need less equity; nits need more.
  const callThreshold = clamp(potOdds - bot.station * 0.18 + (bot.tightness - 0.5) * 0.12, 0.02, 0.95);

  // Strong hands raise for value sometimes.
  const strongEnoughToRaise = adjEquity > 0.7 || made >= 5; // flush+ or high equity
  if (strongEnoughToRaise && rng() < bot.aggression && stack > toCall) {
    const raiseTo = sizeRaise(ctx, bot, rng);
    if (raiseTo > toCall) return { type: 'raise', amount: Math.min(raiseTo, toCall + stack) };
  }

  // Bluff-raise occasionally with weak hands.
  if (adjEquity < 0.35 && rng() < bot.bluffFreq * 0.4 && stack > toCall) {
    const raiseTo = sizeRaise(ctx, bot, rng);
    if (raiseTo > toCall && raiseTo >= minRaise) return { type: 'raise', amount: Math.min(raiseTo, toCall + stack) };
  }

  if (adjEquity >= callThreshold) {
    return { type: 'call', amount: Math.min(toCall, stack) };
  }

  return { type: 'fold', amount: 0 };
}

function sizeBet(ctx: DecisionContext, bot: BotProfile, rng: () => number): number {
  const frac = bot.betSizing * (0.85 + rng() * 0.3);
  const raw = Math.max(ctx.bigBlind, Math.round(ctx.pot * frac));
  return Math.min(raw, ctx.stack);
}

function sizeRaise(ctx: DecisionContext, bot: BotProfile, rng: () => number): number {
  // Raise to roughly (call + pot * sizing), i.e. a pot-ish raise.
  const frac = bot.betSizing * (0.9 + rng() * 0.4);
  const raiseTo = ctx.toCall + Math.round((ctx.pot + ctx.toCall) * frac);
  const minLegal = Math.max(ctx.minRaise, ctx.toCall + ctx.bigBlind);
  return Math.min(Math.max(raiseTo, minLegal), ctx.toCall + ctx.stack);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Exported for potential UI display of a bot's read on a spot.
export function botEquityEstimate(hole: [Card, Card], board: Card[]): number {
  return handStrength(hole, board);
}
