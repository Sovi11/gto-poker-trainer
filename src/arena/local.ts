import { Action, GameState, cardFromString } from '@chipzen-ai/bot';
import { HoldemHand } from '../game/holdem';
import { cardToString, mulberry32 } from '../engine/cards';
import { decide } from '../bots/decision';
import { BotProfile } from '../bots/personalities';
import { ArenaBot } from './bot';

export interface LocalResult { profit: number; actions: number; maxMs: number; times: number[]; cfrDecisions: number }

// The existing trainer engine supplies deals and settlement. Only the acting
// seat's hole cards cross this adapter. The opponent is never passed the bot.
export function playLocal(bot: ArenaBot, profile: BotProfile | 'random' | 'call' | 'fold' | 'jam', seed: number, heroSeat = 0, depth = 100, handNumber = 1, villainDepth = depth): LocalResult {
  const rng = mulberry32(seed ^ 0xabc123), stack = Math.round(depth * 100);
  const initial = [0, 1].map(i => Math.round((i === heroSeat ? depth : villainDepth) * 100));
  const h = new HoldemHand({ players: [0, 1].map(i => ({ id: String(i), name: String(i), isHuman: true, stack: initial[i] })), smallBlind: 50, bigBlind: 100, buttonIndex: seed % 2, seed });
  const committed = h.players.map(p => p.committed);
  bot.onRoundStart({ state: { hand_number: handNumber, dealer_seat: h.buttonIndex, pot: h.pot,
    stacks: initial, post_blind_stacks: h.players.map(p => p.stack) } });
  const history: { seat: number; action: string; amount: number }[] = [0, 1].map(seat => ({ seat, action: seat === h.buttonIndex ? 'post_small_blind' : 'post_big_blind', amount: committed[seat] }));
  let actions = 0, maxMs = 0, cfrDecisions = 0; const times: number[] = [];
  while (!h.finished) {
    if (++actions > 150) throw new Error(`Nonterminating hand seed ${seed}`);
    const seat = h.toActIndex, player = h.currentPlayer!, opp = h.players[1 - seat], legal = h.legalActions();
    const valid = [legal.canFold ? 'fold' : '', legal.canCheck ? 'check' : '', legal.canCall ? 'call' : '', legal.canRaise ? 'raise' : ''].filter(Boolean);
    const s: GameState = { handNumber, phase: h.street as GameState['phase'], holeCards: player.hole!.map(c => cardFromString(cardToString(c))), board: h.board.map(c => cardFromString(cardToString(c))),
      pot: h.pot, yourStack: player.stack, opponentStacks: [opp.stack], yourSeat: seat, dealerSeat: h.buttonIndex,
      toCall: Math.max(0, h.currentBet - player.committed), minRaise: legal.minRaiseTo, maxRaise: legal.canRaise ? legal.maxRaiseTo : 0,
      validActions: valid, actionHistory: history, roundId: `local-${handNumber}`, requestId: String(actions) };
    let a: Action;
    if (seat === heroSeat) {
      const start = performance.now(); a = bot.decide(s); const ms = performance.now() - start; times.push(ms); maxMs = Math.max(maxMs, ms);
      if (bot.lastDecision?.method === 'river-cfr') cfrDecisions++;
    } else if (profile === 'random') {
      const kind = valid[Math.floor(rng() * valid.length)];
      a = kind === 'raise' ? Action.raiseTo(Math.round(legal.minRaiseTo + rng() * (legal.maxRaiseTo - legal.minRaiseTo))) : kind === 'call' ? Action.call() : kind === 'check' ? Action.check() : Action.fold();
    } else if (profile === 'jam') a = legal.canRaise ? Action.raiseTo(legal.maxRaiseTo) : legal.canCall ? Action.call() : Action.check();
    else if (profile === 'call' || profile === 'fold') a = legal.canCheck ? Action.check() : profile === 'call' && legal.canCall ? Action.call() : Action.fold();
    else {
      const d = decide({ hole: player.hole!, board: h.board, pot: h.pot, toCall: s.toCall, stack: player.stack, minRaise: legal.minRaiseTo, bigBlind: 100,
        position: seat === h.buttonIndex ? 'BTN' : 'BB', facingRaise: h.currentBet > 100, canRaise: legal.canRaise }, profile, rng);
      a = d.type === 'raise' || d.type === 'bet' ? legal.canRaise ? Action.raiseTo(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, d.amount))) : legal.canCheck ? Action.check() : Action.call()
        : d.type === 'call' ? legal.canCall ? Action.call() : Action.check() : d.type === 'check' ? Action.check() : legal.canCheck ? Action.check() : Action.fold();
    }
    if (!valid.includes(a.action) || (a.action === 'raise' && (!Number.isInteger(a.amount) || a.amount! < legal.minRaiseTo || a.amount! > legal.maxRaiseTo))) throw new Error(`Illegal ${JSON.stringify(a)} seed=${seed} state=${JSON.stringify(s)}`);
    const phase = h.street, beforeStack = player.stack, beforeCommitted = player.committed;
    const amount = a.action === 'raise' ? a.amount! : a.action === 'call' ? Math.min(s.toCall, player.stack) : 0;
    const delta = a.action === 'raise' ? amount - beforeCommitted : amount;
    const potAfter = h.pot + delta;
    const stacksAfter = h.players.map((p, i) => i === seat ? beforeStack - delta : p.stack);
    h.act(a.action as 'raise' | 'call' | 'fold' | 'check', a.amount);
    history.push({ seat, action: a.action, amount });
    bot.onTurnResult({ seat, details: { action: a.action, amount, pot: potAfter, stacks: stacksAfter, is_timeout: false } });
    if (h.street !== phase && !h.finished) bot.onPhaseChange({ state: { phase: h.street, board: h.board.map(cardToString) } });
  }
  if (h.players.reduce((n, p) => n + p.stack, 0) !== initial[0] + initial[1]) throw new Error('Chip conservation failed');
  return { profit: h.players[heroSeat].stack - stack, actions, maxMs, times, cfrDecisions };
}
