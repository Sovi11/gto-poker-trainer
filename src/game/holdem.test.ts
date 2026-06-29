import { describe, it, expect } from 'vitest';
import { HoldemHand, HandConfig } from './holdem';
import { BOTS } from '../bots/personalities';

function playOut(hand: HoldemHand): void {
  let guard = 0;
  while (!hand.finished && guard++ < 2000) {
    const acted = hand.stepBot();
    if (!acted) break; // human turn or hand over
  }
}

const totalChips = (hand: HoldemHand) => hand.players.reduce((s, p) => s + p.stack, 0) + hand.pot;

describe('full-hand integrity', () => {
  it('conserves chips across a fully auto-played hand', () => {
    const stacks = [1000, 1000, 1000];
    const cfg: HandConfig = {
      players: [
        { id: 'a', name: 'A', isHuman: false, bot: BOTS[0], stack: stacks[0] },
        { id: 'b', name: 'B', isHuman: false, bot: BOTS[1], stack: stacks[1] },
        { id: 'c', name: 'C', isHuman: false, bot: BOTS[2], stack: stacks[2] },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: 0,
      seed: 12345,
    };
    const hand = new HoldemHand(cfg);
    const start = totalChips(hand);
    playOut(hand);
    expect(hand.finished).toBe(true);
    expect(hand.pot).toBe(0);
    expect(hand.players.every((p) => p.stack >= 0)).toBe(true);
    expect(hand.players.reduce((s, p) => s + p.stack, 0)).toBe(start);
  });

  it('conserves chips with uneven stacks (side pots) over many seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const cfg: HandConfig = {
        players: [
          { id: 'a', name: 'A', isHuman: false, bot: BOTS[1], stack: 350 },
          { id: 'b', name: 'B', isHuman: false, bot: BOTS[3], stack: 120 },
          { id: 'c', name: 'C', isHuman: false, bot: BOTS[4], stack: 1000 },
          { id: 'd', name: 'D', isHuman: false, bot: BOTS[5], stack: 60 },
        ],
        smallBlind: 5,
        bigBlind: 10,
        buttonIndex: seed % 4,
        seed,
      };
      const hand = new HoldemHand(cfg);
      const start = totalChips(hand);
      playOut(hand);
      expect(hand.finished).toBe(true);
      expect(hand.players.reduce((s, p) => s + p.stack, 0)).toBe(start);
      expect(hand.winners.length).toBeGreaterThan(0);
    }
  });
});

describe('incomplete all-in does not reopen the betting', () => {
  // 3-handed, button=0 -> SB=1, BB=2. A short BB shoves all-in for less than a
  // full raise after a raise and a call; the original raiser must NOT be able
  // to re-raise.
  function setup() {
    const cfg: HandConfig = {
      players: [
        { id: 'p0', name: 'P0', isHuman: true, stack: 1000 },
        { id: 'p1', name: 'P1', isHuman: true, stack: 1000 },
        { id: 'p2', name: 'P2', isHuman: true, stack: 40 }, // BB, short
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: 0,
      seed: 1,
    };
    return new HoldemHand(cfg);
  }

  it('closes raising rights for players who already acted', () => {
    const hand = setup();
    expect(hand.toActIndex).toBe(0); // button acts first preflop, 3-handed

    hand.act('raise', 30); // P0 opens to 30 (full raise; minRaise becomes 20)
    expect(hand.currentBet).toBe(30);
    expect(hand.minRaise).toBe(20);

    hand.act('call'); // P1 calls 30
    expect(hand.toActIndex).toBe(2);

    hand.act('raise', 40); // P2 jams all-in to 40: increment 10 < min raise 20
    expect(hand.players[2].allIn).toBe(true);
    expect(hand.currentBet).toBe(40);
    expect(hand.minRaise).toBe(20); // unchanged — the short jam is not a full raise

    // Action returns to P0, who faces only the extra 10. The betting is NOT
    // reopened: P0 may call or fold but may not re-raise.
    expect(hand.toActIndex).toBe(0);
    expect(hand.players[0].mayRaise).toBe(false);
    expect(hand.legalActions().canRaise).toBe(false);
    expect(hand.legalActions().canCall).toBe(true);
  });

  it('a full-sized all-in raise does reopen the betting', () => {
    const cfg: HandConfig = {
      players: [
        { id: 'p0', name: 'P0', isHuman: true, stack: 1000 },
        { id: 'p1', name: 'P1', isHuman: true, stack: 1000 },
        { id: 'p2', name: 'P2', isHuman: true, stack: 1000 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonIndex: 0,
      seed: 1,
    };
    const hand = new HoldemHand(cfg);
    hand.act('raise', 30); // P0 to 30
    hand.act('call'); // P1 calls
    hand.act('raise', 90); // P2 to 90: increment 60 >= min raise -> full raise
    expect(hand.toActIndex).toBe(0);
    expect(hand.players[0].mayRaise).toBe(true);
    expect(hand.legalActions().canRaise).toBe(true);
  });
});
