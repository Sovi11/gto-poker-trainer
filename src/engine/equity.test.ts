import { describe, it, expect } from 'vitest';
import { parseCard } from './cards';
import { equityFromStrings, handVsHandEquity, equityVsRandomOnBoard, equityVsRangeOnBoard } from './equity';
import { topRangeCombos } from '../bots/preflopStrength';

const C = (s: string): [number, number] => [parseCard(s.slice(0, 2)), parseCard(s.slice(2, 4))];

describe('handVsHandEquity — known matchups', () => {
  it('AA crushes KK preflop (~82%)', () => {
    const r = equityFromStrings('AhAd', 'KsKc');
    expect(r.equity).toBeGreaterThan(0.79);
    expect(r.equity).toBeLessThan(0.85);
  });

  it('AK vs a random-suit mirror is ~a coin flip', () => {
    const r = handVsHandEquity(C('AhKh'), C('AsKs'));
    expect(r.equity).toBeGreaterThan(0.45);
    expect(r.equity).toBeLessThan(0.55);
  });

  it('a dominated offsuit ace is a big underdog (AK vs AQ ~73%)', () => {
    const r = equityFromStrings('AhKd', 'AsQc');
    expect(r.equity).toBeGreaterThan(0.68);
    expect(r.equity).toBeLessThan(0.78);
  });

  it('uses exact enumeration when the runout is small, and it is deterministic', () => {
    // Four board cards down -> only the river to come (44 cards) -> exact.
    const r1 = handVsHandEquity(C('AhKh'), C('QsQd'), [parseCard('2c'), parseCard('7d'), parseCard('9h'), parseCard('Js')]);
    const r2 = handVsHandEquity(C('AhKh'), C('QsQd'), [parseCard('2c'), parseCard('7d'), parseCard('9h'), parseCard('Js')]);
    expect(r1.exact).toBe(true);
    expect(r1.equity).toBe(r2.equity); // exact enumeration is fully deterministic
  });

  it('settles a completed board to a clean win/tie/lose', () => {
    // Full 5-card board: A flopped a set, B has nothing relevant.
    const r = handVsHandEquity(C('AhAd'), C('KsQc'), [parseCard('Ac'), parseCard('7d'), parseCard('2h'), parseCard('3s'), parseCard('4c')]);
    expect(r.exact).toBe(true);
    expect(r.equity).toBe(1);
  });
});

describe('equityVsRangeOnBoard — range awareness', () => {
  it('a marginal made hand has less equity vs a strong range than vs a random hand', () => {
    // Second pair on a dry-ish board.
    const hole: [number, number] = C('9h9d');
    const board = [parseCard('Ac'), parseCard('7s'), parseCard('2d')];
    const vsRandom = equityVsRandomOnBoard(hole, board, 3000, 11);
    const vsStrong = equityVsRangeOnBoard(hole, board, topRangeCombos(0.15), 3000, 11);
    expect(vsStrong).toBeLessThan(vsRandom);
  });

  it('the nuts is ~100% against any range', () => {
    const hole: [number, number] = C('AcAd');
    const board = [parseCard('As'), parseCard('Ah'), parseCard('2d')]; // quad aces
    const eq = equityVsRangeOnBoard(hole, board, topRangeCombos(0.3), 800, 7);
    expect(eq).toBeGreaterThan(0.99);
  });
});
