import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ArenaBot, BotOptions } from '../src/arena/bot';
import { mulberry32 } from '../src/engine/cards';
import { LocalBot, playLocal } from '../src/arena/local';

const BaselineBot: typeof ArenaBot = (await import(pathToFileURL(resolve('src/arena/reference/baseline.mjs')).href)).ArenaBot;
const seed = Number(process.env.ARENA_SEED ?? 5724831), pairs = Number(process.env.ARENA_PAIRS ?? 1000);
const samples = Number(process.env.ARENA_SAMPLES ?? 1000);
const label = process.env.ARENA_LABEL ?? 'candidate';
const variant = (process.env.ARENA_VARIANT ?? 'preflop') as BotOptions['variant'];
const baselineVariant = process.env.ARENA_BASELINE_VARIANT as BotOptions['variant'];
const contextualRanges = process.env.ARENA_CONTEXT_RANGES === '1';
const riverSafety = process.env.ARENA_RIVER_SAFETY === '1';
const depths = (process.env.ARENA_DEPTHS ?? '100,40,20,10,5').split(',').map(Number);
if (!Number.isInteger(pairs) || pairs < 2 || !Number.isInteger(seed) || !Number.isInteger(samples) || samples < 128 || !depths.every(d => Number.isFinite(d) && d > 0)) throw new Error('Invalid comparison settings');
const all = [];
for (const depth of depths) {
  const candidate = [0, 1].map(seat => new ArenaBot({ rng: mulberry32(seed + seat), samples, variant,
    contextualRanges: contextualRanges || undefined, riverSafety }));
  const OpponentBot = baselineVariant ? ArenaBot : BaselineBot;
  const baseline = [0, 1].map(seat => new OpponentBot({ rng: mulberry32(seed + 1 - seat), samples, variant: baselineVariant, riverSafety: false }));
  for (const seat of [0, 1]) {
    candidate[seat].onMatchStart({ seats: [{ seat, is_self: true }] });
    baseline[seat].onMatchStart({ seats: [{ seat: 1 - seat, is_self: true }] });
  }
  const profits: number[] = [], times: number[] = [];
  for (let i = 0; i < pairs; i++) {
    let pair = 0;
    for (const seat of [0, 1]) {
      const result = playLocal(candidate[seat], baseline[seat] as LocalBot, seed + i * 71, seat, depth, i + 1);
      pair += result.profit / 100; times.push(...result.times);
    }
    profits.push(pair / 2);
    if ((i + 1) % 250 === 0) console.log(JSON.stringify({ depthBB: depth, pairsDone: i + 1, totalPairs: pairs }));
  }
  const mean = profits.reduce((a, b) => a + b, 0) / pairs;
  const variance = profits.reduce((a, b) => a + (b - mean) ** 2, 0) / (pairs - 1);
  times.sort((a, b) => a - b);
  const row = { depthBB: depth, hands: pairs * 2, bbPer100: mean * 100,
    approximate95CI: [mean - 1.96 * Math.sqrt(variance / pairs), mean + 1.96 * Math.sqrt(variance / pairs)].map(x => x * 100),
    p95Ms: times[Math.floor(times.length * .95)], maxMs: times.at(-1) };
  all.push(row); console.log(JSON.stringify(row));
}
mkdirSync('artifacts', { recursive: true });
writeFileSync(`artifacts/compare-${label}-${seed}.json`, JSON.stringify({ seed, pairs, samples, variant, contextualRanges, riverSafety, baselineVariant: baselineVariant ?? 'frozen-original', results: all }, null, 2) + '\n');
