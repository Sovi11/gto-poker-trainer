import { expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { runBot } from '@chipzen-ai/bot';
import { ArenaBot } from './bot';

for (const resumed of [false, true]) {
  it(`plays through the real SDK and WebSocket ${resumed ? 'after resume' : 'from match start'} without turn seat fields`, async () => {
    const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port');
    let reply: Record<string, unknown> | undefined;
    server.on('connection', socket => {
      const send = (value: unknown) => socket.send(JSON.stringify(value));
      socket.on('message', data => {
        const msg = JSON.parse(String(data));
        if (msg.type === 'authenticate') send({ type: 'hello', match_id: 'test', seq: 1 });
        if (msg.type === 'hello') {
          const pending = { type: 'turn_request', request_id: 'req-without-seat', match_id: 'test', seq: 4,
            valid_actions: ['fold', 'call', 'raise'], state: { hand_number: 1, phase: 'preflop', your_hole_cards: ['Ah', 'Ad'], board: [],
              pot: 150, your_stack: 9950, opponent_stacks: [9900], to_call: 50, min_raise: 200, max_raise: 10000 } };
          const seats = [{ seat: 1, is_self: true }, { seat: 0, is_self: false }];
          if (resumed) send({ type: 'reconnected', seq: 2, match_id: 'test', seats, game_config: { big_blind: 100 },
            state: { hand_number: 1, dealer_seat: 1, phase: 'preflop', board: [], pot: 150 }, pending_request: pending });
          else {
            send({ type: 'match_start', seq: 2, match_id: 'test', seats, game_config: { big_blind: 100 } });
            send({ type: 'round_start', seq: 3, match_id: 'test', state: { hand_number: 1, dealer_seat: 1, stacks: [10000, 10000], post_blind_stacks: [9900, 9950], pot: 150 } });
            send(pending);
          }
        }
        if (msg.type === 'turn_action') { reply = msg; send({ type: 'match_end', seq: 5, match_id: 'test', results: { winner: 1 } }); }
      });
    });
    try {
      await runBot(`ws://127.0.0.1:${address.port}/ws/match/test/player`, new ArenaBot(), { token: 'local-test-only', safeMode: false, maxRetries: 0 });
      expect(reply).toMatchObject({ type: 'turn_action', request_id: 'req-without-seat', action: 'raise', params: { amount: 225 } });
    } finally {
      for (const socket of server.clients) socket.terminate();
      await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    }
  }, 10000);
}
