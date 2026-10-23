import { expect, it } from 'vitest';
import { parseGameState } from '@chipzen-ai/bot';
import { ArenaBot } from './bot';

for (const [name, hole, board] of [
  ['exclusive nuts', ['Ah', 'Kh'], ['Qh', 'Jh', 'Th', '2s', '3d']],
  ['nut flush with a blocking ace', ['Ah', '2c'], ['Kh', 'Qh', '7h', '4h', '3c']],
  ['board-only guaranteed chop', ['2c', '3d'], ['Ah', 'Kh', 'Qh', 'Jh', 'Th']],
] as const) it(`never folds ${name} at the low edge of the solver random draw`, () => {
  const state = parseGameState({ valid_actions: ['fold', 'call'], state: { hand_number: 1, phase: 'river',
    your_hole_cards: [...hole], board: [...board], pot: 1500, to_call: 500, your_stack: 500,
    opponent_stacks: [0], min_raise: 0, max_raise: 0 } });
  const original = new ArenaBot({ rng: () => 0, riverSafety: false });
  const guarded = new ArenaBot({ rng: () => 0, riverSafety: true });
  expect(original.decide(state).action).toBe('fold'); // Finite-CFR averaging retains initial exploration mass.
  expect(guarded.decide(state).action).toBe('call');
  expect(guarded.lastDecision?.method).toBe('river-safety');
  expect(guarded.lastDecision?.callPrice).toBe(.25);
  expect(guarded.lastDecision!.callEV).toBeGreaterThan(0);
  expect(new ArenaBot({ rng: () => 0 }).decide(state).action).toBe('call');
});

it('does not treat a strong hand as unbeatable when a better legal kicker exists', () => {
  const state = parseGameState({ valid_actions: ['fold', 'call'], state: { hand_number: 1, phase: 'river',
    your_hole_cards: ['Qh', 'Jd'], board: ['Kh', 'Kd', 'Kc', 'Ks', '2d'], pot: 1500, to_call: 500,
    your_stack: 500, opponent_stacks: [0], min_raise: 0, max_raise: 0 } });
  const bot = new ArenaBot({ rng: () => 0, riverSafety: true });
  expect(bot.decide(state).action).toBe('fold');
  expect(bot.lastDecision?.method).toBe('river-cfr');
});

it('reports contestable call odds and EV for an all-in short call', () => {
  const state = parseGameState({ valid_actions: ['fold', 'call'], state: { hand_number: 1, phase: 'river',
    your_hole_cards: ['2c', '3d'], board: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'], pot: 1400, to_call: 900,
    your_stack: 400, opponent_stacks: [0], min_raise: 0, max_raise: 0 } });
  const bot = new ArenaBot({ rng: () => 0, riverSafety: true });
  expect(bot.decide(state).action).toBe('call');
  expect(bot.lastDecision?.call).toBe(400);
  expect(bot.lastDecision?.callPrice).toBeCloseTo(400 / 1300, 12);
  expect(bot.lastDecision?.callEV).toBeCloseTo(250, 10);
});
