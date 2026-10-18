import { Action, GameState } from '@chipzen-ai/bot';
import { solve, BLOCKED } from '../solver/cfr';
import { BuiltTree, DecisionNode, TreeNode, Action as TreeAction, Player } from '../solver/tree';
import { Combo, sampleRange } from './ranges';

// Build from the actual outstanding wager, not from an invented start-of-street
// pot. Contributions are relative to this decision; raises are translated back
// to the platform's absolute street totals only at the boundary.
export function riverTree(s: GameState, committed: number): BuiltTree {
  const nodes: DecisionNode[] = [];
  const owed = s.toCall, base = s.pot - owed;
  const cap = Math.min(s.yourStack, s.opponentStacks[0] + owed);
  const terminal = (c0: number, c1: number, folder?: Player): TreeNode => ({ kind: 'terminal', showdown: folder === undefined, folder, c0, c1 });
  const increment = Math.max(1, owed, s.minRaise - committed - owed);
  function node(p: Player, c0: number, c1: number, checked: boolean, depth: number, lastRaise: number, root = false): TreeNode {
    const own = p === 0 ? c0 : c1, opp = p === 0 ? c1 : c0, call = opp - own;
    const nd: DecisionNode = { kind: 'decision', id: nodes.length, player: p, c0, c1, path: [], actions: [], children: [] };
    nodes.push(nd);
    const add = (kind: TreeAction['kind'], to: number, child: () => TreeNode) => {
      nd.actions.push({ kind, to, add: to - own, label: `${kind} ${to}` }); nd.children.push(child());
    };
    if (call > 0) {
      add('fold', own, () => terminal(c0, c1, p));
      add('call', opp, () => terminal(opp, opp));
    } else {
      add('check', own, () => checked || (root && s.yourSeat === s.dealerSeat)
        ? terminal(c0, c1) : node((1 - p) as Player, c0, c1, true, depth, lastRaise));
    }
    const canRaise = root ? s.validActions.includes('raise') || s.validActions.includes('all_in') : true;
    if (canRaise && depth < 2 && opp < cap && own < cap) {
      const minimum = root ? Math.max(opp + 1, s.minRaise - committed) : opp + Math.max(lastRaise, 1);
      const maximum = root ? Math.min(cap, s.maxRaise > 0 ? s.maxRaise - committed : cap) : cap;
      const sizes = [...new Set([.5, 1].map(f => Math.round(opp + (base + 2 * opp) * f)).concat(cap)
        .map(x => Math.min(maximum, Math.max(minimum, x))))].filter(x => x > opp && x <= maximum && (x >= minimum || x === cap));
      for (const to of sizes) add(call > 0 ? 'raise' : 'bet', to, () => node((1 - p) as Player, p === 0 ? to : c0, p === 1 ? to : c1, false, depth + 1, to - opp));
    }
    return nd;
  }
  return { root: node(0, 0, owed, false, 0, increment, true), nodes };
}

export function solveRiver(s: GameState, committed: number, hole: number[], ownRange: Combo[], opponentRange: Combo[], rng: () => number): Action | null {
  if (s.toCall > s.yourStack || s.pot <= s.toCall || s.opponentStacks.length !== 1) return null;
  const own = sampleRange(ownRange, 36, hole), opp = sampleRange(opponentRange, 36);
  const index = own.findIndex(c => c.cards.includes(hole[0]) && c.cards.includes(hole[1]));
  if (index < 0 || !opp.length) return null;
  const outcome = new Int8Array(own.length * opp.length);
  let compatible = 0;
  for (let i = 0; i < own.length; i++) for (let j = 0; j < opp.length; j++) {
    const a = own[i], b = opp[j], blocked = a.cards.some(c => b.cards.includes(c));
    outcome[i * opp.length + j] = blocked ? BLOCKED : a.strength > b.strength ? 1 : a.strength < b.strength ? -1 : 0;
    if (i === index && !blocked) compatible++;
  }
  if (!compatible) return null;
  const tree = riverTree(s, committed);
  const result = solve({ tree, pot: s.pot - s.toCall, n0: own.length, n1: opp.length,
    prior0: Float64Array.from(own.map(c => c.weight)), prior1: Float64Array.from(opp.map(c => c.weight)), outcome, iterations: 100 });
  const root = tree.root as DecisionNode, A = root.actions.length;
  let u = rng(); let chosen = root.actions[A - 1];
  for (let a = 0; a < A; a++) { u -= result.strategy[root.id][index * A + a]; if (u <= 0) { chosen = root.actions[a]; break; } }
  if (chosen.kind === 'check') return Action.check();
  if (chosen.kind === 'fold') return Action.fold();
  if (chosen.kind === 'call') return Action.call();
  const to = committed + chosen.to;
  if (s.validActions.includes('raise')) return Action.raiseTo(to);
  return s.validActions.includes('all_in') && to >= committed + s.yourStack ? Action.allIn() : null;
}
