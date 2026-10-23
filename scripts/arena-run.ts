import { runExternalBot, RetryPolicy } from '@chipzen-ai/bot';
import { ArenaBot, PRODUCTION_VARIANT, isStrategyVariant } from '../src/arena/bot';
import { observedTransport } from './arena-transport';

if (!process.env.CHIPZEN_BOT_ID || !process.env.CHIPZEN_EXTBOT_TOKEN) {
  console.error('Set CHIPZEN_BOT_ID and CHIPZEN_EXTBOT_TOKEN in .env.arena.local. See docs/CHIPZEN.md.');
  process.exit(1);
}
if (!process.env.CHIPZEN_EXTBOT_TOKEN.startsWith('cz_extbot_')) throw new Error('Expected a Chipzen external bot token');
const limit = process.env.CHIPZEN_MAX_MATCHES ? Number(process.env.CHIPZEN_MAX_MATCHES) : undefined;
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new Error('CHIPZEN_MAX_MATCHES must be a positive integer');
const variant = process.env.CHIPZEN_STRATEGY ?? PRODUCTION_VARIANT;
if (!isStrategyVariant(variant)) throw new Error('Unknown CHIPZEN_STRATEGY');
console.log(`Starting Fold Call or Jam (${variant} strategy) in the Chipzen production lobby. Keep this process online during fixtures.`);
await runExternalBot(() => new ArenaBot({ log: true, variant,
  contextualRanges: process.env.CHIPZEN_CONTEXT_RANGES === '1' ? true : undefined,
  riverSafety: process.env.CHIPZEN_RIVER_SAFETY === '0' ? false : undefined }), {
  botId: process.env.CHIPZEN_BOT_ID,
  token: process.env.CHIPZEN_EXTBOT_TOKEN,
  env: 'prod', clientName: 'fold-call-or-jam', maxMatches: limit,
  retryPolicy: new RetryPolicy({ maxReconnectAttempts: 20, initialBackoffMs: 500, maxBackoffMs: 5000 }),
  safeMode: false,
  transport: observedTransport,
});
