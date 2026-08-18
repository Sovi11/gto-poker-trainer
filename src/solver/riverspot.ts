// Poker glue for the tree solver: turns a board plus two range strings into a
// concrete two-player game and solves it with CFR.

import { Card, cardToString, parseCard } from '../engine/cards';
import { evaluateBest } from '../engine/evaluator';
import { classToCombos, parseRange } from '../engine/range';
import { buildRiverTree, BuiltTree, DecisionNode, TreeNode } from './tree';
import { solve, Solution, WIN, TIE, LOSE, BLOCKED } from './cfr';

export interface RiverSpotInput {
  board: string; // five cards, e.g. "Kh 7h 2c 3s 9d"
  oopRange: string;
  ipRange: string;
  pot: number;
  stack: number;
  betSizes: number[];
  raiseSizes: number[];
  maxRaises: number;
  iterations?: number;
  /** Cap on combos per side; larger ranges are evenly subsampled to stay fast. */
  maxCombos?: number;
}

export interface Combo {
  cards: [Card, Card];
  label: string;
  /** Absolute 7-card hand strength on this board. Higher is better. */
  strength: number;
}

export interface RiverSpot {
  tree: BuiltTree;
  solution: Solution;
  board: Card[];
  oop: Combo[];
  ip: Combo[];
  prior0: Float64Array;
  prior1: Float64Array;
  pot: number;
  /** True when a range was subsampled to hit maxCombos. */
  subsampled: boolean;
}

export function parseBoard(s: string): Card[] {
  const cleaned = s.replace(/[\s,]+/g, '');
  const out: Card[] = [];
  for (let i = 0; i + 1 < cleaned.length; i += 2) out.push(parseCard(cleaned.slice(i, i + 2)));
  return out;
}

/** Expand range notation into concrete combos that do not clash with the board. */
export function rangeToCombos(range: string, board: Card[], maxCombos = 120): { combos: Combo[]; subsampled: boolean } {
  const dead = new Set<number>(board);
  const classes = parseRange(range);
  const all: Combo[] = [];
  for (const cls of classes) {
    for (const [a, b] of classToCombos(cls)) {
      if (dead.has(a) || dead.has(b)) continue;
      all.push({
        cards: [a, b],
        label: cardToString(a) + cardToString(b),
        strength: evaluateBest([a, b, ...board]),
      });
    }
  }
  all.sort((x, y) => y.strength - x.strength);

  if (all.length <= maxCombos) return { combos: all, subsampled: false };
  // Even subsample keeps the shape of the range (top to bottom) intact.
  const step = all.length / maxCombos;
  const combos: Combo[] = [];
  for (let k = 0; k < maxCombos; k++) combos.push(all[Math.floor(k * step)]);
  return { combos, subsampled: true };
}

export function buildOutcomeMatrix(oop: Combo[], ip: Combo[]): Int8Array {
  const m = new Int8Array(oop.length * ip.length);
  for (let i = 0; i < oop.length; i++) {
    const [a0, b0] = oop[i].cards;
    const s0 = oop[i].strength;
    const base = i * ip.length;
    for (let j = 0; j < ip.length; j++) {
      const [a1, b1] = ip[j].cards;
      if (a0 === a1 || a0 === b1 || b0 === a1 || b0 === b1) {
        m[base + j] = BLOCKED;
        continue;
      }
      const s1 = ip[j].strength;
      m[base + j] = s0 > s1 ? WIN : s0 < s1 ? LOSE : TIE;
    }
  }
  return m;
}

export function solveRiverSpot(input: RiverSpotInput): RiverSpot {
  const board = parseBoard(input.board);
  if (board.length !== 5) throw new Error(`River needs exactly 5 board cards, got ${board.length}`);
  if (new Set(board).size !== 5) throw new Error('Duplicate card on the board');

  const cap = input.maxCombos ?? 120;
  const oopRes = rangeToCombos(input.oopRange, board, cap);
  const ipRes = rangeToCombos(input.ipRange, board, cap);
  if (oopRes.combos.length === 0 || ipRes.combos.length === 0) {
    throw new Error('One of the ranges is empty on this board');
  }

  const outcome = buildOutcomeMatrix(oopRes.combos, ipRes.combos);
  const tree = buildRiverTree({
    pot: input.pot,
    stack: input.stack,
    betSizes: input.betSizes,
    raiseSizes: input.raiseSizes,
    maxRaises: input.maxRaises,
  });

  const prior0 = new Float64Array(oopRes.combos.length).fill(1);
  const prior1 = new Float64Array(ipRes.combos.length).fill(1);

  const solution = solve({
    tree,
    pot: input.pot,
    n0: oopRes.combos.length,
    n1: ipRes.combos.length,
    prior0,
    prior1,
    outcome,
    iterations: input.iterations,
  });

  return {
    tree,
    solution,
    board,
    oop: oopRes.combos,
    ip: ipRes.combos,
    prior0,
    prior1,
    pot: input.pot,
    subsampled: oopRes.subsampled || ipRes.subsampled,
  };
}

// ---------------------------------------------------------------------------
// Tree navigation — "what should I do on this path?"
// ---------------------------------------------------------------------------

export interface PathStep {
  node: DecisionNode;
  /** Index of the action taken at this node. */
  action: number;
}

export interface NodeView {
  node: TreeNode;
  /** Reach-weighted frequency of each action across the acting range. */
  frequencies: number[];
  /** Per-combo strategy for the acting player, strongest hand first. */
  perHand: { combo: Combo; probs: number[]; weight: number }[];
  /** How much of each range still reaches this node. */
  reach0: number;
  reach1: number;
}

/**
 * Walk an action path from the root and report the equilibrium strategy at the
 * node you land on. `path` is a list of action indices.
 */
export function walkPath(spot: RiverSpot, path: number[]): NodeView | null {
  let node: TreeNode = spot.tree.root;
  let r0 = Float64Array.from(spot.prior0);
  let r1 = Float64Array.from(spot.prior1);
  const norm = (v: Float64Array) => {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += v[i];
    return s;
  };
  const start0 = norm(r0);
  const start1 = norm(r1);

  for (const a of path) {
    if (node.kind !== 'decision') return null;
    if (a < 0 || a >= node.actions.length) return null;
    const sigma = spot.solution.strategy[node.id];
    const A = node.actions.length;
    if (node.player === 0) {
      const next = new Float64Array(r0.length);
      for (let i = 0; i < r0.length; i++) next[i] = r0[i] * sigma[i * A + a];
      r0 = next;
    } else {
      const next = new Float64Array(r1.length);
      for (let j = 0; j < r1.length; j++) next[j] = r1[j] * sigma[j * A + a];
      r1 = next;
    }
    node = node.children[a];
  }

  const reach0 = start0 > 0 ? norm(r0) / start0 : 0;
  const reach1 = start1 > 0 ? norm(r1) / start1 : 0;

  if (node.kind !== 'decision') {
    return { node, frequencies: [], perHand: [], reach0, reach1 };
  }

  const A = node.actions.length;
  const sigma = spot.solution.strategy[node.id];
  const combos = node.player === 0 ? spot.oop : spot.ip;
  const reach = node.player === 0 ? r0 : r1;

  const frequencies = new Array(A).fill(0);
  let total = 0;
  for (let i = 0; i < combos.length; i++) {
    total += reach[i];
    for (let a = 0; a < A; a++) frequencies[a] += reach[i] * sigma[i * A + a];
  }
  for (let a = 0; a < A; a++) frequencies[a] = total > 0 ? frequencies[a] / total : 0;

  const perHand = combos.map((combo, i) => ({
    combo,
    weight: total > 0 ? reach[i] / total : 0,
    probs: Array.from({ length: A }, (_, a) => sigma[i * A + a]),
  }));

  return { node, frequencies, perHand, reach0, reach1 };
}
