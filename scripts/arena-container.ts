import { runBot } from '@chipzen-ai/bot';
import { ArenaBot, PRODUCTION_VARIANT } from '../src/arena/bot';

const url = process.env.CHIPZEN_WS_URL;
if (!url) throw new Error('CHIPZEN_WS_URL is required; the Chipzen executor injects it at launch');
const parsed = new URL(url);
if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('Expected a WebSocket URL');
console.log(`ALLIN upload runner: ${PRODUCTION_VARIANT}`);
await runBot(url, new ArenaBot({ variant: PRODUCTION_VARIANT, log: true }), {
  token: process.env.CHIPZEN_TOKEN || null,
  ticket: process.env.CHIPZEN_TICKET || null,
  matchId: process.env.CHIPZEN_MATCH_ID || undefined,
  clientName: 'allin-upload',
  safeMode: false,
});
