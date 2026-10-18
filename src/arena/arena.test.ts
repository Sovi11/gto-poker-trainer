import { describe, expect, it } from 'vitest';
import { Action, cardFromString, GameState, parseGameState } from '@chipzen-ai/bot';
import { evaluateBest } from '../engine/evaluator';
import { fullDeck, mulberry32, parseCard, shuffle } from '../engine/cards';
import { evaluate } from './evaluate';
import { equity } from './equity';
import { HANDS, RangeBelief } from './ranges';
import { ArenaBot, legalize } from './bot';
import { playLocal } from './local';
import { riverTree } from './river';
import { DecisionNode } from '../solver/tree';

const cards = (s: string) => s.split(' ').map(parseCard);
function state(overrides: Partial<GameState> = {}): GameState {
  return { handNumber: 1, phase: 'preflop', holeCards: ['Ah', 'Ad'].map(cardFromString), board: [], pot: 150, yourStack: 9950,
    opponentStacks: [9900], yourSeat: 0, dealerSeat: 0, toCall: 50, minRaise: 200, maxRaise: 10000,
    validActions: ['fold', 'call', 'raise'], actionHistory: [{ seat: 1, action: 'post_big_blind', amount: 100 }], roundId: 'r1', requestId: 't1', ...overrides };
}

describe('arena evaluation and ranges', () => {
  it('matches the independent reference evaluator over 6,000 seeded deals, plus edge cases', () => {
    const rng = mulberry32(7411);
    for (let i = 0; i < 6000; i++) { const hand = shuffle(fullDeck(), rng).slice(0, 5 + i % 3); expect(evaluate(hand)).toBe(evaluateBest(hand)); }
    for (const hand of ['Ah 2d 3s 4c 5h 9h Kd', 'Ah Kh Qh Jh Th 2h 3c', 'Ah Ad Ac Kh Kd Kc 2s', 'Ah Ad Ac As Kh Kd Kc']) expect(evaluate(cards(hand))).toBe(evaluateBest(cards(hand)));
  });
  it('counts ties, excludes blocked combos, and computes exact weighted river equity', () => {
    const hole = cards('Ah Ad'), board = cards('2h 4d 7c 9s Jd');
    const range = [{ cards: cards('Kh Kd') as [number, number], weight: 3, strength: 0 }, { cards: cards('Jh Js') as [number, number], weight: 1, strength: 0 }, { cards: cards('Ah As') as [number, number], weight: 100, strength: 0 }];
    expect(equity(hole, board, range, mulberry32(1))).toBe(.75);
    expect(equity(cards('2d 3d'), cards('Ah Kh Qh Jh Th'), new RangeBelief().combos(), mulberry32(1))).toBe(.5);
  });
  it('retains a bluff tail while strengthening a range after a raise', () => {
    const r = new RangeBelief(); r.observe('raise', 4);
    const aa = HANDS.findIndex(c => c[0] % 13 === 12 && c[1] % 13 === 12);
    const trash = HANDS.findIndex(c => c[0] % 13 === 5 && c[1] % 13 === 0 && Math.floor(c[0] / 13) !== Math.floor(c[1] / 13));
    expect(r.weights[aa]).toBeGreaterThan(r.weights[trash]); expect(r.weights[trash]).toBeGreaterThan(0);
    r.setBoard(cards('Ah Kd 2c')); expect(r.combos().every(c => !c.cards.some(x => cards('Ah Kd 2c').includes(x)))).toBe(true);
  });
});

describe('arena protocol and strategy', () => {
  it('maps wire cards and raise-to totals without adding the blind twice', () => {
    const s = parseGameState({ request_id: 'turn', state: { hand_number: 1, phase: 'preflop', your_hole_cards: ['Ah', 'Ad'], board: [], pot: 150, your_stack: 9950, opponent_stacks: [9900], your_seat: 0, dealer_seat: 0, to_call: 50, min_raise: 200, max_raise: 10000 }, valid_actions: ['fold', 'call', 'raise'] });
    const a = new ArenaBot({ rng: mulberry32(1) }).decide(s);
    expect(a.action).toBe('raise'); expect(a.amount).toBe(225);
    expect(a.toWire()).toEqual({ action: 'raise', params: { amount: 225 } });
  });
  it('does not turn a small requested raise into a forced shove after betting is closed', () => {
    const s = state({ validActions: ['call', 'fold'], minRaise: 0, maxRaise: 0 });
    expect(legalize(s, Action.raiseTo(250)).action).toBe('fold');
    const s2 = state({ validActions: ['check', 'all_in'], yourStack: 5000 });
    expect(legalize(s2, Action.raiseTo(200)).action).toBe('check');
  });
  it('uses raise-to offsets and an outstanding wager in the river tree', () => {
    const s = state({ phase: 'river', pot: 1400, toCall: 400, yourStack: 3000, opponentStacks: [2600], minRaise: 1000, maxRaise: 3200 });
    const root = riverTree(s, 200).root as DecisionNode;
    expect(root.c0).toBe(0); expect(root.c1).toBe(400);
    for (const a of root.actions.filter(a => a.kind === 'raise')) { expect(a.to + 200).toBeGreaterThanOrEqual(1000); expect(a.to + 200).toBeLessThanOrEqual(3200); }
  });
  it('calls with the nuts and checks down a board-only tie', () => {
    const b = new ArenaBot({ rng: () => .999 });
    const s = state({ phase: 'river', holeCards: ['Ah', 'Kh'].map(cardFromString), board: ['Qh', 'Jh', 'Th', '2s', '3d'].map(cardFromString), pot: 1500, toCall: 500, yourStack: 500, opponentStacks: [0], minRaise: 0, maxRaise: 0, validActions: ['fold', 'call'] });
    expect(b.decide(s).action).toBe('call');
  });
  it('reconstructs identity, cards and contributions after reconnect', () => {
    const b = new ArenaBot();
    b.onReconnected({ seats: [{ seat: 1, is_self: true }], game_config: { big_blind: 200 }, state: { hand_number: 8, phase: 'river', board: ['2h', '4d', '7s', '9c', 'Jd'], pot: 1000 } });
    expect(b.opponent.board).toEqual(cards('2h 4d 7s 9c Jd'));
    expect(() => b.decide(state({ handNumber: 8, yourSeat: 1, phase: 'river', board: ['2h', '4d', '7s', '9c', 'Jd'].map(cardFromString) }))).not.toThrow();
  });
  it('takes seat and button from lifecycle when the wire turn omits both', () => {
    const b = new ArenaBot();
    b.onMatchStart({ seats: [{ seat: 1, is_self: true }] });
    b.onRoundStart({ state: { hand_number: 1, dealer_seat: 1, stacks: [10000, 10000], post_blind_stacks: [9900, 9950], pot: 150 } });
    const parsed = parseGameState({ valid_actions: ['fold', 'call', 'raise'], state: { hand_number: 1, phase: 'preflop', your_hole_cards: ['Ah', 'Ad'], pot: 150, your_stack: 9950, opponent_stacks: [9900], to_call: 50, min_raise: 200, max_raise: 10000 } });
    expect(b.decide(parsed).amount).toBe(225);
  });
  it('widens shove calls after repeated observed jams rather than folding forever', () => {
    const s = state({ holeCards: ['Ks', 'Qd'].map(cardFromString), yourStack: 9950, opponentStacks: [0], pot: 10050, toCall: 9950, minRaise: 0, maxRaise: 0, validActions: ['fold', 'call'] });
    const b = new ArenaBot({ rng: mulberry32(841), samples: 4000 });
    b.onMatchStart({ seats: [{ seat: 0, is_self: true }] });
    expect(b.decide(s).action).toBe('fold');
    for (let i = 0; i < 100; i++) {
      b.onRoundStart({ state: { hand_number: i + 1, dealer_seat: 0, stacks: [10000, 10000], post_blind_stacks: [9950, 9900] } });
      b.onTurnResult({ seat: 1, details: { action: 'raise', amount: 10000, pot: 10050, stacks: [9950, 0] } });
    }
    expect(b.decide({ ...s, handNumber: 100 }).action).toBe('call');
  });
  it('completes 64 varied-stack heads-up games with no illegal actions or chip loss', () => {
    const b = new ArenaBot({ rng: mulberry32(41), samples: 160 });
    for (let i = 0; i < 64; i++) {
      b.onMatchStart({ seats: [{ seat: i % 2, is_self: true }] });
      const r = playLocal(b, ['random', 'jam', 'call', 'fold'][i % 4] as 'random', 2001 + i, i % 2, [2, 8, 30, 100][i % 4], i + 1, [100, 30, 8, 2][i % 4]);
      expect(r.actions).toBeLessThan(150); expect(r.maxMs).toBeLessThan(1500);
    }
  }, 60000);
});
