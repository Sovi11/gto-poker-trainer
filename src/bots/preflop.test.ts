import { describe, it, expect } from 'vitest';
import { parseCard, fullDeck } from '../engine/cards';
import { chenScore, handPercentile, classPercentile } from './preflopStrength';
import { decide, openFraction, callFraction, DecisionContext } from './decision';
import { BOTS, botById } from './personalities';

const C = (s: string): [number, number] => [parseCard(s.slice(0, 2)), parseCard(s.slice(2, 4))];
const rocky = botById('rocky'); // nit, tightness 0.85
const maniac = botById('maniac'); // tightness 0.20
const station = botById('station'); // station 0.90

describe('chenScore', () => {
  it('orders premium hands above trash', () => {
    const AA = chenScore(12, 12, false);
    const AKs = chenScore(12, 11, true);
    const AKo = chenScore(12, 11, false);
    const _72o = chenScore(5, 0, false);
    expect(AA).toBeGreaterThan(AKs);
    expect(AKs).toBeGreaterThan(AKo);
    expect(AKo).toBeGreaterThan(_72o);
  });

  it('gives well-known anchor scores', () => {
    expect(chenScore(12, 12, false)).toBe(20); // AA
    expect(chenScore(11, 11, false)).toBe(16); // KK
    expect(chenScore(0, 0, false)).toBe(5); // 22 (min-5 rule)
  });
});

describe('handPercentile', () => {
  it('ranks AA near the top and 72o near the bottom', () => {
    expect(handPercentile(C('AhAd'))).toBeGreaterThan(0.95);
    expect(handPercentile(C('7h2d'))).toBeLessThan(0.1);
  });

  it('is monotone with strength', () => {
    expect(classPercentile('AA')).toBeGreaterThan(classPercentile('KK'));
    expect(classPercentile('AKs')).toBeGreaterThan(classPercentile('AKo'));
  });
});

describe('personality-driven range widths', () => {
  it('a nit opens far fewer hands than a maniac', () => {
    expect(openFraction(rocky, 'CO')).toBeLessThan(openFraction(maniac, 'CO'));
    expect(openFraction(rocky, 'CO')).toBeLessThan(0.25);
    expect(openFraction(maniac, 'CO')).toBeGreaterThan(0.4);
  });

  it('opens wider in late position than early for the same bot', () => {
    expect(openFraction(maniac, 'BTN')).toBeGreaterThan(openFraction(maniac, 'UTG'));
  });

  it('a calling station continues much wider than a nit facing a raise', () => {
    expect(callFraction(station)).toBeGreaterThan(callFraction(rocky));
  });

  it('every bot has a sane, bounded opening range', () => {
    for (const bot of BOTS) {
      const f = openFraction(bot, 'CO');
      expect(f).toBeGreaterThan(0.04);
      expect(f).toBeLessThan(0.9);
    }
  });
});

describe('decide — preflop behaviour', () => {
  const open = (hole: [number, number], pos: DecisionContext['position'] = 'CO'): DecisionContext => ({
    hole,
    board: [],
    pot: 15,
    toCall: 10,
    stack: 1000,
    minRaise: 20,
    bigBlind: 10,
    position: pos,
    facingRaise: false,
    canRaise: true,
  });

  it('a nit folds trash and raises aces in an unopened pot', () => {
    expect(decide(open(C('7h2d')), rocky, () => 0).type).toBe('fold');
    expect(decide(open(C('AhAd')), rocky, () => 0).type).toBe('raise');
  });

  it('checks rather than folds trash when it can see a free flop (BB option)', () => {
    const bbOption = { ...open(C('7h2d'), 'BB'), toCall: 0 };
    expect(decide(bbOption, rocky, () => 0).type).toBe('check');
  });

  it('a nit voluntarily plays fewer of all 1326 starting combos than a maniac', () => {
    // Walk every concrete two-card combo through the real decide() path in an
    // unopened CO pot and count how many are not folded (VPIP).
    const deck = fullDeck();
    const vpip = (bot = rocky): number => {
      let played = 0;
      for (let i = 0; i < deck.length; i++) {
        for (let j = i + 1; j < deck.length; j++) {
          const action = decide(open([deck[i], deck[j]]), bot, () => 0.99);
          if (action.type !== 'fold') played++;
        }
      }
      return played / 1326;
    };
    const nit = vpip(rocky);
    const lag = vpip(maniac);
    expect(nit).toBeLessThan(lag);
    expect(nit).toBeLessThan(0.25);
    expect(lag).toBeGreaterThan(0.4);
  });

  it('does not re-raise when the betting is closed (incomplete all-in upstream)', () => {
    const facingRaise: DecisionContext = {
      hole: C('AhAd'),
      board: [],
      pot: 200,
      toCall: 10,
      stack: 1000,
      minRaise: 240,
      bigBlind: 10,
      position: 'BTN',
      facingRaise: true,
      canRaise: false, // betting not reopened to us
    };
    // Aces would normally 3-bet; with canRaise=false the strongest legal play is a call.
    expect(decide(facingRaise, maniac, () => 0).type).toBe('call');
  });
});
