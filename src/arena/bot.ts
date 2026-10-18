import { Action, Bot, GameState } from '@chipzen-ai/bot';
import { parseCard } from '../engine/cards';
import { handClassOf, handPercentile } from '../bots/preflopStrength';
import { parseRange } from '../engine/range';
import { nearestPushFold } from '../gto/pushfold';
import { drawStrength, RangeBelief } from './ranges';
import { equity } from './equity';
import { solveRiver } from './river';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
type Raw = Record<string, unknown>;
export interface BotOptions { rng?: () => number; samples?: number; river?: boolean; log?: boolean }

export class ArenaBot extends Bot {
  own = new RangeBelief(); opponent = new RangeBelief();
  private seat = 0;
  private seatKnown = false;
  private dealer = 0;
  private dealerKnown = false;
  private board: number[] = [];
  private phase = 'preflop';
  private committed = [0, 0];
  private pot = 0;
  private bb = 100;
  private hand = -1;
  private preRaises = 0;
  private lastAggressor = -1;
  private observations = 0;
  private folds = 0;
  private facing = 0;
  private aggressions = 0;
  private decisions = 0;
  private preflopHands = 0;
  private jamHands = 0;
  private countedPreflop = false;
  private countedJam = false;
  private rng: () => number;
  private options: BotOptions;
  lastDecision: { ms: number; method: string; equity?: number; action: string } | null = null;

  constructor(options: BotOptions = {}) { super(); this.options = options; this.rng = options.rng ?? Math.random; }

  override onMatchStart(info: Raw): void {
    const cfg = (info.game_config ?? {}) as Raw;
    this.bb = Number(cfg.big_blind ?? 100);
    const seats = info.seats as { seat: number; is_self?: boolean }[] | undefined;
    const self = seats?.find(s => s.is_self);
    this.seatKnown = self !== undefined;
    this.seat = self?.seat ?? 0;
    this.dealerKnown = false;
    this.observations = this.folds = this.facing = this.aggressions = this.decisions = 0;
    this.preflopHands = this.jamHands = 0;
    this.hand = -1;
  }

  override onRoundStart(message: Raw): void {
    const state = (message.state ?? {}) as Raw;
    this.resetHand(Number(state.hand_number ?? 0));
    if (typeof state.dealer_seat === 'number') { this.dealer = state.dealer_seat; this.dealerKnown = true; }
    const stacks = state.stacks as number[] | undefined, after = state.post_blind_stacks as number[] | undefined;
    if (stacks && after) {
      this.committed = stacks.map((v, i) => v - after[i]);
      this.bb = Math.max(...this.committed, 1);
    } else {
      const dealer = Number(state.dealer_seat ?? 0);
      this.committed = [0, 1].map(i => i === dealer ? this.bb / 2 : this.bb);
    }
    this.pot = Number(state.pot ?? this.committed.reduce((a, b) => a + b, 0));
  }

  // The SDK restores the snapshot and pending turn. Old range beliefs must not
  // survive a reconnect with a potentially different hand or missed actions.
  override onReconnected(message: Raw): void {
    this.onMatchStart(message);
    const state = (message.state ?? {}) as Raw;
    this.resetHand(Number(state.hand_number ?? -1));
    if (typeof state.dealer_seat === 'number') { this.dealer = state.dealer_seat; this.dealerKnown = true; }
    this.setBoard((state.board as string[] | undefined ?? []).map(parseCard), String(state.phase ?? 'preflop'));
    this.pot = Number(state.pot ?? 0);
  }

  private resetHand(n: number): void {
    this.hand = n; this.own = new RangeBelief(); this.opponent = new RangeBelief();
    this.board = []; this.phase = 'preflop'; this.committed = [0, 0]; this.preRaises = 0; this.lastAggressor = -1;
    this.countedPreflop = this.countedJam = false;
  }

  private setBoard(board: number[], phase: string): void {
    if (phase !== this.phase) this.committed = [0, 0];
    this.phase = phase; this.board = board;
    this.own.setBoard(board); this.opponent.setBoard(board);
  }

  override onPhaseChange(message: Raw): void {
    const state = (message.state ?? {}) as Raw;
    this.setBoard((state.board as string[] ?? []).map(parseCard), String(state.phase ?? 'flop'));
  }

  override onTurnResult(message: Raw): void {
    const d = (message.details ?? {}) as Raw;
    const seat = Number(message.seat ?? d.seat), action = String(d.action ?? ''), amount = Number(d.amount ?? 0);
    if (!Number.isInteger(seat) || seat < 0 || seat > 1) return;
    const old = this.committed[seat];
    const owed = Math.max(...this.committed) - old;
    const timedOut = Boolean(message.is_timeout ?? d.is_timeout);
    if (!timedOut) {
      if (seat !== this.seat) {
        this.observations++; this.decisions++;
        if (!this.board.length) {
          if (!this.countedPreflop) { this.preflopHands++; this.countedPreflop = true; }
          const stacks = d.stacks as number[] | undefined;
          if (!this.countedJam && (action === 'all_in' || (action === 'raise' && stacks?.[seat] === 0))) {
            this.jamHands++; this.countedJam = true;
          }
        }
        if (owed > 0) { this.facing++; if (action === 'fold') this.folds++; }
        if (action === 'raise' || action === 'all_in') this.aggressions++;
      }
      (seat === this.seat ? this.own : this.opponent).observe(action, amount / Math.max(this.pot, this.bb), this.aggression());
    }
    if (action === 'raise' || action === 'all_in') {
      this.committed[seat] = amount; this.lastAggressor = seat;
      if (!this.board.length) this.preRaises++;
    } else if (action === 'call' || action.startsWith('post_')) this.committed[seat] += amount;
    this.pot = Number(d.pot ?? this.pot + this.committed[seat] - old);
  }

  private aggression(): number { return (this.aggressions + 9) / (this.decisions + 20); }
  private foldRate(): number { return (this.folds + 10) / (this.facing + 24); }

  override decide(input: GameState): Action {
    const started = performance.now();
    // The authoritative wire turn payload omits both seat fields. The SDK
    // fills them with zero, so lifecycle context must take precedence.
    const blindButton = input.actionHistory.find(a => a.action === 'post_small_blind')?.seat;
    const s: GameState = { ...input, yourSeat: this.seatKnown ? this.seat : input.yourSeat,
      dealerSeat: blindButton ?? (this.dealerKnown ? this.dealer : input.dealerSeat) };
    if (s.opponentStacks.length !== 1) throw new Error('ArenaBot supports heads-up only');
    if (this.hand !== s.handNumber) this.resetHand(s.handNumber);
    this.seat = s.yourSeat;
    const hole = s.holeCards.map(c => parseCard(c.rank + c.suit));
    const board = s.board.map(c => parseCard(c.rank + c.suit));
    if (hole.length !== 2 || ![0, 3, 4, 5].includes(board.length) || new Set([...hole, ...board]).size !== hole.length + board.length) throw new Error('Invalid cards');
    this.setBoard(board, s.phase);
    // max_raise is own street contribution + remaining stack even after
    // blinds, calls and reraises. It also repairs contribution after reconnect.
    const ownCommitted = s.maxRaise > 0 ? Math.max(0, s.maxRaise - s.yourStack) : this.committed[this.seat];
    this.committed[this.seat] = ownCommitted;
    this.committed[1 - this.seat] = ownCommitted + s.toCall;
    const blind = s.actionHistory.find(a => a.action === 'post_big_blind')?.amount;
    if (blind && blind > 0) this.bb = blind;
    this.pot = s.pot;
    let method = 'preflop', eq: number | undefined;
    let action: Action;
    if (!board.length) action = this.preflop(s, hole as [number, number], ownCommitted);
    else {
      const range = this.opponent.combos(hole);
      eq = equity(hole, board, range, this.rng, this.options.samples ?? 1800, started + 400);
      const river = board.length === 5 && this.options.river !== false
        ? solveRiver(s, ownCommitted, hole, this.own.combos(), this.opponent.combos(), this.rng) : null;
      method = river ? 'river-cfr' : 'range-equity';
      action = river ?? this.postflop(s, hole, eq, ownCommitted);
    }
    action = legalize(s, action);
    this.lastDecision = { ms: performance.now() - started, method, equity: eq, action: action.action };
    if (this.options.log) console.log(JSON.stringify({ type: 'decision', hand: s.handNumber, phase: s.phase, ...this.lastDecision, amount: action.amount }));
    return action;
  }

  private preflop(s: GameState, hole: [number, number], committed: number): Action {
    const pct = handPercentile(hole), cls = handClassOf(hole);
    const effective = Math.min(s.yourStack + committed, s.opponentStacks[0] + committed + s.toCall) / this.bb;
    const button = s.yourSeat === s.dealerSeat;
    const raises = Math.max(this.preRaises, s.actionHistory.filter(a => a.action === 'raise' || a.action === 'all_in').length);
    const premium = parseRange('QQ+, AKs, AKo').has(cls);
    if (effective <= 10 && button && raises === 0) {
      return parseRange(nearestPushFold(effective).sbShove).has(cls) ? this.raise(s, committed + s.yourStack) : Action.fold();
    }
    const facingJam = s.opponentStacks[0] === 0 && s.toCall > 0;
    if (facingJam) {
      const baseline = effective <= 10 ? .45 : effective <= 25 ? .18 : .055;
      const fraction = Math.max(baseline, this.preflopHands >= 8 ? Math.min(.95, (this.jamHands + 1) / (this.preflopHands + 15)) : 0);
      const belief = new RangeBelief();
      // A conservative shoving range with some residual mass; no fixed
      // push/fold call chart applied to an arbitrary large raise.
      const combos = belief.combos(hole);
      for (const c of combos) c.weight = handPercentile(c.cards) >= 1 - fraction ? 1 : .025;
      const eq = equity(hole, [], combos, this.rng, this.options.samples ?? 1800, performance.now() + 350);
      const call = Math.min(s.toCall, s.yourStack), contestable = s.pot - Math.max(0, s.toCall - s.yourStack);
      return eq > call / (contestable + call) + .015 ? Action.call() : Action.fold();
    }
    if (raises === 0) {
      if (button) {
        const open = pct >= .20 || (this.foldRate() > .56 && this.observations > 30);
        return open ? this.raise(s, Math.round(this.bb * (effective < 25 ? 2 : 2.25))) : Action.fold();
      }
      if (pct > .62 || (pct > .40 && this.rng() < .18)) return this.raise(s, this.bb * 4);
      return Action.check();
    }
    if (premium || (pct > .91 && raises <= 1) || (raises === 1 && cls.endsWith('s') && cls.startsWith('A') && pct < .78 && this.rng() < .12)) {
      const target = Math.round((committed + s.toCall) * (button ? 3 : 3.6));
      return this.raise(s, effective < 23 || target > (committed + s.yourStack) * .38 ? committed + s.yourStack : target);
    }
    const price = s.toCall / Math.max(1, s.pot + s.toCall);
    const threshold = raises >= 3 ? .96 : raises === 2 ? .80 : clamp(.22 + price * .85 + (!button ? .04 : 0), .28, .83);
    return pct >= threshold ? Action.call() : s.toCall === 0 ? Action.check() : Action.fold();
  }

  private raise(s: GameState, amount: number): Action { return legalize(s, Action.raiseTo(amount)); }

  private postflop(s: GameState, hole: number[], eq: number, committed: number): Action {
    const call = Math.min(s.toCall, s.yourStack), contestable = s.pot - Math.max(0, s.toCall - s.yourStack);
    const price = call / Math.max(1, contestable + call);
    const ip = s.yourSeat === s.dealerSeat, draw = drawStrength(hole, this.board);
    const effective = Math.min(s.yourStack, s.opponentStacks[0] + call);
    const spr = effective / Math.max(s.pot, 1);
    const fold = this.foldRate();
    if (call > 0) {
      const valueThreshold = spr < 1 ? .65 : .77;
      if (eq > valueThreshold && this.rng() < .8) return this.raise(s, committed + call + Math.round((s.pot + call) * (eq > .9 ? .9 : .65)));
      if (draw > .15 && eq > .30 && fold > .52 && spr > 1.5 && this.rng() < .15) return this.raise(s, committed + call + Math.round((s.pot + call) * .8));
      const realization = this.board.length === 5 ? 1 : ip ? .96 : .88;
      return eq * realization >= price + (this.board.length === 5 ? 0 : .015) ? Action.call() : Action.fold();
    }
    const value = eq > (this.board.length === 5 ? .60 : .63);
    const initiative = this.lastAggressor === s.yourSeat;
    const bluffChance = clamp((initiative ? .22 : ip ? .16 : .07) + (fold - .42) * .5 + draw * .5, .02, .36);
    if (value || (eq < .48 && this.rng() < bluffChance)) {
      const fraction = eq > .83 ? .9 : eq > .68 ? .65 : .40;
      const bet = Math.max(this.bb, Math.round(s.pot * fraction));
      return this.raise(s, committed + (spr < 1.2 && eq > .68 ? effective : bet));
    }
    return Action.check();
  }
}

export function legalize(s: GameState, action: Action): Action {
  if (action.action === 'raise') {
    if (s.validActions.includes('raise') && s.maxRaise >= s.minRaise && s.maxRaise > 0) {
      return Action.raiseTo(clamp(Math.round(action.amount!), s.minRaise, s.maxRaise));
    }
    // A requested bet is never silently turned into an unbounded shove.
    if (s.validActions.includes('all_in') && action.amount! >= s.yourStack) return Action.allIn();
  } else if (s.validActions.includes(action.action)) return action;
  if (s.validActions.includes('check')) return Action.check();
  if (s.validActions.includes('fold')) return Action.fold();
  if (s.validActions.includes('call')) return Action.call();
  if (s.validActions.includes('all_in')) return Action.allIn();
  if (s.validActions.includes('raise')) return Action.raiseTo(s.minRaise);
  throw new Error('Server provided no legal actions');
}
