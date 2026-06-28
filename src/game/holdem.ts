import { Card, fullDeck, shuffle, mulberry32 } from '../engine/cards';
import { evaluateBest } from '../engine/evaluator';
import { Action, DecisionContext, decide } from '../bots/decision';
import { BotProfile } from '../bots/personalities';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  bot?: BotProfile;
  stack: number;
  hole: [Card, Card] | null;
  committed: number; // chips put into the pot this street
  totalCommitted: number; // chips put into the pot this hand
  folded: boolean;
  allIn: boolean;
  hasActed: boolean; // acted since last raise this street
}

export interface HandConfig {
  players: { id: string; name: string; isHuman: boolean; bot?: BotProfile; stack: number }[];
  smallBlind: number;
  bigBlind: number;
  buttonIndex: number;
  seed?: number;
}

export interface LogEntry {
  text: string;
  kind: 'action' | 'street' | 'result' | 'info';
}

export class HoldemHand {
  players: Player[];
  deck: Card[];
  board: Card[] = [];
  street: Street = 'preflop';
  pot = 0;
  smallBlind: number;
  bigBlind: number;
  buttonIndex: number;
  currentBet = 0; // highest committed this street
  minRaise: number; // minimum legal raise increment
  toActIndex = -1;
  lastAggressor = -1;
  log: LogEntry[] = [];
  finished = false;
  winners: number[] = [];
  private rng: () => number;

  constructor(cfg: HandConfig) {
    this.smallBlind = cfg.smallBlind;
    this.bigBlind = cfg.bigBlind;
    this.minRaise = cfg.bigBlind;
    this.buttonIndex = cfg.buttonIndex;
    this.rng = mulberry32((cfg.seed ?? Date.now()) >>> 0);
    this.deck = shuffle(fullDeck(), this.rng);

    this.players = cfg.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: p.isHuman,
      bot: p.bot,
      stack: p.stack,
      hole: null,
      committed: 0,
      totalCommitted: 0,
      folded: false,
      allIn: false,
      hasActed: false,
    }));

    this.deal();
    this.postBlinds();
  }

  private deal(): void {
    let d = 0;
    for (const p of this.players) {
      p.hole = [this.deck[d++], this.deck[d++]];
    }
    this.deckIndex = d;
  }

  private deckIndex = 0;

  private n(): number {
    return this.players.length;
  }

  private nextActive(from: number): number {
    const n = this.n();
    for (let i = 1; i <= n; i++) {
      const idx = (from + i) % n;
      const p = this.players[idx];
      if (!p.folded && !p.allIn) return idx;
    }
    return -1;
  }

  private postBlinds(): void {
    const n = this.n();
    const sbIdx = n === 2 ? this.buttonIndex : (this.buttonIndex + 1) % n;
    const bbIdx = n === 2 ? (this.buttonIndex + 1) % n : (this.buttonIndex + 2) % n;
    this.postBlind(sbIdx, this.smallBlind, 'small blind');
    this.postBlind(bbIdx, this.bigBlind, 'big blind');
    this.currentBet = this.bigBlind;
    this.minRaise = this.bigBlind;
    this.lastAggressor = bbIdx;
    // First to act preflop is left of BB (UTG); heads-up it's the button/SB.
    this.toActIndex = this.nextActive(bbIdx);
    this.log.push({ text: `Blinds posted (${this.smallBlind}/${this.bigBlind}).`, kind: 'info' });
  }

  private postBlind(idx: number, amount: number, label: string): void {
    const p = this.players[idx];
    const post = Math.min(amount, p.stack);
    p.stack -= post;
    p.committed += post;
    p.totalCommitted += post;
    this.pot += post;
    if (p.stack === 0) p.allIn = true;
    this.log.push({ text: `${p.name} posts ${label} ${post}.`, kind: 'action' });
  }

  get currentPlayer(): Player | null {
    if (this.toActIndex < 0) return null;
    return this.players[this.toActIndex];
  }

  // Legal actions for the player to act.
  legalActions(): { canFold: boolean; canCheck: boolean; canCall: boolean; callAmount: number; canRaise: boolean; minRaiseTo: number; maxRaiseTo: number } {
    const p = this.players[this.toActIndex];
    const toCall = this.currentBet - p.committed;
    const canCheck = toCall <= 0;
    const canCall = toCall > 0 && p.stack > 0;
    const minRaiseTo = this.currentBet + this.minRaise;
    const maxRaiseTo = p.committed + p.stack; // all-in
    const canRaise = p.stack > toCall;
    return {
      canFold: toCall > 0,
      canCheck,
      canCall,
      callAmount: Math.min(toCall, p.stack),
      canRaise,
      minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
      maxRaiseTo,
    };
  }

  // Apply an action for the current player. `raiseTo` is the total committed
  // amount this street for a raise (e.g. raise to 30).
  act(kind: 'fold' | 'check' | 'call' | 'raise', raiseTo?: number): void {
    if (this.finished) return;
    const idx = this.toActIndex;
    const p = this.players[idx];
    const toCall = this.currentBet - p.committed;

    if (kind === 'fold') {
      p.folded = true;
      this.log.push({ text: `${p.name} folds.`, kind: 'action' });
    } else if (kind === 'check') {
      this.log.push({ text: `${p.name} checks.`, kind: 'action' });
    } else if (kind === 'call') {
      const amt = Math.min(toCall, p.stack);
      this.commit(p, amt);
      this.log.push({ text: `${p.name} calls ${amt}.`, kind: 'action' });
    } else if (kind === 'raise') {
      const target = Math.max(raiseTo ?? this.currentBet + this.minRaise, this.currentBet + this.minRaise);
      const capped = Math.min(target, p.committed + p.stack);
      const raiseIncrement = capped - this.currentBet;
      const add = capped - p.committed;
      this.commit(p, add);
      if (raiseIncrement >= this.minRaise) this.minRaise = raiseIncrement;
      this.currentBet = Math.max(this.currentBet, p.committed);
      this.lastAggressor = idx;
      // everyone else must act again
      for (const q of this.players) if (q !== p && !q.folded && !q.allIn) q.hasActed = false;
      const verb = toCall <= 0 ? 'bets' : 'raises to';
      this.log.push({ text: `${p.name} ${verb} ${capped}.`, kind: 'action' });
    }

    p.hasActed = true;
    this.advance();
  }

  private commit(p: Player, amount: number): void {
    const a = Math.min(amount, p.stack);
    p.stack -= a;
    p.committed += a;
    p.totalCommitted += a;
    this.pot += a;
    if (p.stack === 0) p.allIn = true;
  }

  private activeNotAllIn(): Player[] {
    return this.players.filter((p) => !p.folded && !p.allIn);
  }

  private inHand(): Player[] {
    return this.players.filter((p) => !p.folded);
  }

  private streetClosed(): boolean {
    const contenders = this.players.filter((p) => !p.folded && !p.allIn);
    if (contenders.length === 0) return true;
    for (const p of contenders) {
      if (!p.hasActed) return false;
      if (p.committed !== this.currentBet) return false;
    }
    return true;
  }

  private advance(): void {
    // Only one player left -> award pot.
    if (this.inHand().length === 1) {
      this.finishHand();
      return;
    }

    if (this.streetClosed()) {
      this.nextStreet();
      return;
    }

    // find next to act
    let idx = this.nextActive(this.toActIndex);
    // skip players who've already matched and acted (shouldn't happen if streetClosed false)
    this.toActIndex = idx;
    if (this.toActIndex === -1) {
      this.nextStreet();
    }
  }

  private nextStreet(): void {
    // reset street state
    for (const p of this.players) {
      p.committed = 0;
      p.hasActed = false;
    }
    this.currentBet = 0;
    this.minRaise = this.bigBlind;

    // If <=1 players can still act, run out the board to showdown.
    const canAct = this.activeNotAllIn().length;

    if (this.street === 'preflop') {
      this.street = 'flop';
      this.board.push(this.deck[this.deckIndex++], this.deck[this.deckIndex++], this.deck[this.deckIndex++]);
      this.log.push({ text: `--- FLOP --- ${this.boardStr()}`, kind: 'street' });
    } else if (this.street === 'flop') {
      this.street = 'turn';
      this.board.push(this.deck[this.deckIndex++]);
      this.log.push({ text: `--- TURN --- ${this.boardStr()}`, kind: 'street' });
    } else if (this.street === 'turn') {
      this.street = 'river';
      this.board.push(this.deck[this.deckIndex++]);
      this.log.push({ text: `--- RIVER --- ${this.boardStr()}`, kind: 'street' });
    } else if (this.street === 'river') {
      this.finishHand();
      return;
    }

    if (canAct <= 1) {
      // No more betting possible; deal remaining streets then showdown.
      if (this.street !== 'river') {
        this.nextStreet();
        return;
      }
      this.finishHand();
      return;
    }

    // action starts left of button (or BB heads-up)
    this.toActIndex = this.nextActive(this.buttonIndex);
  }

  private boardStr(): string {
    return this.board.map((c) => cardLabel(c)).join(' ');
  }

  private finishHand(): void {
    this.street = 'showdown';
    const contenders = this.inHand();

    if (contenders.length === 1) {
      const w = contenders[0];
      w.stack += this.pot;
      this.winners = [this.players.indexOf(w)];
      this.log.push({ text: `${w.name} wins ${this.pot} (everyone folded).`, kind: 'result' });
      this.pot = 0;
      this.finished = true;
      this.toActIndex = -1;
      return;
    }

    // Showdown: build side pots and award.
    this.awardPots(contenders);
    this.finished = true;
    this.toActIndex = -1;
  }

  private awardPots(contenders: Player[]): void {
    // Evaluate each contender.
    const scores = new Map<Player, number>();
    for (const p of contenders) {
      const cards = [p.hole![0], p.hole![1], ...this.board];
      scores.set(p, evaluateBest(cards));
    }

    // Build side pots from totalCommitted across ALL players (folded chips count).
    const all = this.players.slice();
    const levels = Array.from(new Set(all.map((p) => p.totalCommitted).filter((x) => x > 0))).sort((a, b) => a - b);

    let prev = 0;
    const awardedWinners = new Set<number>();
    for (const level of levels) {
      let potPart = 0;
      for (const p of all) {
        const contrib = Math.min(p.totalCommitted, level) - Math.min(p.totalCommitted, prev);
        potPart += contrib;
      }
      // eligible = contenders who committed at least this level
      const eligible = contenders.filter((p) => p.totalCommitted >= level);
      if (eligible.length && potPart > 0) {
        let best = -1;
        for (const p of eligible) best = Math.max(best, scores.get(p)!);
        const winners = eligible.filter((p) => scores.get(p) === best);
        const share = Math.floor(potPart / winners.length);
        let remainder = potPart - share * winners.length;
        for (const w of winners) {
          let amt = share;
          if (remainder > 0) {
            amt += 1;
            remainder--;
          }
          w.stack += amt;
          awardedWinners.add(this.players.indexOf(w));
        }
        const names = winners.map((w) => w.name).join(', ');
        this.log.push({ text: `${names} win ${potPart} at showdown.`, kind: 'result' });
      }
      prev = level;
    }
    this.winners = Array.from(awardedWinners);
    this.pot = 0;
  }

  // Drive the current bot to act. Returns the action taken, or null if it's a
  // human's turn or the hand is over.
  stepBot(): Action | null {
    if (this.finished || this.toActIndex < 0) return null;
    const p = this.players[this.toActIndex];
    if (p.isHuman || !p.bot) return null;

    const toCall = this.currentBet - p.committed;
    const ctx: DecisionContext = {
      hole: p.hole!,
      board: this.board,
      pot: this.pot,
      toCall,
      stack: p.stack,
      minRaise: this.currentBet + this.minRaise,
      bigBlind: this.bigBlind,
    };
    const action = decide(ctx, p.bot, this.rng);

    if (action.type === 'fold') this.act('fold');
    else if (action.type === 'check') this.act('check');
    else if (action.type === 'call') this.act('call');
    else if (action.type === 'bet' || action.type === 'raise') {
      // action.amount is the total committed-this-street target (bet size when
      // unopened, or raise-to amount when facing a bet).
      this.act('raise', action.amount);
    }
    return action;
  }

  isHumanTurn(): boolean {
    return !this.finished && this.toActIndex >= 0 && this.players[this.toActIndex].isHuman;
  }
}

function cardLabel(c: Card): string {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const suits = ['♣', '♦', '♥', '♠'];
  return ranks[c % 13] + suits[Math.floor(c / 13)];
}
