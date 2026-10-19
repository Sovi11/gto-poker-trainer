// Run locally with --local, or against a built Linux image with its tag.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';

for (const resumed of [false, true]) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/ws/match/smoke/player`;
  let authenticated = false, heartbeat = false, action;
  let street = 0, requestedAt = 0, maxDecisionMs = 0;
  const boards = [[], ['2c', '7d', 'Jh'], ['2c', '7d', 'Jh', '3s'], ['2c', '7d', 'Jh', '3s', '9c']];
  let failure;
  const recordFailure = error => { failure ??= error; };
  server.on('connection', socket => {
    const send = value => socket.send(JSON.stringify(value));
    socket.on('message', raw => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'authenticate') {
          assert.equal(msg[resumed ? 'ticket' : 'token'], 'local-smoke-only');
          authenticated = true;
          send({ type: 'hello', match_id: 'smoke', seq: 1 });
        }
        if (msg.type === 'hello') send({ type: 'ping' });
        if (msg.type === 'pong') {
          heartbeat = true;
          const turn = { type: 'turn_request', request_id: 'smoke-request', match_id: 'smoke', seq: 4,
            valid_actions: ['fold', 'call', 'raise'], state: { hand_number: 1, phase: 'preflop',
              your_hole_cards: ['Ah', 'Ad'], board: [], pot: 150, your_stack: 1950,
              opponent_stacks: [1900], to_call: 50, min_raise: 200, max_raise: 2000 } };
          const seats = [{ seat: 1, is_self: true }, { seat: 0, is_self: false }];
          requestedAt = performance.now();
          if (resumed) send({ type: 'reconnected', seq: 2, match_id: 'smoke', seats,
            game_config: { big_blind: 100 }, state: { hand_number: 1, dealer_seat: 1,
              phase: 'preflop', board: [], pot: 150 }, pending_request: turn });
          else {
            send({ type: 'match_start', seq: 2, match_id: 'smoke', seats, game_config: { big_blind: 100 } });
            send({ type: 'round_start', seq: 3, state: { hand_number: 1, dealer_seat: 1,
              stacks: [2000, 2000], post_blind_stacks: [1900, 1950], pot: 150 } });
            send(turn);
          }
        }
        if (msg.type === 'turn_action') {
          assert.equal(msg.request_id, street ? `smoke-${street}` : 'smoke-request');
          const ms = performance.now() - requestedAt;
          maxDecisionMs = Math.max(maxDecisionMs, ms);
          assert.ok(ms < 2000, `Decision exceeded platform budget: ${ms}ms`);
          if (!street) {
            assert.equal(msg.action, 'raise');
            assert.ok(msg.params.amount >= 200 && msg.params.amount <= 2000);
          } else {
            assert.ok(['check', 'raise'].includes(msg.action));
            if (msg.action === 'raise') assert.ok(msg.params.amount >= 100 && msg.params.amount <= 1800);
          }
          action = msg;
          street++;
          if (street === 4) send({ type: 'match_end', seq: 20, match_id: 'smoke', results: { winner: 1 } });
          else {
            const phase = ['preflop', 'flop', 'turn', 'river'][street];
            // Diagnostic states isolate decisions on every street; betting is
            // reset to a settled 400-chip pot at each postflop request.
            send({ type: 'phase_change', seq: 4 + street * 2, state: { phase, board: boards[street] } });
            requestedAt = performance.now();
            send({ type: 'turn_request', request_id: `smoke-${street}`, match_id: 'smoke', seq: 5 + street * 2,
              valid_actions: ['check', 'raise'], state: { hand_number: 1, phase, your_hole_cards: ['Ah', 'Ad'],
                board: boards[street], pot: 400, your_stack: 1800, opponent_stacks: [1800],
                to_call: 0, min_raise: 100, max_raise: 1800 } });
          }
        }
      } catch (error) { recordFailure(error); socket.terminate(); }
    });
  });
  const local = process.argv[2] === '--local';
  const env = { ...process.env, CHIPZEN_WS_URL: url, CHIPZEN_TOKEN: '', CHIPZEN_TICKET: '',
    [resumed ? 'CHIPZEN_TICKET' : 'CHIPZEN_TOKEN']: 'local-smoke-only' };
  const args = local ? ['--import', 'tsx', 'scripts/arena-container.ts'] : [
    'run', '--rm', '--network=host', '--read-only', '--cap-drop=ALL', '--cpus=0.5',
    '--memory=256m', '--memory-swap=256m', '--pids-limit=64', '--user=10001:10001',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=10m', '-e', 'CHIPZEN_WS_URL', '-e', 'CHIPZEN_TOKEN',
    '-e', 'CHIPZEN_TICKET', process.argv[2] ?? 'allin:upload' ];
  const child = spawn(local ? process.execPath : 'docker', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  const timer = setTimeout(() => { recordFailure(new Error('Container smoke timed out')); child.kill(); }, 20000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    if (failure) throw failure;
    assert.equal(code, 0, logs);
    assert.ok(authenticated && heartbeat && action && street === 4, logs);
    console.log(`PASS ${resumed ? 'ticket/resume' : 'token/start'} handshake, heartbeat, four street decisions, clean exit; max ${maxDecisionMs.toFixed(1)}ms`);
  } finally {
    clearTimeout(timer);
    for (const socket of server.clients) socket.terminate();
    await new Promise(resolve => server.close(resolve));
  }
}
