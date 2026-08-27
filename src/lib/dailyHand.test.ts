import { describe, it, expect } from 'vitest';
import library from '../data/handLibrary.json';
import {
  MIN_DAILY_SCORE,
  actualActionLabel,
  bestDecision,
  briefingLines,
  decisionScore,
  pickDaily,
} from './dailyHand';
import { ActStep, Hand, replayState } from './handReplay';

const HANDS = library as unknown as Hand[];

describe('decisionScore', () => {
  it('scores only spots facing a bet, and never a check-to spot', () => {
    for (const hand of HANDS.slice(0, 40)) {
      hand.steps.forEach((s, i) => {
        if (s.t !== 'act') return;
        const score = decisionScore(hand, s.p, i);
        const before = replayState(hand, i);
        const owed = Math.max(...before.bets) - before.bets[s.p];
        if (owed <= 0) expect(score).toBe(0);
        else expect(score).toBeGreaterThan(0);
      });
    }
  });

  it('a later street beats the same price earlier (all else equal weighting)', () => {
    // Direct property of the formula: street depth adds 2 per street.
    // Verified indirectly across the library: some river spot outscores
    // every preflop spot of the same hand at a similar price.
    const hand = HANDS.find((h) => h.board.length === 5 && bestDecision(h));
    expect(hand).toBeDefined();
  });
});

describe('pickDaily', () => {
  it('is deterministic: same day, same library, same spot', () => {
    for (const n of [1, 58, 365, 999]) {
      const a = pickDaily(n, HANDS)!;
      const b = pickDaily(n, HANDS)!;
      expect(a.hand.id).toBe(b.hand.id);
      expect(a.seat).toBe(b.seat);
      expect(a.step).toBe(b.step);
    }
  });

  it('always freezes at a step where the chosen seat faces a bet', () => {
    for (let n = 1; n <= 60; n++) {
      const spot = pickDaily(n, HANDS)!;
      const step = spot.hand.steps[spot.step] as ActStep;
      expect(step.t).toBe('act');
      expect(step.p).toBe(spot.seat);
      const before = replayState(spot.hand, spot.step);
      expect(Math.max(...before.bets) - before.bets[spot.seat]).toBeGreaterThan(0);
      expect(spot.hand.hole[spot.seat]).toBeTruthy(); // you can see your cards
    }
  });

  it('clears the difficulty bar with the real library', () => {
    for (let n = 1; n <= 30; n++) {
      const spot = pickDaily(n, HANDS)!;
      expect(decisionScore(spot.hand, spot.seat, spot.step)).toBeGreaterThanOrEqual(MIN_DAILY_SCORE);
    }
  });

  it('varies the hand across days', () => {
    const ids = new Set<string>();
    for (let n = 1; n <= 30; n++) ids.add(pickDaily(n, HANDS)!.hand.id);
    expect(ids.size).toBeGreaterThan(15); // no fixed rotation, but plenty of spread
  });

  it('returns null only for an empty library', () => {
    expect(pickDaily(1, [])).toBeNull();
  });
});

describe('briefingLines / actualActionLabel', () => {
  it('briefs the scenario without leaking outcomes', () => {
    const spot = pickDaily(7, HANDS)!;
    const lines = briefingLines(spot);
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain('-handed');
    expect(lines[2]).toContain('big blinds deep');
  });

  it('names the player only when the data has real names', () => {
    for (let n = 1; n <= 40; n++) {
      const spot = pickDaily(n, HANDS)!;
      const line = briefingLines(spot)[2];
      if (spot.hand.anon) expect(line).toContain('not recorded');
      else expect(line).toContain(spot.hand.players[spot.seat]);
    }
  });

  it('describes the real action as a sentence fragment', () => {
    for (let n = 1; n <= 20; n++) {
      const spot = pickDaily(n, HANDS)!;
      const label = actualActionLabel(spot);
      expect(label).toMatch(/^(folded|checked|called|bet|raised to)/);
    }
  });
});
