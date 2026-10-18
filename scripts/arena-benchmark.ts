import { writeFileSync, mkdirSync } from 'node:fs';
import { BOTS } from '../src/bots/personalities';
import { mulberry32 } from '../src/engine/cards';
import { ArenaBot } from '../src/arena/bot';
import { playLocal } from '../src/arena/local';

const pairs = Number(process.env.ARENA_PAIRS ?? 100);
if (!Number.isInteger(pairs) || pairs < 2) throw new Error('ARENA_PAIRS must be at least 2');
const seedBase = Number(process.env.ARENA_SEED ?? 78193);
const samples = Number(process.env.ARENA_SAMPLES ?? 1800);
if (!Number.isInteger(samples) || samples < 128) throw new Error('ARENA_SAMPLES must be at least 128');
const opponents = [...BOTS, 'random', 'call', 'fold', 'jam'] as const;
const selected = process.env.ARENA_OPPONENT;
const results = [];
for (let index = 0; index < opponents.length; index++) {
  const opponent = opponents[index], name = typeof opponent === 'string' ? opponent : opponent.id;
  if (selected && name !== selected) continue;
  const pairProfits = [], times: number[] = []; let cfr = 0;
  const bots = [0, 1].map(seat => {
    const bot = new ArenaBot({ rng: mulberry32(seedBase ^ (index * 1111 + seat * 555)), samples, river: process.env.ARENA_NO_CFR !== '1' });
    bot.onMatchStart({ game_config: { big_blind: 100 }, seats: [{ seat, is_self: true }] }); return bot;
  });
  for (let i = 0; i < pairs; i++) {
    let profit = 0;
    for (const seat of [0, 1]) {
      const result = playLocal(bots[seat], opponent, seedBase + i * 71, seat, [100, 40, 15, 8][i % 4], i + 1);
      profit += result.profit / 100; times.push(...result.times); cfr += result.cfrDecisions;
    }
    pairProfits.push(profit / 2);
  }
  const mean = pairProfits.reduce((a, b) => a + b, 0) / pairs;
  const variance = pairProfits.reduce((a, b) => a + (b - mean) ** 2, 0) / (pairs - 1);
  times.sort((a, b) => a - b);
  const row = { opponent: name, hands: pairs * 2, bbPer100: mean * 100, paired95CI: [mean - 1.96 * Math.sqrt(variance / pairs), mean + 1.96 * Math.sqrt(variance / pairs)].map(x => x * 100),
    decisions: times.length, p95Ms: times[Math.floor(times.length * .95)], maxMs: times[times.length - 1], cfrDecisions: cfr };
  results.push(row); console.log(JSON.stringify(row));
}
mkdirSync('artifacts', { recursive: true });
writeFileSync(`artifacts/arena-benchmark-${seedBase}.json`, JSON.stringify({ seed: seedBase, pairs, samples, river: process.env.ARENA_NO_CFR !== '1', depthsBB: [100, 40, 15, 8], note: 'Local trainer opponents; duplicate deals with seats swapped. Confidence intervals use paired deals. Not evidence of Chipzen ranking or tournament performance.', results }, null, 2) + '\n');
