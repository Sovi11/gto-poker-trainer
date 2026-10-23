import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ArenaBot, BotOptions } from '../src/arena/bot';
import { BOTS } from '../src/bots/personalities';
import { mulberry32 } from '../src/engine/cards';
import { playLocal } from '../src/arena/local';

const BaselineBot: typeof ArenaBot = (await import(pathToFileURL(resolve('src/arena/reference/baseline.mjs')).href)).ArenaBot;
const variant = (process.env.ARENA_VARIANT ?? 'hybrid') as BotOptions['variant'];
const contextualRanges = process.env.ARENA_CONTEXT_RANGES === '1';
const riverSafety = process.env.ARENA_RIVER_SAFETY === '1';
const baselineVariant = process.env.ARENA_BASELINE_VARIANT as BotOptions['variant'];
const label = process.env.ARENA_LABEL ?? variant;
const pairs = Number(process.env.ARENA_PAIRS ?? 500), seed = Number(process.env.ARENA_SEED ?? 926753), samples = Number(process.env.ARENA_SAMPLES ?? 1000);
const opponents = [...BOTS.filter(p => ['maniac', 'gto', 'shark', 'station'].includes(p.id)), 'jam'] as const;
if (!Number.isInteger(pairs) || pairs < 2 || !Number.isInteger(seed) || !Number.isInteger(samples) || samples < 128) throw new Error('Invalid field comparison settings');
const results = [];
for (let k = 0; k < opponents.length; k++) {
  const profile = opponents[k], name = typeof profile === 'string' ? profile : profile.id;
  const candidates = [0, 1].map(seat => new ArenaBot({ rng: mulberry32(seed + k * 97 + seat), samples, variant,
    contextualRanges: contextualRanges || undefined, riverSafety }));
  const OpponentBot = baselineVariant ? ArenaBot : BaselineBot;
  const baselines = [0, 1].map(seat => new OpponentBot({ rng: mulberry32(seed + k * 97 + seat), samples, variant: baselineVariant, riverSafety: false }));
  for (let seat = 0; seat < 2; seat++) for (const bot of [candidates[seat], baselines[seat]]) bot.onMatchStart({ seats: [{ seat, is_self: true }] });
  const differences = []; let candidateProfit = 0, baselineProfit = 0, maxMs = 0;
  for (let i = 0; i < pairs; i++) {
    let delta = 0;
    for (const seat of [0, 1]) {
      const depth = [100, 40, 20, 10, 5][i % 5], dealSeed = seed + i * 71;
      const c = playLocal(candidates[seat], profile, dealSeed, seat, depth, i + 1);
      const b = playLocal(baselines[seat], profile, dealSeed, seat, depth, i + 1);
      candidateProfit += c.profit / 100; baselineProfit += b.profit / 100;
      delta += (c.profit - b.profit) / 100; maxMs = Math.max(maxMs, c.maxMs);
    }
    differences.push(delta / 2);
    if ((i + 1) % 250 === 0) console.log(JSON.stringify({ opponent: name, pairsDone: i + 1, pairs }));
  }
  const mean = differences.reduce((a, b) => a + b, 0) / pairs;
  const variance = differences.reduce((a, b) => a + (b - mean) ** 2, 0) / (pairs - 1);
  const row = { opponent: name, handsPerPolicy: pairs * 2, candidateBBPer100: candidateProfit * 100 / (pairs * 2), baselineBBPer100: baselineProfit * 100 / (pairs * 2),
    improvementBBPer100: mean * 100, approximatePaired95Improvement: [mean - 1.96 * Math.sqrt(variance / pairs), mean + 1.96 * Math.sqrt(variance / pairs)].map(x => x * 100), maxMs };
  results.push(row); console.log(JSON.stringify(row));
}
writeFileSync(`artifacts/field-${label}-${seed}.json`, JSON.stringify({ seed, pairs, samples, variant, contextualRanges, riverSafety, baselineVariant: baselineVariant ?? 'frozen-original', depthsBB: [100, 40, 20, 10, 5], results }, null, 2) + '\n');
