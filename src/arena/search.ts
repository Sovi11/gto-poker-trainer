import { Action, GameState } from '@chipzen-ai/bot';
import { mulberry32 } from '../engine/cards';
import { BLOCKED, solve } from '../solver/cfr';
import type { DecisionNode } from '../solver/tree';
import { evaluate } from './evaluate';
import { Combo, sampleRange } from './ranges';
import { riverTree } from './river';

export function continuationEquity(a: number[], b: number[], board: number[], rng: () => number, samples = 64): number {
  const dead = new Set([...a, ...b, ...board]);
  if (dead.size !== a.length + b.length + board.length) throw new Error('Colliding rollout cards');
  const pool = Array.from({ length: 52 }, (_, i) => i).filter(c => !dead.has(c));
  const own = [...a, ...board, ...new Array(5 - board.length).fill(0)], opp = [...b, ...board, ...new Array(5 - board.length).fill(0)];
  let wins = 0;
  const settle = () => { const x = evaluate(own), y = evaluate(opp); wins += x > y ? 1 : x === y ? .5 : 0; };
  if (board.length === 5) { settle(); return wins; }
  if (board.length === 4) {
    for (const c of pool) { own[6] = opp[6] = c; settle(); } return wins / pool.length;
  }
  for (let i = 0; i < samples; i++) {
    const a = Math.floor(rng() * pool.length); let b: number;
    do { b = Math.floor(rng() * pool.length); } while (a === b);
    own[5] = opp[5] = pool[a]; own[6] = opp[6] = pool[b]; settle();
  }
  return wins / samples;
}

// A bounded current-street solve with sampled checkdown continuation values.
// Future betting is omitted, so this candidate is restricted to low SPR.
export function solveContinuation(s: GameState, committed: number, hole: number[], ownRange: Combo[], opponentRange: Combo[], rng: () => number, deadline: number): Action | null {
  if (![3, 4].includes(s.board.length) || s.opponentStacks.length !== 1 || s.toCall > s.yourStack || s.pot <= s.toCall) return null;
  const effective = Math.min(s.yourStack, s.opponentStacks[0] + s.toCall);
  if (effective / Math.max(1, s.pot) > (s.board.length === 3 ? 2 : 4)) return null;
  const own = sampleRange(ownRange, 16, hole), opp = sampleRange(opponentRange, 16);
  const index = own.findIndex(c => hole.every(x => c.cards.includes(x)));
  if (index < 0 || !opp.length) return null;
  const outcome = new Int8Array(own.length * opp.length), equity = new Float64Array(outcome.length);
  const board = s.board.map(c => 'cdhs'.indexOf(c.suit) * 13 + '23456789TJQKA'.indexOf(c.rank));
  const seed = [...hole, ...board].reduce((hash, c) => Math.imul(hash ^ c, 16777619), 2166136261) >>> 0;
  const chance = mulberry32(seed);
  let actualCompatible = 0;
  for (let i = 0; i < own.length; i++) {
    if (performance.now() > deadline) return null;
    for (let j = 0; j < opp.length; j++) {
      const idx = i * opp.length + j;
      if (own[i].cards.some(c => opp[j].cards.includes(c))) { outcome[idx] = BLOCKED; continue; }
      if (i === index) actualCompatible++;
      equity[idx] = continuationEquity(own[i].cards, opp[j].cards, board, chance);
    }
  }
  if (!actualCompatible) return null;
  const tree = riverTree(s, committed), root = tree.root as DecisionNode;
  const result = solve({ tree, n0: own.length, n1: opp.length, pot: s.pot - s.toCall, outcome, equity,
    prior0: Float64Array.from(own.map(c => c.weight)), prior1: Float64Array.from(opp.map(c => c.weight)), iterations: 120 });
  let u = rng(), chosen = root.actions[root.actions.length - 1];
  for (let a = 0; a < root.actions.length; a++) {
    u -= result.strategy[root.id][index * root.actions.length + a]; if (u <= 0) { chosen = root.actions[a]; break; }
  }
  if (chosen.kind === 'fold') return Action.fold(); if (chosen.kind === 'check') return Action.check(); if (chosen.kind === 'call') return Action.call();
  const to = committed + chosen.to;
  return s.validActions.includes('raise') ? Action.raiseTo(to) : s.validActions.includes('all_in') && to >= committed + s.yourStack ? Action.allIn() : null;
}
