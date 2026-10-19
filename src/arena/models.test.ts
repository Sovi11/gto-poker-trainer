import { describe, expect, it } from 'vitest';
import { allHandClasses, classToCombos } from '../engine/range';
import { parseCard, mulberry32 } from '../engine/cards';
import { handVsHandEquity } from '../engine/equity';
import { BLOCKED, solve } from '../solver/cfr';
import { buildRiverTree } from '../solver/tree';
import { preflopModel, classIndex, shortStackPolicy, trainedHandPercentile } from './preflop-model';
import { continuationEquity } from './search';
import { solveContinuation } from './search';
import { parseGameState } from '@chipzen-ai/bot';
import { equityFeatures, predictEquity, EquityNetwork } from './equity-model';
import networkData from './models/equity-network.json';

const cards = (s: string) => s.split(' ').map(parseCard);
const hand = (s: string) => cards(s) as [number, number];

describe('trained preflop model', () => {
  it('has all 169 classes and exact card-removal joint probabilities', () => {
    expect(preflopModel.classes).toEqual(allHandClasses().flat());
    for (let i = 0; i < 169; i++) {
      expect(preflopModel.compatible[i].reduce((a, b) => a + b, 0)).toBe(1225);
      expect(preflopModel.combinations[i]).toBe(classToCombos(preflopModel.classes[i]).length);
      for (let j = 0; j < 169; j++) {
        expect(preflopModel.equity[i][j] + preflopModel.equity[j][i]).toBeCloseTo(1, 12);
        expect(preflopModel.combinations[i] * preflopModel.compatible[i][j]).toBe(preflopModel.combinations[j] * preflopModel.compatible[j][i]);
      }
    }
  });
  it('recovers known matchup equities and prioritizes premium pairs', () => {
    const aa = classIndex(hand('Ah Ad')), kk = classIndex(hand('Kh Kd'));
    expect(preflopModel.equity[aa][kk]).toBeGreaterThan(.79); expect(preflopModel.equity[aa][kk]).toBeLessThan(.85);
    expect(trainedHandPercentile(hand('Ah Ad'))).toBeGreaterThan(trainedHandPercentile(hand('Kh Kd')));
    expect(trainedHandPercentile(hand('Kh Kd'))).toBeGreaterThan(trainedHandPercentile(hand('Ah Kh')));
  });
  it('converges within its jam/fold abstraction and handles the one-BB boundary', () => {
    for (const policy of preflopModel.policies) {
      expect(policy.bestResponseGapBB).toBeLessThan(.002);
      expect(policy.sbJam.every(x => x >= 0 && x <= 1)).toBe(true); expect(policy.bbCall.every(x => x >= 0 && x <= 1)).toBe(true);
    }
    expect(shortStackPolicy(1, hand('7h 2d'))).toEqual({ jam: 1, call: 1 });
    expect(shortStackPolicy(10, hand('Ah Ad')).jam).toBeGreaterThan(.99);
    expect(shortStackPolicy(10, hand('7h 2d')).call).toBeLessThan(.01);
  });
});

describe('continuation values', () => {
  it('falls back when all sampled opponents collide with the actual hole cards', () => {
    const state = parseGameState({ valid_actions: ['check', 'raise'], state: { hand_number: 1, phase: 'flop', your_hole_cards: ['Ah', 'Ad'], board: ['2h', '3d', '4c'], pot: 1000, your_stack: 500, opponent_stacks: [500], min_raise: 100, max_raise: 500 } });
    expect(solveContinuation(state, 0, hand('Ah Ad'), [{ cards: hand('Ah Ad'), weight: 1, strength: 0 }], [{ cards: hand('Ah Kh'), weight: 1, strength: 0 }], () => .5, Infinity)).toBeNull();
  });
  it('agrees with independent exact turn runout enumeration', () => {
    const a = hand('Ah Ad'), b = hand('Ks Kc'), board = cards('2h 3c 4s 5d');
    expect(continuationEquity(a, b, board, mulberry32(1))).toBeCloseTo(handVsHandEquity(a, b, board).equity, 12);
  });
  it('preserves zero-sum payoffs, including blocked matchups', () => {
    const tree = buildRiverTree({ pot: 100, stack: 100, betSizes: [.5, 1], raiseSizes: [1], maxRaises: 1 });
    const outcome = new Int8Array([1, BLOCKED, -1, 0]);
    const s = solve({ tree, pot: 100, n0: 2, n1: 2, prior0: new Float64Array([1, 2]), prior1: new Float64Array([3, 1]), outcome,
      equity: new Float64Array([.85, 0, .2, .5]), iterations: 300 });
    expect(s.ev0 + s.ev1).toBeCloseTo(100, 8); expect(s.exploitability).toBeLessThan(.02);
  });
  it('reduces exactly to the existing river solver for binary outcomes', () => {
    const tree = buildRiverTree({ pot: 100, stack: 100, betSizes: [.5], raiseSizes: [1], maxRaises: 0 });
    const input = { tree, pot: 100, n0: 2, n1: 2, prior0: new Float64Array([1, 1]), prior1: new Float64Array([1, 1]), outcome: new Int8Array([1, 0, -1, 1]), iterations: 200 };
    const a = solve(input), b = solve({ ...input, equity: new Float64Array([1, .5, 0, 1]) });
    expect(b.ev0).toBeCloseTo(a.ev0, 10); expect(b.ev1).toBeCloseTo(a.ev1, 10);
  });
});

it('ships a calibrated, finite equity network with a disjoint validation board set', () => {
  const net = networkData as EquityNetwork;
  expect(net.validation.mse).toBeLessThan(net.validation.baselineMse * .2);
  expect(net.trainingRows).toBeGreaterThanOrEqual(48000);
  for (const pct of [0, .25, .5, .75, 1]) {
    const value = predictEquity(net, equityFeatures(hand('Ah Kh'), cards('Qh Jh 2c'), pct));
    expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThan(0); expect(value).toBeLessThan(1);
  }
});
