import { describe, it, expect } from 'vitest';
import { HandRecord, computeStats, equityCurve, statsByBot } from './handHistory';

// Newest-first, matching how the log is stored.
function hand(partial: Partial<HandRecord> & { net: number }): HandRecord {
  return {
    id: Math.random().toString(36),
    ts: Date.now(),
    hole: [0, 1],
    board: [],
    bots: ['rocky'],
    bigBlind: 10,
    invested: 0,
    sawShowdown: false,
    won: partial.net > 0,
    log: [],
    starred: false,
    ...partial,
  };
}

describe('computeStats', () => {
  it('sums net chips and counts winning hands', () => {
    const s = computeStats([hand({ net: 50 }), hand({ net: -20 }), hand({ net: 0 })]);
    expect(s.hands).toBe(3);
    expect(s.net).toBe(30);
    expect(s.won).toBe(1); // a net of 0 is not a win
  });

  it('computes bb/100 from the big blind of each hand', () => {
    // +10 and -5 at a 10 big blind = +1bb and -0.5bb over 2 hands = +0.25bb/hand.
    const s = computeStats([hand({ net: 10 }), hand({ net: -5 })]);
    expect(s.bb100).toBeCloseTo(25, 6);
  });

  it('tracks showdowns separately from hands won', () => {
    const s = computeStats([
      hand({ net: 40, sawShowdown: true, won: true }),
      hand({ net: -30, sawShowdown: true, won: false }),
      hand({ net: 15, sawShowdown: false, won: true }), // won without showdown
    ]);
    expect(s.showdowns).toBe(2);
    expect(s.showdownWins).toBe(1);
    expect(s.won).toBe(2);
  });

  it('records the biggest pot and worst loss', () => {
    const s = computeStats([hand({ net: 80 }), hand({ net: -140 }), hand({ net: 20 })]);
    expect(s.biggestPot).toBe(80);
    expect(s.biggestLoss).toBe(-140);
  });

  it('handles an empty history without dividing by zero', () => {
    const s = computeStats([]);
    expect(s.hands).toBe(0);
    expect(s.bb100).toBe(0);
    expect(Number.isFinite(s.bb100)).toBe(true);
  });
});

describe('statsByBot', () => {
  const hands = [
    hand({ net: 30, bots: ['rocky'] }),
    hand({ net: -10, bots: ['maniac'] }),
    hand({ net: 60, bots: ['rocky', 'maniac'] }), // multiway
  ];

  it('attributes a multiway hand to every bot at the table', () => {
    const t = statsByBot(hands);
    expect(t.rocky.hands).toBe(2);
    expect(t.rocky.net).toBe(90);
    expect(t.maniac.hands).toBe(2);
    expect(t.maniac.net).toBe(50);
  });

  it('headsUpOnly excludes multiway hands so the win rate is clean', () => {
    const t = statsByBot(hands, true);
    expect(t.rocky.hands).toBe(1);
    expect(t.rocky.net).toBe(30);
    expect(t.maniac.hands).toBe(1);
    expect(t.maniac.net).toBe(-10);
  });

  it('omits bots that were never played', () => {
    expect(statsByBot(hands).fish).toBeUndefined();
  });
});

describe('equityCurve', () => {
  it('accumulates oldest-first from a newest-first log', () => {
    // Stored newest first: +5 happened last.
    const curve = equityCurve([hand({ net: 5 }), hand({ net: -20 }), hand({ net: 10 })]);
    expect(curve).toEqual([10, -10, -5]);
  });

  it('is empty for no hands', () => {
    expect(equityCurve([])).toEqual([]);
  });
});
