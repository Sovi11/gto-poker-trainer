import WebSocket from 'ws';
import type { runExternalBot } from '@chipzen-ai/bot';

type Transport = NonNullable<NonNullable<Parameters<typeof runExternalBot>[1]>['transport']>;

// Mirror the official ws transport while exposing only safe connection events.
// Never log frames, tokens, subprotocols or gateway URLs.
export const observedTransport: Transport = async (url, options) => {
  const lobby = new URL(url).pathname.includes('/ws/external/bot/');
  const label = lobby ? 'lobby' : 'match';
  const ws = new WebSocket(url, options.subprotocols ?? [], {
    headers: { 'User-Agent': options.userAgent }, maxPayload: 2 ** 24,
  });
  const queue: string[] = [];
  let pending: Promise<string | null> | undefined;
  let resolvePending: ((value: string | null) => void) | undefined;
  let closed = false;
  const settle = (value: string | null) => {
    const resolve = resolvePending; pending = undefined; resolvePending = undefined;
    if (resolve) resolve(value); else if (value !== null) queue.push(value);
  };
  const end = () => { closed = true; settle(null); };
  ws.on('message', data => {
    const raw = String(data);
    try {
      const frame = JSON.parse(raw);
      if (['hello', 'matched', 'evict', 'error', 'ping'].includes(frame.type)) {
        console.log(JSON.stringify({ type: 'connection', channel: label, event: frame.type, at: new Date().toISOString() }));
      }
    } catch { /* Protocol parser handles malformed input. */ }
    settle(raw);
  });
  ws.on('close', code => { console.log(JSON.stringify({ type: 'connection', channel: label, event: 'closed', code })); end(); });
  ws.on('error', end);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => { ws.removeListener('error', reject); resolve(); });
    ws.once('error', reject);
  });
  console.log(JSON.stringify({ type: 'connection', channel: label, event: 'socket_open', at: new Date().toISOString() }));
  return {
    send: data => ws.send(data),
    // SDK recvWithTimeout races next() against a timer without cancelling the
    // read. Share an outstanding read so expired races cannot consume future
    // heartbeats or match dispatches behind the current caller's back.
    reader: { next: async () => {
      if (queue.length) return queue.shift()!;
      if (closed) return null;
      return pending ??= new Promise<string | null>(resolve => { resolvePending = resolve; });
    } },
    close: () => ws.close(),
  };
};
