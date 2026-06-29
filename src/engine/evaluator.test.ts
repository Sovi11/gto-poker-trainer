import { describe, it, expect } from 'vitest';
import { parseCard } from './cards';
import { evaluate5, evaluateBest, categoryOf, describeScore, CATEGORY } from './evaluator';

const h = (s: string) => s.trim().split(/\s+/).map(parseCard);
const cat = (s: string) => categoryOf(evaluateBest(h(s)));

describe('evaluate5 — hand categories', () => {
  it('classifies each category correctly', () => {
    expect(cat('Ah Kh Qh Jh Th')).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(cat('As Ah Ad Ac Kd')).toBe(CATEGORY.QUADS);
    expect(cat('As Ah Ad Kc Kd')).toBe(CATEGORY.FULL_HOUSE);
    expect(cat('Ah 9h 7h 4h 2h')).toBe(CATEGORY.FLUSH);
    expect(cat('9c 8d 7h 6s 5c')).toBe(CATEGORY.STRAIGHT);
    expect(cat('As Ah Ad Kc Qd')).toBe(CATEGORY.TRIPS);
    expect(cat('As Ah Kd Kc Qd')).toBe(CATEGORY.TWO_PAIR);
    expect(cat('As Ah Kd Qc Jd')).toBe(CATEGORY.PAIR);
    expect(cat('Ah Kd Qc Js 9d')).toBe(CATEGORY.HIGH_CARD);
  });
});

describe('straights', () => {
  it('recognises the wheel (A-2-3-4-5) as a 5-high straight', () => {
    expect(cat('Ah 2d 3c 4s 5h')).toBe(CATEGORY.STRAIGHT);
    // The wheel is the weakest straight: it must lose to a 6-high straight.
    const wheel = evaluate5(h('Ah 2d 3c 4s 5h'));
    const sixHigh = evaluate5(h('2h 3d 4c 5s 6h'));
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it('recognises Broadway (T-J-Q-K-A)', () => {
    expect(cat('Th Jd Qc Ks Ah')).toBe(CATEGORY.STRAIGHT);
    // Broadway is the best straight, better than a king-high straight.
    expect(evaluate5(h('Th Jd Qc Ks Ah'))).toBeGreaterThan(evaluate5(h('9h Td Jc Qs Kh')));
  });

  it('treats the wheel straight flush as the weakest straight flush', () => {
    const wheelSF = evaluate5(h('Ah 2h 3h 4h 5h'));
    const sixHighSF = evaluate5(h('2h 3h 4h 5h 6h'));
    expect(categoryOf(wheelSF)).toBe(CATEGORY.STRAIGHT_FLUSH);
    expect(sixHighSF).toBeGreaterThan(wheelSF);
  });
});

describe('ordering and kickers', () => {
  it('ranks categories in the right order', () => {
    const sf = evaluate5(h('Ah Kh Qh Jh Th'));
    const quads = evaluate5(h('As Ah Ad Ac Kd'));
    const boat = evaluate5(h('As Ah Ad Kc Kd'));
    const flush = evaluate5(h('Ah 9h 7h 4h 2h'));
    const straight = evaluate5(h('9c 8d 7h 6s 5c'));
    expect(sf).toBeGreaterThan(quads);
    expect(quads).toBeGreaterThan(boat);
    expect(boat).toBeGreaterThan(flush);
    expect(flush).toBeGreaterThan(straight);
  });

  it('breaks pair ties by kicker', () => {
    const aceKingKicker = evaluate5(h('As Ah Kd Qc 2d'));
    const aceQueenKicker = evaluate5(h('As Ah Qd Jc 2d'));
    expect(aceKingKicker).toBeGreaterThan(aceQueenKicker);
  });

  it('compares two pair by top pair, then bottom pair, then kicker', () => {
    const aceTwo = evaluate5(h('As Ah 2d 2c Kd'));
    const kingQueen = evaluate5(h('Ks Kh Qd Qc Ad'));
    expect(aceTwo).toBeGreaterThan(kingQueen); // aces up beats kings up
  });
});

describe('evaluateBest — 7 cards', () => {
  it('finds the best 5 of 7', () => {
    // Two hole cards + 5 board cards making a flush.
    expect(cat('Ah Kh Qh 7h 2h 3c 4d')).toBe(CATEGORY.FLUSH);
  });

  it('plays the board when it is best (ties between players)', () => {
    const board = 'Ah Kh Qh Jh Th'; // royal flush on board
    const a = evaluateBest(h(board + ' 2c 3d'));
    const b = evaluateBest(h(board + ' 5s 6s'));
    expect(a).toBe(b);
  });

  it('matches the equivalent 5-card score when the extra cards are blank', () => {
    const five = evaluate5(h('As Ah Ad Kc Kd'));
    const sevenSameBest = evaluateBest(h('As Ah Ad Kc Kd 2c 3d'));
    expect(sevenSameBest).toBe(five);
  });
});

describe('describeScore', () => {
  it('names the category', () => {
    expect(describeScore(evaluateBest(h('As Ah Ad Ac Kd')))).toBe('Four of a Kind');
    expect(describeScore(evaluateBest(h('Ah 2d 3c 4s 5h')))).toBe('Straight');
  });
});
