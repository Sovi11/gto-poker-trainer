// Betting-tree construction for a heads-up river spot.
//
// The river is the one street a browser can solve honestly: the board is
// complete, so there are no chance nodes left — just a finite betting tree over
// two fixed ranges. Everything below is exact; no abstraction, no bucketing.

export type Player = 0 | 1; // 0 = out of position (acts first), 1 = in position

export type ActionKind = 'check' | 'bet' | 'call' | 'fold' | 'raise';

export interface Action {
  kind: ActionKind;
  /** Chips this action puts in on top of what the player already committed. */
  add: number;
  /** Total this player has committed on the river after acting. */
  to: number;
  label: string;
}

export interface TerminalNode {
  kind: 'terminal';
  /** true = both players saw the river out; false = someone folded. */
  showdown: boolean;
  folder?: Player;
  c0: number;
  c1: number;
}

export interface DecisionNode {
  kind: 'decision';
  id: number; // index into the regret/strategy tables
  player: Player;
  actions: Action[];
  children: TreeNode[];
  c0: number;
  c1: number;
  /** Action path from the root, e.g. ["check", "bet 33"]. */
  path: string[];
}

export type TreeNode = DecisionNode | TerminalNode;

export interface TreeConfig {
  pot: number;
  /** Effective stack behind, per player. */
  stack: number;
  /** Bet sizes as a fraction of the current pot. */
  betSizes: number[];
  /** Raise sizes as a fraction of the pot after calling. */
  raiseSizes: number[];
  /** How many raises are allowed on top of the initial bet. */
  maxRaises: number;
}

export interface BuiltTree {
  root: TreeNode;
  /** Decision nodes indexed by id, for regret storage and UI navigation. */
  nodes: DecisionNode[];
}

const round = (x: number) => Math.max(1, Math.round(x));

export function buildRiverTree(cfg: TreeConfig): BuiltTree {
  const nodes: DecisionNode[] = [];

  const decision = (
    player: Player,
    c0: number,
    c1: number,
    path: string[],
    specs: { action: Action; child: () => TreeNode }[],
  ): DecisionNode => {
    const node: DecisionNode = {
      kind: 'decision',
      id: nodes.length,
      player,
      actions: specs.map((s) => s.action),
      children: [],
      c0,
      c1,
      path,
    };
    nodes.push(node); // register before recursing so ids are stable
    node.children = specs.map((s) => s.child());
    return node;
  };

  const showdown = (c0: number, c1: number): TerminalNode => ({ kind: 'terminal', showdown: true, c0, c1 });
  const folded = (folder: Player, c0: number, c1: number): TerminalNode => ({
    kind: 'terminal',
    showdown: false,
    folder,
    c0,
    c1,
  });

  const committed = (p: Player, c0: number, c1: number) => (p === 0 ? c0 : c1);
  const withCommit = (p: Player, c0: number, c1: number, to: number): [number, number] =>
    p === 0 ? [to, c1] : [c0, to];

  // Facing a bet/raise: fold, call, or (if allowed) raise.
  function facing(p: Player, c0: number, c1: number, path: string[], raisesLeft: number): TreeNode {
    const own = committed(p, c0, c1);
    const opp = committed((1 - p) as Player, c0, c1);
    const toCall = opp - own;
    const specs: { action: Action; child: () => TreeNode }[] = [];

    specs.push({
      action: { kind: 'fold', add: 0, to: own, label: 'fold' },
      child: () => folded(p, c0, c1),
    });

    const callTo = own + Math.min(toCall, cfg.stack - own);
    specs.push({
      action: { kind: 'call', add: callTo - own, to: callTo, label: `call ${callTo - own}` },
      child: () => {
        const [n0, n1] = withCommit(p, c0, c1, callTo);
        return showdown(n0, n1);
      },
    });

    // A raise needs chips behind and a legal increment.
    if (raisesLeft > 0 && cfg.stack > callTo) {
      const potAfterCall = cfg.pot + callTo * 2;
      for (const frac of cfg.raiseSizes) {
        const target = Math.min(round(callTo + potAfterCall * frac), cfg.stack);
        if (target <= opp) continue; // must exceed the bet we face
        const isAllIn = target >= cfg.stack;
        specs.push({
          action: {
            kind: 'raise',
            add: target - own,
            to: target,
            label: isAllIn ? `all-in ${target}` : `raise to ${target}`,
          },
          child: () => {
            const [n0, n1] = withCommit(p, c0, c1, target);
            return facing((1 - p) as Player, n0, n1, [...path, `raise ${target}`], raisesLeft - 1);
          },
        });
      }
    }

    return decision(p, c0, c1, path, specs);
  }

  // Nobody has bet yet on this street: check or bet.
  function unopened(p: Player, c0: number, c1: number, path: string[], isSecond: boolean): TreeNode {
    const own = committed(p, c0, c1);
    const specs: { action: Action; child: () => TreeNode }[] = [];

    specs.push({
      action: { kind: 'check', add: 0, to: own, label: 'check' },
      child: () =>
        isSecond
          ? showdown(c0, c1) // check-through ends the hand
          : unopened((1 - p) as Player, c0, c1, [...path, 'check'], true),
    });

    if (cfg.stack > own) {
      for (const frac of cfg.betSizes) {
        const target = Math.min(round(cfg.pot * frac), cfg.stack);
        if (target <= own) continue;
        const isAllIn = target >= cfg.stack;
        specs.push({
          action: {
            kind: 'bet',
            add: target - own,
            to: target,
            label: isAllIn ? `all-in ${target}` : `bet ${target}`,
          },
          child: () => {
            const [n0, n1] = withCommit(p, c0, c1, target);
            return facing((1 - p) as Player, n0, n1, [...path, `bet ${target}`], cfg.maxRaises);
          },
        });
      }
    }

    return decision(p, c0, c1, path, specs);
  }

  const root = unopened(0, 0, 0, [], false);
  return { root, nodes };
}

/** Chips player 0 wins (relative to the start of the river) at a terminal. */
export function terminalPayoff0(
  t: TerminalNode,
  pot: number,
  outcome: -1 | 0 | 1, // player 0 vs player 1 at showdown
): number {
  if (!t.showdown) {
    return t.folder === 1 ? pot + t.c1 : -t.c0;
  }
  if (outcome > 0) return pot + t.c1;
  if (outcome < 0) return -t.c0;
  return (pot + t.c1 - t.c0) / 2;
}
