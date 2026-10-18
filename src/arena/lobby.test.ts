import { expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { runExternalBot } from '@chipzen-ai/bot';
import { ArenaBot } from './bot';
import { observedTransport } from '../../scripts/arena-transport';

it('answers a heartbeat after the SDK lobby receive timeout without losing the frame', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  let pong = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  server.on('connection', ws => {
    ws.on('message', raw => {
      const frame = JSON.parse(String(raw));
      if (frame.type === 'authenticate') {
        ws.send(JSON.stringify({ type: 'hello' }));
        // The upstream recvWithTimeout abandons a read after 2 seconds.
        timer = setTimeout(() => ws.send(JSON.stringify({ type: 'ping' })), 2500);
      }
      if (frame.type === 'pong') { pong = true; ws.send(JSON.stringify({ type: 'evict', reason: 'test complete' })); }
    });
  });
  try {
    const result = await runExternalBot(new ArenaBot(), { url: `ws://127.0.0.1:${address.port}/ws/external/bot/test`, token: 'cz_extbot_test_only', transport: observedTransport });
    expect(result).toEqual([]); expect(pong).toBe(true);
  } finally {
    clearTimeout(timer);
    for (const ws of server.clients) ws.terminate();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}, 7000);
