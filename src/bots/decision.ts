import { Card } from '../engine/cards';
import { equityVsRandomOnBoard, equityVsRangeOnBoard } from '../engine/equity';
import { evaluateBest, categoryOf, CATEGORY } from '../engine/evaluator';
import { BotProfile } from './personalities';
import { Position } from '../gto/ranges';
import { handPercentile, topRangeCombos } from './preflopStrength';

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
  minRaise: number; // minimum legal raise total (raise-to)
  bigBlind: number;
  position?: Position; // table position, drives preflop range width
  facingRaise?: boolean; // preflop: a raise above the big blind is in front of us
  canRaise?: boolean; // betting is open to us (false after an incomplete all-in)
}

export function decide(ctx: DecisionContext, bot: BotProfile, rng: () => number = Math.random): Action {
  if (ctx.board.length === 0) return preflopDecide(ctx, bot, rng);
  return postflopDecide(ctx, bot, rng);
}

// ---------------------------------------------------------------------------
// Preflop: play a real, position- and personality-aware starting range.
// ---------------------------------------------------------------------------

const POSITION_BONUS: Record<Position, number> = {
  UTG: -0.05,
  MP: 0.0,
  CO: 0.07,
  BTN: 0.16,
  SB: 0.05,
  BB: 0.03,
};

// Fraction of all starting hands a bot opens (raises/limps) from a position.
// Tightness is the main knob: a nit (0.85) opens ~9%, a maniac (0.2) ~45%+.
export function openFraction(bot: BotProfile, pos: Position = 'CO'): number {
  return clamp((1 - bot.tightness) * 0.55 + POSITION_BONUS[pos], 0.05, 0.85);
}

// Fraction of hands a bot continues with (call or better) facing a raise.
// Calling stations widen this sharply.
export function callFraction(bot: BotProfile): number {
  return clamp((1 - bot.tightness) * 0.3 + bot.station * 0.22, 0.03, 0.6);
}

// Fraction of hands strong enough to 3-bet for value.
export function threeBetValueFraction(bot: BotProfile): number {
  return clamp(0.02 + bot.aggression * 0.07 + (1 - bot.tightness) * 0.02, 0.012, 0.13);
}

function preflopDecide(ctx: DecisionContext, bot: BotProfile, rng: () => number): Action {
  const pct = handPercentile(ctx.hole);
  const canCheck = ctx.toCall <= 0;
  const canRaise = (ctx.canRaise ?? true) && ctx.stack > ctx.toCall;
  const pos = ctx.position ?? 'CO';
  const facingRaise = ctx.facingRaise ?? ctx.toCall > ctx.bigBlind;

  if (!facingRaise) {
    // Unopened or limped pot.
    const inRange = pct >= 1 - openFraction(bot, pos);
    if (!inRange) return canCheck ? { type: 'check', amount: 0 } : { type: 'fold', amount: 0 };
    if (canRaise && rng() < 0.4 + bot.aggression * 0.6) {
      return { type: 'raise', amount: openSize(ctx, rng) };
    }
    // In range but not raising: take the free check, or limp/complete.
    if (canCheck) return { type: 'check', amount: 0 };
    return { type: 'call', amount: Math.min(ctx.toCall, ctx.stack) };
  }

  // Facing a raise: 3-bet value, occasionally 3-bet bluff, call, or fold.
  const callFrac = callFraction(bot);
  const inValue = pct >= 1 - threeBetValueFraction(bot);
  const inCall = pct >= 1 - callFrac;

  if (inValue && canRaise && rng() < 0.5 + bot.aggression * 0.5) {
    return { type: 'raise', amount: threeBetSize(ctx, rng) };
  }
  // Light 3-bet bluff with hands just below the calling range (aggressive bots).
  if (canRaise && !inCall && pct >= 1 - callFrac - 0.08 && rng() < bot.bluffFreq * 0.5) {
    return { type: 'raise', amount: threeBetSize(ctx, rng) };
  }
  if (inCall) return { type: 'call', amount: Math.min(ctx.toCall, ctx.stack) };
  return canCheck ? { type: 'check', amount: 0 } : { type: 'fold', amount: 0 };
}

function openSize(ctx: DecisionContext, rng: () => number): number {
  const to = Math.round(ctx.bigBlind * (2.2 + rng() * 1.0)); // 2.2x..3.2x
  return Math.max(to, ctx.minRaise); // act() caps to all-in
}

function threeBetSize(ctx: DecisionContext, rng: () => number): number {
  // Pot-ish raise: roughly 3x the bet we face.
  const raiseTo = ctx.toCall + Math.round((ctx.pot + ctx.toCall) * (0.85 + rng() * 0.4));
  return Math.max(raiseTo, ctx.minRaise);
}

// ---------------------------------------------------------------------------
// Postflop: gauge strength against a plausible continuing range, not random.
// ---------------------------------------------------------------------------

// Fraction of hands the villain is assumed to still hold. Tightens by street
// and tightens further when they're the aggressor (we're facing a bet).
function continuingRangeFraction(ctx: DecisionContext): number {
  const b = ctx.board.length;
  let frac = b <= 3 ? 0.5 : b === 4 ? 0.34 : 0.24; // flop / turn / river
  if (ctx.toCall > 0) frac *= 0.7; // facing aggression -> stronger, narrower range
  return clamp(frac, 0.05, 0.9);
}

function handStrength(ctx: DecisionContext): number {
  const { hole, board } = ctx;
  const iters = board.length >= 4 ? 600 : 800;
  const seed = (hole[0] * 53 + hole[1] * 7 + board.reduce((a, c) => a + c, 0) * 101 + 1) >>> 0;
  const villain = topRangeCombos(continuingRangeFraction(ctx));
  return equityVsRangeOnBoard(hole, board, villain, iters, seed);
}

// Made-hand category (0 high card .. 8 straight flush) on the current board.
function madeCategory(hole: [Card, Card], board: Card[]): number {
  if (board.length < 3) return -1;
  const cards = [hole[0], hole[1], ...board];
  return categoryOf(evaluateBest(cards));
}

function postflopDecide(ctx: DecisionContext, bot: BotProfile, rng: () => number): Action {
  const { toCall, pot, stack } = ctx;
  const canRaise = (ctx.canRaise ?? true) && stack > toCall;
  const equity = handStrength(ctx);
  const noise = (rng() - 0.5) * 2 * bot.tilt; // +/- tilt
  const adjEquity = clamp(equity + noise, 0, 1);
  const made = madeCategory(ctx.hole, ctx.board);

  // ---- Facing no bet: we can check or bet ----
  // Thresholds are tuned for equity vs a continuing range (lower than vs random).
  if (toCall <= 0) {
    const wantsValue = adjEquity > 0.58;
    const valueBet = wantsValue && rng() < bot.aggression;
    const bluff = !wantsValue && adjEquity < 0.42 && rng() < bot.bluffFreq;
    if (valueBet || bluff) {
      return { type: 'bet', amount: sizeBet(ctx, bot, rng) };
    }
    return { type: 'check', amount: 0 };
  }

  // ---- Facing a bet: fold / call / raise ----
  const potOdds = toCall / (pot + toCall); // equity needed to break even on a call
  const callThreshold = clamp(potOdds - bot.station * 0.18 + (bot.tightness - 0.5) * 0.12, 0.02, 0.95);

  const strongEnoughToRaise = adjEquity > 0.66 || made >= CATEGORY.FLUSH;
  if (strongEnoughToRaise && canRaise && rng() < bot.aggression) {
    const raiseTo = sizeRaise(ctx, bot, rng);
    if (raiseTo > toCall) return { type: 'raise', amount: Math.min(raiseTo, toCall + stack) };
  }

  // Bluff-raise occasionally with weak hands.
  if (canRaise && adjEquity < 0.32 && rng() < bot.bluffFreq * 0.4) {
    const raiseTo = sizeRaise(ctx, bot, rng);
    if (raiseTo > toCall && raiseTo >= ctx.minRaise) return { type: 'raise', amount: Math.min(raiseTo, toCall + stack) };
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

// Exported for potential UI display of a bot's read on a spot (vs a random hand).
export function botEquityEstimate(hole: [Card, Card], board: Card[]): number {
  return equityVsRandomOnBoard(hole, board);
}
