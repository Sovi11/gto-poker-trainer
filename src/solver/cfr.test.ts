import { describe, it, expect } from 'vitest';
import { solve, WIN, LOSE, BLOCKED } from './cfr';
import { BuiltTree, DecisionNode, buildRiverTree } from './tree';
import { buildOutcomeMatrix, rangeToCombos, parseBoard, solveRiverSpot, walkPath } from './riverspot';
import { closedForm } from './rivergame';

const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

/**
 * The polarized toy game as an explicit tree: bettor (player 0) checks or bets,
 * defender (player 1) folds or calls. Its equilibrium is known analytically, so
 * this pins the general CFR engine against a closed-form answer.
 */
function toyTree(bet: number): BuiltTree {
  const ip: DecisionNode = {
    kind: 'decision',
    id: 1,
    player: 1,
    actions: [
      { kind: 'fold', add: 0, to: 0, label: 'fold' },
      { kind: 'call', add: bet, to: bet, label: 'call' },
    ],
    children: [
      { kind: 'terminal', showdown: false, folder: 1, c0: bet, c1: 0 },
      { kind: 'terminal', showdown: true, c0: bet, c1: bet },
    ],
    c0: bet,
    c1: 0,
    path: ['bet'],
  };
  const root: DecisionNode = {
    kind: 'decision',
    id: 0,
    player: 0,
    actions: [
      { kind: 'check', add: 0, to: 0, label: 'check' },
      { kind: 'bet', add: bet, to: bet, label: 'bet' },
    ],
    children: [{ kind: 'terminal', showdown: true, c0: 0, c1: 0 }, ip],
    c0: 0,
    c1: 0,
    path: [],
  };
  return { root, nodes: [root, ip] };
}

// Player 0 holds the nuts (index 0) or air (index 1); player 1 holds a
// pure bluff-catcher that beats air and loses to the nuts.
function solveToy(pot: number, bet: number, iterations = 3000) {
  const outcome = Int8Array.from([WIN, LOSE]);
  return solve({
    tree: toyTree(bet),
    pot,
    n0: 2,
    n1: 1,
    prior0: Float64Array.from([1, 1]),
    prior1: Float64Array.from([1]),
    outcome,
    iterations,
  });
}

describe('CFR engine reproduces the closed-form polarized equilibrium', () => {
  for (const [pot, bet] of [
    [100, 100],
    [100, 50],
    [100, 200],
    [60, 45],
  ]) {
    it(`pot ${pot}, bet ${bet}`, () => {
      const sol = solveToy(pot, bet);
      const cf = closedForm({ pot, bet, valueFrac: 0.5 });

      const root = sol.strategy[0]; // 2 hands x 2 actions [check, bet]
      const betNuts = root[0 * 2 + 1];
      const betAir = root[1 * 2 + 1];
      const callFreq = sol.strategy[1][0 * 2 + 1]; // [fold, call]

      expect(near(betNuts, 1)).toBe(true); // always value bet the nuts
      expect(near(betAir, cf.bluffFreq)).toBe(true);
      expect(near(callFreq, cf.callFreq)).toBe(true);
      expect(sol.exploitability).toBeLessThan(0.01);
    });
  }

  it('splits a pot-sized-bet pot 75/25, matching the analytic value', () => {
    const sol = solveToy(100, 100);
    expect(near(sol.ev0, 75, 0.7)).toBe(true);
    expect(near(sol.ev1, 25, 0.7)).toBe(true);
    expect(near(sol.ev0 + sol.ev1, 100, 0.01)).toBe(true); // the pot is conserved
  });
});

describe('tree construction', () => {
  const cfg = { pot: 100, stack: 500, betSizes: [0.5, 1], raiseSizes: [1], maxRaises: 1 };

  it('opens with check plus one node per bet size', () => {
    const { root } = buildRiverTree(cfg);
    expect(root.kind).toBe('decision');
    if (root.kind !== 'decision') return;
    expect(root.player).toBe(0);
    expect(root.actions.map((a) => a.kind)).toEqual(['check', 'bet', 'bet']);
    expect(root.actions[1].to).toBe(50);
    expect(root.actions[2].to).toBe(100);
  });

  it('a check-through reaches showdown, and facing a bet offers fold/call/raise', () => {
    const { root } = buildRiverTree(cfg);
    if (root.kind !== 'decision') throw new Error('bad root');
    const afterCheck = root.children[0];
    if (afterCheck.kind !== 'decision') throw new Error('expected IP decision');
    expect(afterCheck.player).toBe(1);
    expect(afterCheck.children[0]).toMatchObject({ kind: 'terminal', showdown: true });

    const facingBet = root.children[1];
    if (facingBet.kind !== 'decision') throw new Error('expected a decision');
    expect(facingBet.player).toBe(1);
    expect(facingBet.actions.map((a) => a.kind)).toEqual(['fold', 'call', 'raise']);
  });

  it('respects the raise cap', () => {
    const capped = buildRiverTree({ ...cfg, maxRaises: 0 });
    const root = capped.root;
    if (root.kind !== 'decision') throw new Error('bad root');
    const facing = root.children[1];
    if (facing.kind !== 'decision') throw new Error('bad node');
    expect(facing.actions.map((a) => a.kind)).toEqual(['fold', 'call']);
  });

  it('never lets a player commit more than the effective stack', () => {
    const shallow = buildRiverTree({ pot: 100, stack: 60, betSizes: [1, 2], raiseSizes: [1], maxRaises: 2 });
    for (const nd of shallow.nodes) {
      for (const a of nd.actions) expect(a.to).toBeLessThanOrEqual(60);
    }
  });
});

describe('range and matchup handling', () => {
  const board = parseBoard('Kh 7d 2c 3s 9h');

  it('drops combos that clash with the board', () => {
    const { combos } = rangeToCombos('KK', board, 200);
    expect(combos.length).toBe(3); // one king is on the board: C(3,2)
  });

  it('marks card-sharing matchups as impossible', () => {
    const a = rangeToCombos('AA', board, 200).combos;
    const b = rangeToCombos('AKs', board, 200).combos;
    const m = buildOutcomeMatrix(a, b);
    let blocked = 0;
    for (let k = 0; k < m.length; k++) if (m[k] === BLOCKED) blocked++;
    expect(blocked).toBeGreaterThan(0); // every AKs shares its ace with some AA
  });

  it('sorts combos strongest first', () => {
    const { combos } = rangeToCombos('22+, AKs', board, 200);
    for (let i = 1; i < combos.length; i++) {
      expect(combos[i - 1].strength).toBeGreaterThanOrEqual(combos[i].strength);
    }
  });
});

describe('solving a real river spot', () => {
  const spot = solveRiverSpot({
    board: 'Kh 7d 2c 3s 9h',
    oopRange: 'QQ-88, AKo, KQs, A5s',
    ipRange: 'AA, KK, 77, A9s, QJs, JTs',
    pot: 100,
    stack: 300,
    betSizes: [0.5, 1],
    raiseSizes: [1],
    maxRaises: 1,
    iterations: 400,
  });

  it('converges to a low-exploitability strategy', () => {
    expect(spot.solution.exploitability).toBeLessThan(0.05);
  });

  it('conserves the pot between the two players', () => {
    expect(near(spot.solution.ev0 + spot.solution.ev1, spot.pot, 0.5)).toBe(true);
  });

  it('produces a valid probability distribution at every node and hand', () => {
    for (const nd of spot.tree.nodes) {
      const n = nd.player === 0 ? spot.oop.length : spot.ip.length;
      const A = nd.actions.length;
      const sigma = spot.solution.strategy[nd.id];
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let a = 0; a < A; a++) {
          const p = sigma[i * A + a];
          expect(p).toBeGreaterThanOrEqual(0);
          sum += p;
        }
        expect(near(sum, 1, 1e-9)).toBe(true);
      }
    }
  });

  it('walks a tree path and reports frequencies that sum to one', () => {
    const root = walkPath(spot, []);
    expect(root).not.toBeNull();
    expect(near(root!.frequencies.reduce((a, b) => a + b, 0), 1)).toBe(true);
    expect(root!.node.kind).toBe('decision');

    // OOP checks, then IP is to act with its full range still intact.
    const afterCheck = walkPath(spot, [0]);
    expect(afterCheck).not.toBeNull();
    expect(near(afterCheck!.reach1, 1)).toBe(true);
    expect(near(afterCheck!.frequencies.reduce((a, b) => a + b, 0), 1)).toBe(true);
  });

  it('narrows the acting range as the path gets more aggressive', () => {
    const check = walkPath(spot, [0]);
    const bet = walkPath(spot, [1]);
    // Betting is a subset of the range, so less of it reaches that node.
    expect(bet!.reach0).toBeLessThan(1);
    expect(check!.reach0).toBeLessThan(1);
    expect(near(check!.reach0 + bet!.reach0 + (walkPath(spot, [2])?.reach0 ?? 0), 1)).toBe(true);
  });
});
