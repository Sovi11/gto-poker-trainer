import { describe, expect, it } from 'vitest';
import { RangeBelief, HANDS } from './ranges';
import { trainedHandPercentile } from './preflop-model';
import { ArenaBot } from './bot';
import { parseGameState } from '@chipzen-ai/bot';
import networkData from './models/equity-network.json';
import type { EquityNetwork } from './equity-model';

const meanRank = (belief: RangeBelief) => {
  let weighted = 0, total = 0;
  for (let i = 0; i < HANDS.length; i++) { weighted += belief.weights[i] * trainedHandPercentile(HANDS[i]); total += belief.weights[i]; }
  return weighted / total;
};

describe('independent preflop context', () => {
  it('distinguishes opening position and reraises without an equity network', () => {
    const opening = new RangeBelief(true, undefined, true);
    const bb = new RangeBelief(true, undefined, true);
    const reraise = new RangeBelief(true, undefined, true);
    opening.observe('raise', 1.5, .45, { preflopRaises: 0, button: true });
    bb.observe('raise', 1.5, .45, { preflopRaises: 0, button: false });
    reraise.observe('raise', 1.5, .45, { preflopRaises: 1, button: true });
    expect(meanRank(bb)).toBeGreaterThan(meanRank(opening));
    // Reraises retain an explicitly polarized bluff component, so compare
    // premium mass rather than requiring their overall mean rank to rise.
    const premiumMass = (belief: RangeBelief) => {
      const total = belief.weights.reduce((a, b) => a + b, 0);
      return HANDS.reduce((mass, hand, i) => mass + (trainedHandPercentile(hand) > .98 ? belief.weights[i] / total : 0), 0);
    };
    expect(premiumMass(reraise)).toBeGreaterThan(premiumMass(bb));
  });
  it('keeps legacy updates unchanged when the option is absent or disabled', () => {
    const original = new RangeBelief(true), explicit = new RangeBelief(true, undefined, false);
    original.observe('raise', 1.5, .45, { preflopRaises: 0, button: true });
    explicit.observe('raise', 1.5, .45, { preflopRaises: 2, button: false });
    expect(explicit.weights).toEqual(original.weights);
  });
  it('distinguishes calling an open from calling a three-bet', () => {
    const open = new RangeBelief(true, undefined, true), threeBet = new RangeBelief(true, undefined, true);
    open.observe('call', .5, .45, { preflopRaises: 1, button: true });
    threeBet.observe('call', .5, .45, { preflopRaises: 2, button: true });
    expect(meanRank(threeBet)).toBeGreaterThan(meanRank(open));
    expect([...threeBet.weights].every(x => Number.isFinite(x) && x > 0 && x <= 1)).toBe(true);
  });
  it('preserves context enabled by default for the existing network variants', () => {
    const original = new RangeBelief(true, networkData as EquityNetwork);
    const explicit = new RangeBelief(true, networkData as EquityNetwork, true);
    for (const belief of [original, explicit]) belief.observe('raise', 2, .45, { preflopRaises: 1, button: false });
    expect(original.weights).toEqual(explicit.weights);
  });
  it('does not alter postflop updates when preflop histories are identical', () => {
    const enabled = new RangeBelief(true, undefined, true), control = new RangeBelief(true);
    for (const belief of [enabled, control]) {
      belief.setBoard([0, 17, 28]);
      belief.observe('raise', .75, .45, { preflopRaises: 2, button: false });
      belief.observe('call', .4, .45, { preflopRaises: 2, button: true });
    }
    expect(enabled.weights).toEqual(control.weights);
  });
});

for (const depth of [20, 100]) it(`retains contextual range updates across ${depth}BB hand resets and reconnect`, () => {
  const observe = (bot: ArenaBot) => bot.onTurnResult({ seat: 1, details: { action: 'raise', amount: 250, pot: 350 } });
  const enabled = new ArenaBot({ variant: 'hybrid', contextualRanges: true });
  const control = new ArenaBot({ variant: 'hybrid' });
  for (const bot of [enabled, control]) bot.onMatchStart({ seats: [{ seat: 0, is_self: true }], game_config: { big_blind: 100 } });
  for (const hand of [1, 2]) {
    for (const bot of [enabled, control]) {
      bot.onRoundStart({ state: { hand_number: hand, dealer_seat: 1, stacks: [depth * 100, depth * 100], post_blind_stacks: [depth * 100 - 100, depth * 100 - 50], pot: 150 } });
      observe(bot);
    }
    expect([...enabled.opponent.weights]).not.toEqual([...control.opponent.weights]);
  }
  for (const bot of [enabled, control]) {
    bot.onReconnected({ seats: [{ seat: 0, is_self: true }], game_config: { big_blind: 100 }, state: { hand_number: 3, dealer_seat: 1, phase: 'preflop', board: [], pot: 150 } });
    observe(bot);
  }
  expect([...enabled.opponent.weights]).not.toEqual([...control.opponent.weights]);
});

it('retains contextual mode when a turn request implicitly starts a short-stack hand', () => {
  const enabled = new ArenaBot({ variant: 'hybrid', contextualRanges: true }), control = new ArenaBot({ variant: 'hybrid' });
  const state = parseGameState({ valid_actions: ['check', 'raise'], state: { hand_number: 1, phase: 'preflop', your_hole_cards: ['Ah', 'Ad'], pot: 200, your_stack: 1900, opponent_stacks: [1900], to_call: 0, min_raise: 200, max_raise: 2000 } });
  for (const bot of [enabled, control]) {
    bot.decide(state);
    bot.onTurnResult({ seat: 1, details: { action: 'raise', amount: 250, pot: 350 } });
  }
  expect([...enabled.opponent.weights]).not.toEqual([...control.opponent.weights]);
});
