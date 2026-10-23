import { Action, Bot, GameState } from '@chipzen-ai/bot';
import { parseCard } from '../engine/cards';
import { handClassOf, handPercentile } from '../bots/preflopStrength';
import { parseRange } from '../engine/range';
import { nearestPushFold } from '../gto/pushfold';
import { drawStrength, RangeBelief } from './ranges';
import { equity } from './equity';
import { solveRiver, unbeatableRiver } from './river';
import { preflopRangeEquity, shortStackPolicy, trainedHandPercentile } from './preflop-model';
import equityNetworkData from './models/equity-network.json';
import type { EquityNetwork } from './equity-model';
import { solveContinuation } from './search';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
type Raw = Record<string, unknown>;
export const STRATEGY_VARIANTS = ['baseline', 'short', 'hybrid', 'preflop', 'full', 'search'] as const;
export type StrategyVariant = typeof STRATEGY_VARIANTS[number];
export const PRODUCTION_VARIANT: StrategyVariant = 'hybrid';
export function isStrategyVariant(value: string): value is StrategyVariant { return (STRATEGY_VARIANTS as readonly string[]).includes(value); }
export interface BotOptions { rng?: () => number; samples?: number; river?: boolean; log?: boolean; variant?: StrategyVariant; contextualRanges?: boolean; riverSafety?: boolean }

export class ArenaBot extends Bot {
  own = new RangeBelief(); opponent = new RangeBelief();
  private seat = 0;
  private matchId = '';
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
  private trainedHand = false;
  private rng: () => number;
  private options: BotOptions;
  lastDecision: { ms: number; method: string; equity?: number; action: string; pot: number; call: number; callPrice: number; callEV?: number } | null = null;

  constructor(options: BotOptions = {}) {
    super();
    const variant = options.variant ?? PRODUCTION_VARIANT;
    if (!isStrategyVariant(variant)) throw new Error('Unknown strategy variant');
    this.options = { ...options, variant, riverSafety: options.riverSafety ?? true }; this.rng = options.rng ?? Math.random;
  }

  override onMatchStart(info: Raw): void {
    this.matchId = String(info.match_id ?? '');
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
    if (this.options.variant === 'hybrid' && stacks && Math.min(...stacks) / this.bb <= 30) {
      this.own = new RangeBelief(true, undefined, this.options.contextualRanges); this.opponent = new RangeBelief(true, undefined, this.options.contextualRanges); this.trainedHand = true;
    }
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
    const trained = this.options.variant !== undefined && !['baseline', 'short', 'hybrid'].includes(this.options.variant);
    const network = this.options.variant === 'full' || this.options.variant === 'search' ? equityNetworkData as EquityNetwork : undefined;
    this.hand = n; this.own = new RangeBelief(trained, network, this.options.contextualRanges); this.opponent = new RangeBelief(trained, network, this.options.contextualRanges);
    this.trainedHand = trained;
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
      (seat === this.seat ? this.own : this.opponent).observe(action, amount / Math.max(this.pot, this.bb), this.aggression(),
        { preflopRaises: this.preRaises, button: seat === this.dealer });
    }
    if (action === 'raise' || action === 'all_in') {
      this.committed[seat] = amount; this.lastAggressor = seat;
      if (!this.board.length) this.preRaises++;
    } else if (action === 'call' || action.startsWith('post_')) this.committed[seat] += amount;
    this.pot = Number(d.pot ?? this.pot + this.committed[seat] - old);
  }

  private aggression(): number { return (this.aggressions + 9) / (this.decisions + 20); }
  private foldRate(): number { return (this.folds + 10) / (this.facing + 24); }

  override onMatchEnd(results: Raw): void {
    const rows: Raw[] = Array.isArray(results) ? results : Array.isArray(results.results) ? results.results : [];
    const own = rows.find(row => row.seat === this.seat);
    if (this.options.log) console.log(JSON.stringify({ type: 'match_end', match: this.matchId, seat: this.seat,
      finalStack: own?.final_stack, netChips: own?.net_chips,
      errorCount: Array.isArray(own?.bot_errors) ? own.bot_errors.length : undefined }));
  }

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
    if (!board.length) {
      const effective = Math.min(s.yourStack + ownCommitted, s.opponentStacks[0] + ownCommitted + s.toCall) / this.bb;
      if (this.options.variant === 'hybrid' && effective <= 30 && !this.trainedHand) {
        const own = new RangeBelief(true, undefined, this.options.contextualRanges), opponent = new RangeBelief(true, undefined, this.options.contextualRanges);
        own.weights.set(this.own.weights); opponent.weights.set(this.opponent.weights);
        this.own = own; this.opponent = opponent; this.trainedHand = true;
      }
      const shortNode = effective <= 12 && ((s.yourSeat === s.dealerSeat && this.preRaises === 0) || (s.opponentStacks[0] === 0 && s.toCall > 0));
      const trained = this.options.variant && this.options.variant !== 'baseline' && (this.options.variant !== 'short' || shortNode)
        && (this.options.variant !== 'hybrid' || effective <= 30);
      action = trained ? this.trainedPreflop(s, hole as [number, number], ownCommitted) : this.preflop(s, hole as [number, number], ownCommitted);
    }
    else {
      const range = this.opponent.combos(hole);
      eq = equity(hole, board, range, this.rng, this.options.samples ?? 1800, started + 400);
      const river = board.length === 5 && this.options.river !== false
        ? solveRiver(s, ownCommitted, hole, this.own.combos(), this.opponent.combos(), this.rng) : null;
      const continuation = this.options.variant === 'search' && !river
        ? solveContinuation(s, ownCommitted, hole, this.own.combos(), this.opponent.combos(), this.rng, started + 650) : null;
      method = river ? 'river-cfr' : continuation ? 'continuation-cfr' : 'range-equity';
      action = river ?? continuation ?? this.postflop(s, hole, eq, ownCommitted);
    }
    if (this.options.riverSafety && action.action === 'fold' && board.length === 5 && s.toCall > 0
      && s.validActions.includes('call') && unbeatableRiver(hole, board)) {
      action = Action.call(); method = 'river-safety';
    }
    action = legalize(s, action);
    const call = Math.min(s.toCall, s.yourStack), contestable = s.pot - Math.max(0, s.toCall - s.yourStack);
    this.lastDecision = { ms: performance.now() - started, method, equity: eq, action: action.action,
      pot: s.pot, call, callPrice: call / Math.max(1, contestable + call),
      callEV: eq === undefined ? undefined : eq * (contestable + call) - call };
    if (this.options.log) console.log(JSON.stringify({ type: 'decision', variant: this.options.variant, match: this.matchId, hand: s.handNumber, phase: s.phase, ...this.lastDecision, amount: action.amount }));
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

  private trainedPreflop(s: GameState, hole: [number, number], committed: number): Action {
    const pct = trainedHandPercentile(hole), cls = handClassOf(hole);
    const effective = Math.min(s.yourStack + committed, s.opponentStacks[0] + committed + s.toCall) / this.bb;
    const button = s.yourSeat === s.dealerSeat;
    const raises = Math.max(this.preRaises, s.actionHistory.filter(a => a.action === 'raise' || a.action === 'all_in').length);
    if (effective <= 12 && button && raises === 0) return this.rng() < shortStackPolicy(effective, hole).jam
      ? this.raise(s, committed + s.yourStack) : Action.fold();
    if (s.opponentStacks[0] === 0 && s.toCall > 0) {
      const range = new RangeBelief(true).combos(hole);
      const observedFraction = this.preflopHands >= 8 ? Math.min(.95, (this.jamHands + 1) / (this.preflopHands + 15)) : 0;
      for (const c of range) {
        const p = trainedHandPercentile(c.cards);
        if (effective <= 12 && raises <= 1 && !button) {
          c.weight = .005 + shortStackPolicy(effective, c.cards).jam;
          if (observedFraction > .75) c.weight = Math.max(c.weight, p >= 1 - observedFraction ? 1 : .03);
        } else {
          const fraction = Math.max(effective <= 25 ? .18 : .055, observedFraction);
          c.weight = p >= 1 - fraction ? 1 : .025;
        }
      }
      let e = preflopRangeEquity(hole, range);
      const call = Math.min(s.toCall, s.yourStack), pot = s.pot - Math.max(0, s.toCall - s.yourStack);
      const price = call / Math.max(1, pot + call);
      // Suit arrangements within a hand class matter close to the boundary.
      if (Math.abs(e - price) < .025) e = equity(hole, [], range, this.rng, Math.max(2400, this.options.samples ?? 1800), performance.now() + 350);
      return e >= price + .005 ? Action.call() : Action.fold();
    }
    if (raises === 0) {
      if (button) return pct >= (this.foldRate() > .56 && this.observations > 30 ? .08 : .20)
        ? this.raise(s, Math.round(this.bb * (effective < 25 ? 2 : 2.25))) : Action.fold();
      return pct > .66 || (pct > .40 && cls.endsWith('s') && this.rng() < .22) ? this.raise(s, this.bb * 4) : Action.check();
    }
    const premium = parseRange('QQ+, AKs, AKo').has(cls);
    if (premium || (pct > .925 && raises <= 1) || (raises === 1 && cls.endsWith('s') && cls.startsWith('A') && pct < .85 && this.rng() < .10)) {
      const target = Math.round((committed + s.toCall) * (button ? 3 : 3.6));
      return this.raise(s, effective < 23 || target > (committed + s.yourStack) * .38 ? committed + s.yourStack : target);
    }
    if (s.toCall === 0) return Action.check();
    const price = Math.min(s.toCall, s.yourStack) / Math.max(1, s.pot + Math.min(s.toCall, s.yourStack));
    const e = preflopRangeEquity(hole, this.opponent.combos(hole));
    const realization = raises >= 3 ? .76 : raises === 2 ? .82 : button ? .94 : .86;
    const minimum = raises >= 3 ? .92 : raises === 2 ? .72 : .16;
    return pct >= minimum && e * realization > price + .015 ? Action.call() : Action.fold();
  }

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
  if (action.action === 'fold' && s.validActions.includes('check')) return Action.check();
  if (action.action === 'raise') {
    if (s.validActions.includes('raise') && s.maxRaise >= s.minRaise && s.maxRaise > 0) {
      return Action.raiseTo(clamp(Math.round(action.amount!), s.minRaise, s.maxRaise));
    }
    // A requested bet is never silently turned into an unbounded shove.
    if (s.validActions.includes('all_in') && action.amount! >= s.yourStack) return Action.allIn();
    // Value-raise intent must not become a fold when a short all-in closes
    // raising rights. Call only when its cost fits the requested wager.
    if (s.validActions.includes('call') && action.amount! >= Math.min(s.toCall, s.yourStack)) return Action.call();
  } else if (s.validActions.includes(action.action)) return action;
  if (s.validActions.includes('check')) return Action.check();
  if (s.validActions.includes('fold')) return Action.fold();
  if (s.validActions.includes('call')) return Action.call();
  if (s.validActions.includes('all_in')) return Action.allIn();
  if (s.validActions.includes('raise')) return Action.raiseTo(s.minRaise);
  throw new Error('Server provided no legal actions');
}
