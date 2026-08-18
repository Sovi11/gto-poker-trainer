// Vector CFR over an explicit betting tree.
//
// This file is pure game theory — it knows nothing about cards. It takes a
// tree, two ranges of opaque "hands", and a matrix saying who wins each
// matchup, and returns the Nash equilibrium strategy at every node.
//
// Two-player zero-sum only: that is the setting where CFR provably converges
// to Nash, and therefore the only setting where "the GTO play" is well defined.

import { BuiltTree, DecisionNode, TreeNode } from './tree';

/** outcome[i * n1 + j] compares player 0's hand i against player 1's hand j. */
export const WIN = 1;
export const TIE = 0;
export const LOSE = -1;
/** The two hands share a card, so this matchup can never happen. */
export const BLOCKED = 2;

export interface SolveInput {
  tree: BuiltTree;
  pot: number;
  n0: number;
  n1: number;
  /** Prior weights; normalized internally. */
  prior0: Float64Array;
  prior1: Float64Array;
  outcome: Int8Array;
  iterations?: number;
}

export interface Solution {
  /** Average (equilibrium) strategy per node: strategy[nodeId][hand * nActions + action]. */
  strategy: Float64Array[];
  /** Expected chips won on this street, per player, under the average strategy. */
  ev0: number;
  ev1: number;
  /** Best-response gain still available to either player, as a fraction of the pot. 0 = solved. */
  exploitability: number;
  iterations: number;
  ms: number;
}

function normalize(w: Float64Array): Float64Array {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i];
  const out = new Float64Array(w.length);
  if (s <= 0) return out;
  for (let i = 0; i < w.length; i++) out[i] = w[i] / s;
  return out;
}

function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function solve(input: SolveInput): Solution {
  const started = Date.now();
  const { tree, pot, n0, n1, outcome } = input;
  const iterations = input.iterations ?? 600;
  const prior0 = normalize(input.prior0);
  const prior1 = normalize(input.prior1);

  const nodes = tree.nodes;
  const regrets = nodes.map((nd) => new Float64Array((nd.player === 0 ? n0 : n1) * nd.actions.length));
  const stratSum = nodes.map((nd) => new Float64Array((nd.player === 0 ? n0 : n1) * nd.actions.length));

  // Counterfactual terminal values: weighted by the OPPONENT's reach only.
  function terminalValues(
    node: Extract<TreeNode, { kind: 'terminal' }>,
    r0: Float64Array,
    r1: Float64Array,
  ): { v0: Float64Array; v1: Float64Array } {
    const v0 = new Float64Array(n0);
    const v1 = new Float64Array(n1);
    const c0 = node.c0;
    const c1 = node.c1;

    if (!node.showdown) {
      const pay0 = node.folder === 1 ? pot + c1 : -c0;
      const pay1 = node.folder === 1 ? -c1 : pot + c0;
      for (let i = 0; i < n0; i++) {
        let s = 0;
        const base = i * n1;
        for (let j = 0; j < n1; j++) if (outcome[base + j] !== BLOCKED) s += r1[j];
        v0[i] = pay0 * s;
      }
      for (let j = 0; j < n1; j++) {
        let s = 0;
        for (let i = 0; i < n0; i++) if (outcome[i * n1 + j] !== BLOCKED) s += r0[i];
        v1[j] = pay1 * s;
      }
      return { v0, v1 };
    }

    // Showdown: winning collects the pot plus the loser's river bets.
    const win0 = pot + c1;
    const lose0 = -c0;
    const split0 = (pot + c1 - c0) / 2;
    const win1 = pot + c0;
    const lose1 = -c1;
    const split1 = (pot + c0 - c1) / 2;

    for (let i = 0; i < n0; i++) {
      let w = 0;
      let t = 0;
      let l = 0;
      const base = i * n1;
      for (let j = 0; j < n1; j++) {
        const o = outcome[base + j];
        if (o === BLOCKED) continue;
        const r = r1[j];
        if (o === WIN) w += r;
        else if (o === LOSE) l += r;
        else t += r;
      }
      v0[i] = w * win0 + l * lose0 + t * split0;
    }
    for (let j = 0; j < n1; j++) {
      let w = 0;
      let t = 0;
      let l = 0;
      for (let i = 0; i < n0; i++) {
        const o = outcome[i * n1 + j];
        if (o === BLOCKED) continue;
        const r = r0[i];
        if (o === LOSE) w += r; // player 0 loses means player 1 wins
        else if (o === WIN) l += r;
        else t += r;
      }
      v1[j] = w * win1 + l * lose1 + t * split1;
    }
    return { v0, v1 };
  }

  function currentStrategy(node: DecisionNode): Float64Array {
    const n = node.player === 0 ? n0 : n1;
    const A = node.actions.length;
    const reg = regrets[node.id];
    const sigma = new Float64Array(n * A);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let a = 0; a < A; a++) {
        const r = reg[i * A + a];
        if (r > 0) sum += r;
      }
      if (sum > 0) {
        for (let a = 0; a < A; a++) {
          const r = reg[i * A + a];
          sigma[i * A + a] = r > 0 ? r / sum : 0;
        }
      } else {
        for (let a = 0; a < A; a++) sigma[i * A + a] = 1 / A;
      }
    }
    return sigma;
  }

  function traverse(node: TreeNode, r0: Float64Array, r1: Float64Array): { v0: Float64Array; v1: Float64Array } {
    if (node.kind === 'terminal') return terminalValues(node, r0, r1);

    const p = node.player;
    const n = p === 0 ? n0 : n1;
    const A = node.actions.length;
    const reach = p === 0 ? r0 : r1;
    const sigma = currentStrategy(node);

    const childOwn: Float64Array[] = [];
    const vOther = new Float64Array(p === 0 ? n1 : n0);

    for (let a = 0; a < A; a++) {
      const scaled = new Float64Array(n);
      for (let i = 0; i < n; i++) scaled[i] = reach[i] * sigma[i * A + a];
      const res = traverse(node.children[a], p === 0 ? scaled : r0, p === 0 ? r1 : scaled);
      childOwn.push(p === 0 ? res.v0 : res.v1);
      const other = p === 0 ? res.v1 : res.v0;
      for (let k = 0; k < vOther.length; k++) vOther[k] += other[k];
    }

    const vOwn = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let a = 0; a < A; a++) v += sigma[i * A + a] * childOwn[a][i];
      vOwn[i] = v;
    }

    const reg = regrets[node.id];
    const ss = stratSum[node.id];
    for (let i = 0; i < n; i++) {
      const w = reach[i];
      for (let a = 0; a < A; a++) {
        reg[i * A + a] += childOwn[a][i] - vOwn[i];
        ss[i * A + a] += w * sigma[i * A + a];
      }
    }

    return p === 0 ? { v0: vOwn, v1: vOther } : { v0: vOther, v1: vOwn };
  }

  for (let it = 0; it < iterations; it++) {
    traverse(tree.root, Float64Array.from(prior0), Float64Array.from(prior1));
  }

  const strategy = nodes.map((nd) => {
    const n = nd.player === 0 ? n0 : n1;
    const A = nd.actions.length;
    const ss = stratSum[nd.id];
    const out = new Float64Array(n * A);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let a = 0; a < A; a++) sum += ss[i * A + a];
      for (let a = 0; a < A; a++) out[i * A + a] = sum > 0 ? ss[i * A + a] / sum : 1 / A;
    }
    return out;
  });

  // Value of the solved strategy profile.
  function evaluate(node: TreeNode, r0: Float64Array, r1: Float64Array): { v0: Float64Array; v1: Float64Array } {
    if (node.kind === 'terminal') return terminalValues(node, r0, r1);
    const p = node.player;
    const n = p === 0 ? n0 : n1;
    const A = node.actions.length;
    const reach = p === 0 ? r0 : r1;
    const sigma = strategy[node.id];
    const vOwn = new Float64Array(n);
    const vOther = new Float64Array(p === 0 ? n1 : n0);
    for (let a = 0; a < A; a++) {
      const scaled = new Float64Array(n);
      for (let i = 0; i < n; i++) scaled[i] = reach[i] * sigma[i * A + a];
      const res = evaluate(node.children[a], p === 0 ? scaled : r0, p === 0 ? r1 : scaled);
      const own = p === 0 ? res.v0 : res.v1;
      const other = p === 0 ? res.v1 : res.v0;
      for (let i = 0; i < n; i++) vOwn[i] += sigma[i * A + a] * own[i];
      for (let k = 0; k < vOther.length; k++) vOther[k] += other[k];
    }
    return p === 0 ? { v0: vOwn, v1: vOther } : { v0: vOther, v1: vOwn };
  }

  // Best response for `br`, with the opponent pinned to the solved strategy.
  function bestResponse(node: TreeNode, r0: Float64Array, r1: Float64Array, br: 0 | 1): Float64Array {
    if (node.kind === 'terminal') {
      const res = terminalValues(node, r0, r1);
      return br === 0 ? res.v0 : res.v1;
    }
    const p = node.player;
    const A = node.actions.length;
    if (p === br) {
      const n = br === 0 ? n0 : n1;
      const best = new Float64Array(n).fill(-Infinity);
      for (let a = 0; a < A; a++) {
        // The best responder picks one action outright, so reach is unchanged.
        const child = bestResponse(node.children[a], r0, r1, br);
        for (let i = 0; i < n; i++) if (child[i] > best[i]) best[i] = child[i];
      }
      return best;
    }
    const n = p === 0 ? n0 : n1;
    const reach = p === 0 ? r0 : r1;
    const sigma = strategy[node.id];
    const acc = new Float64Array(br === 0 ? n0 : n1);
    for (let a = 0; a < A; a++) {
      const scaled = new Float64Array(n);
      for (let i = 0; i < n; i++) scaled[i] = reach[i] * sigma[i * A + a];
      const child = bestResponse(node.children[a], p === 0 ? scaled : r0, p === 0 ? r1 : scaled, br);
      for (let k = 0; k < acc.length; k++) acc[k] += child[k];
    }
    return acc;
  }

  // Probability mass of legal (non-blocked) matchups — card removal means not
  // every pairing of the two ranges can actually occur.
  let mass = 0;
  for (let i = 0; i < n0; i++) {
    const base = i * n1;
    for (let j = 0; j < n1; j++) if (outcome[base + j] !== BLOCKED) mass += prior0[i] * prior1[j];
  }

  const evRes = evaluate(tree.root, Float64Array.from(prior0), Float64Array.from(prior1));
  // Divide out that mass so the two EVs are per-hand-played and sum to the pot.
  const ev0 = mass > 0 ? dot(prior0, evRes.v0) / mass : 0;
  const ev1 = mass > 0 ? dot(prior1, evRes.v1) / mass : 0;

  const br0 = dot(prior0, bestResponse(tree.root, Float64Array.from(prior0), Float64Array.from(prior1), 0));
  const br1 = dot(prior1, bestResponse(tree.root, Float64Array.from(prior0), Float64Array.from(prior1), 1));
  const total = pot * mass;
  const exploitability = total > 0 ? Math.max(0, br0 + br1 - total) / total : 0;

  return { strategy, ev0, ev1, exploitability, iterations, ms: Date.now() - started };
}
