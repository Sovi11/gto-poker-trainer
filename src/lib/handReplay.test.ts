import { describe, it, expect } from 'vitest';
import library from '../data/handLibrary.json';
import { Hand, candidateSeats, choicesAt, decisionPoints, matches, replayState } from './handReplay';

const HANDS = library as unknown as Hand[];
const dwan = HANDS.find((h) => h.id.includes('dwan-ivey'))!;

describe('the shipped library', () => {
  it('contains many real hands', () => {
    expect(HANDS.length).toBeGreaterThan(100);
  });

  it('every hand is structurally sound', () => {
    for (const h of HANDS) {
      const n = h.players.length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(h.stacks).toHaveLength(n);
      expect(h.hole).toHaveLength(n);
      expect(h.bb).toBeGreaterThan(0);
      expect(h.steps.length).toBeGreaterThan(0);
      expect(h.source).toMatch(/^https:\/\/github\.com\//); // provenance, always
      expect(h.board.length).toBeLessThanOrEqual(5);
    }
  });

  it('never leaves a player with a negative stack', () => {
    for (const h of HANDS) {
      const end = replayState(h, h.steps.length);
      for (const s of end.stacks) expect(s).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('conserves chips: what is in the pot came out of stacks', () => {
    for (const h of HANDS.slice(0, 60)) {
      const end = replayState(h, h.steps.length);
      const startTotal = h.stacks.reduce((a, b) => a + b, 0);
      const endTotal = end.stacks.reduce((a, b) => a + b, 0) + end.pot;
      expect(Math.abs(startTotal - endTotal)).toBeLessThan(1);
    }
  });
});

describe('replayState', () => {
  it('starts with only blinds and antes committed', () => {
    const s = replayState(dwan, 0);
    expect(s.board).toEqual([]);
    expect(s.street).toBe('preflop');
    expect(s.pot).toBe(dwan.blinds.reduce((a, b) => a + b, 0) + dwan.antes.reduce((a, b) => a + b, 0));
    expect(s.folded.every((f) => !f)).toBe(true);
  });

  it('grows the pot monotonically as the hand plays', () => {
    let prev = -1;
    for (let k = 0; k <= dwan.steps.length; k++) {
      const s = replayState(dwan, k);
      expect(s.pot).toBeGreaterThanOrEqual(prev);
      prev = s.pot;
    }
  });

  it('sweeps chips off the felt when a new street is dealt', () => {
    const boardStep = dwan.steps.findIndex((s) => s.t === 'board');
    const after = replayState(dwan, boardStep + 1);
    expect(after.bets.every((b) => b === 0)).toBe(true);
    expect(after.board.length).toBe(3); // the flop
    expect(after.pot).toBeGreaterThan(0); // but the chips are still counted
  });

  it('is deterministic and identical for repeated calls', () => {
    expect(replayState(dwan, 7)).toEqual(replayState(dwan, 7));
  });

  it('reaches the recorded final pot, with the uncalled bet handed back', () => {
    const end = replayState(dwan, dwan.steps.length);
    expect(end.effectivePot).toBe(dwan.pot);
    // Ivey shipped more than Dwan could cover, so the raw total is larger.
    expect(end.pot).toBeGreaterThan(end.effectivePot);
  });

  it('returns an uncalled bet in every hand that has one', () => {
    for (const h of HANDS.slice(0, 60)) {
      const end = replayState(h, h.steps.length);
      expect(end.effectivePot).toBe(h.pot);
      expect(end.effectivePot).toBeLessThanOrEqual(end.pot);
    }
  });
});

describe('decisions', () => {
  it('finds every point where a seat has to act', () => {
    const seat = candidateSeats(dwan)[0];
    const points = decisionPoints(dwan, seat);
    expect(points.length).toBeGreaterThan(0);
    for (const i of points) {
      const step = dwan.steps[i];
      expect(step.t).toBe('act');
      if (step.t === 'act') expect(step.p).toBe(seat);
    }
  });

  it('offers fold/call/raise when facing a bet, check/bet when not', () => {
    for (const h of HANDS.slice(0, 40)) {
      for (const seat of candidateSeats(h)) {
        for (const i of decisionPoints(h, seat)) {
          const choices = choicesAt(h, i);
          expect(choices.length).toBeGreaterThanOrEqual(2);
          const kinds = choices.map((c) => c.a);
          if (kinds.includes('fold')) {
            expect(kinds).toContain('call'); // facing a bet
          } else {
            expect(kinds).toContain('check'); // nothing owed
          }
        }
      }
    }
  });

  it('treats bet and raise as the same intent when grading', () => {
    expect(matches('bet', 'raise')).toBe(true);
    expect(matches('raise', 'bet')).toBe(true);
    expect(matches('call', 'fold')).toBe(false);
    expect(matches('check', 'check')).toBe(true);
  });
});

describe('candidateSeats', () => {
  it('offers exactly two seats, and only ones whose cards we know', () => {
    for (const h of HANDS.slice(0, 60)) {
      const seats = candidateSeats(h);
      expect(seats).toHaveLength(2);
      expect(new Set(seats).size).toBe(2);
      for (const s of seats) {
        expect(h.hole[s]).toBeTruthy(); // you must be able to see your own hand
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(h.players.length);
      }
    }
  });
});
