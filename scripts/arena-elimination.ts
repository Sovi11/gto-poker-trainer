import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ArenaBot, BotOptions } from '../src/arena/bot';
import { BOTS } from '../src/bots/personalities';
import { mulberry32 } from '../src/engine/cards';
import { LocalBot, LocalOpponent, playLocal } from '../src/arena/local';

const BaselineBot: typeof ArenaBot = (await import(pathToFileURL(resolve('src/arena/reference/baseline.mjs')).href)).ArenaBot;
const pairs = Number(process.env.ARENA_MATCH_PAIRS ?? 100), seed = Number(process.env.ARENA_SEED ?? 918771);
const label = process.env.ARENA_LABEL ?? 'candidate';
const samples = Number(process.env.ARENA_SAMPLES ?? 800);
const variant = (process.env.ARENA_VARIANT ?? 'preflop') as BotOptions['variant'];
const opponents: (typeof BOTS[number] | 'baseline' | 'jam')[] = [...BOTS, 'baseline', 'jam'];
const selected = process.env.ARENA_OPPONENT;
if (!Number.isInteger(pairs) || pairs < 2 || !Number.isInteger(seed) || !Number.isInteger(samples) || samples < 128) throw new Error('Invalid elimination settings');
const report = [];
for (const profile of opponents) {
  const name = typeof profile === 'string' ? profile : profile.id;
  if (selected && selected !== name) continue;
  let wins = 0, totalHands = 0, maxMs = 0; const pairScores: number[] = [];
  for (let pair = 0; pair < pairs; pair++) {
    let pairWins = 0;
    for (const seat of [0, 1]) {
      const bot = new ArenaBot({ rng: mulberry32(seed + pair * 997 + seat), samples, variant });
      bot.onMatchStart({ seats: [{ seat, is_self: true }] });
      const opponent: LocalOpponent = profile === 'baseline' ? new BaselineBot({ rng: mulberry32(seed + pair * 997 + 1 - seat), samples }) : profile;
      if (typeof opponent === 'object' && 'onMatchStart' in opponent) (opponent as LocalBot).onMatchStart({ seats: [{ seat: 1 - seat, is_self: true }] });
      let stacks: [number, number] = [10000, 10000], hand = 0;
      while (stacks[0] > 0 && stacks[1] > 0 && hand < 400) {
        const bb = Math.round(100 * 1.5 ** Math.floor(hand / 20));
        const result = playLocal(bot, opponent, seed + pair * 4217 + hand * 71, seat, 100, hand + 1, 100,
          { startingStacks: stacks, bigBlind: bb, button: hand % 2 });
        stacks = result.finalStacks; hand++; maxMs = Math.max(maxMs, result.maxMs);
      }
      if (hand >= 400) throw new Error('Elimination did not finish');
      const won = stacks[seat] > 0 ? 1 : 0; wins += won; pairWins += won; totalHands += hand;
    }
    pairScores.push(pairWins / 2);
    if ((pair + 1) % 25 === 0) console.log(JSON.stringify({ opponent: name, pairsDone: pair + 1, pairs, wins, winRate: wins / ((pair + 1) * 2), totalHands }));
  }
  const mean = wins / (pairs * 2), variance = pairScores.reduce((s, x) => s + (x - mean) ** 2, 0) / (pairs - 1);
  const row = { opponent: name, matches: pairs * 2, wins, winRate: mean, approximatePaired95CI: [mean - 1.96 * Math.sqrt(variance / pairs), mean + 1.96 * Math.sqrt(variance / pairs)], totalHands, maxMs };
  report.push(row); console.log(JSON.stringify(row));
}
mkdirSync('artifacts', { recursive: true });
writeFileSync(`artifacts/elimination-${label}-${seed}.json`, JSON.stringify({ seed, pairs, samples, variant, schedule: '100BB starting; blinds increase 1.5x every 20 hands; not a verified Season 11 schedule', results: report }, null, 2) + '\n');
