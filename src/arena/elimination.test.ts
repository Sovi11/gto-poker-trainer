import { expect, it } from 'vitest';
import { HoldemHand } from '../game/holdem';
import { ArenaBot } from './bot';
import { playLocal } from './local';
import { mulberry32 } from '../engine/cards';

it('settles forced all-ins when the remaining stacks are smaller than blinds', () => {
  for (const stacks of [[20, 30], [200, 20], [20, 200]]) for (const button of [0, 1]) {
    const h = new HoldemHand({ players: stacks.map((stack, i) => ({ id: String(i), name: String(i), stack, isHuman: true })), smallBlind: 50, bigBlind: 100, buttonIndex: button, seed: 171 });
    let steps = 0;
    while (!h.finished && steps++ < 8) { const legal = h.legalActions(); h.act(legal.canCheck ? 'check' : 'call'); }
    expect(h.finished).toBe(true); expect(h.board.length).toBe(5);
    expect(h.players.reduce((s, p) => s + p.stack, 0)).toBe(stacks[0] + stacks[1]);
  }
});

it('finishes a rising-blind elimination match, conserving chips on every hand', () => {
  const bot = new ArenaBot({ variant: 'preflop', rng: mulberry32(71), samples: 160 });
  bot.onMatchStart({ seats: [{ seat: 0, is_self: true }] });
  let stacks: [number, number] = [10000, 10000], hand = 0;
  while (stacks[0] > 0 && stacks[1] > 0 && hand < 150) {
    const r = playLocal(bot, 'call', 71 + hand * 37, 0, 100, hand + 1, 100, { startingStacks: stacks, bigBlind: Math.round(100 * 1.5 ** Math.floor(hand / 5)), button: hand % 2 });
    stacks = r.finalStacks; hand++;
    expect(stacks[0] + stacks[1]).toBe(20000); expect(Math.min(...stacks)).toBeGreaterThanOrEqual(0);
  }
  expect(Math.min(...stacks)).toBe(0);
}, 10000);
