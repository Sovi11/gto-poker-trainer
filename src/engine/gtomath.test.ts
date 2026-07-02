import { describe, it, expect } from 'vitest';
import {
  requiredEquity,
  minDefenseFrequency,
  alpha,
  balancedBluffFraction,
  valueToBluffRatio,
  spr,
  ruleOfNEquity,
} from './gtomath';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('pot-sized bet anchors', () => {
  it('a pot-sized bet gives the textbook numbers', () => {
    const pot = 100;
    const bet = 100;
    expect(near(minDefenseFrequency(pot, bet), 0.5)).toBe(true); // defend 50%
    expect(near(alpha(pot, bet), 0.5)).toBe(true); // bluff must work 50%
    expect(near(requiredEquity(pot, bet), 1 / 3)).toBe(true); // need 33%
    expect(near(balancedBluffFraction(pot, bet), 1 / 3)).toBe(true); // 1/3 bluffs
    expect(near(valueToBluffRatio(pot, bet), 2)).toBe(true); // 2:1 value:bluff
  });
});

describe('half-pot bet anchors', () => {
  it('a half-pot bet gives MDF 2/3 and 3:1 value:bluff', () => {
    const pot = 100;
    const bet = 50;
    expect(near(minDefenseFrequency(pot, bet), 2 / 3)).toBe(true);
    expect(near(alpha(pot, bet), 1 / 3)).toBe(true);
    expect(near(requiredEquity(pot, bet), 0.25)).toBe(true);
    expect(near(valueToBluffRatio(pot, bet), 3)).toBe(true);
  });
});

describe('identities', () => {
  it('MDF and alpha are complements for any size', () => {
    for (const [pot, bet] of [[100, 33], [80, 60], [120, 120], [50, 200]]) {
      expect(near(minDefenseFrequency(pot, bet) + alpha(pot, bet), 1)).toBe(true);
    }
  });

  it("the bettor's bluff fraction equals the caller's required equity", () => {
    for (const [pot, bet] of [[100, 66], [40, 20], [150, 300]]) {
      expect(near(balancedBluffFraction(pot, bet), requiredEquity(pot, bet))).toBe(true);
    }
  });
});

describe('spr and rule of 2 & 4', () => {
  it('computes SPR', () => {
    expect(spr(400, 100)).toBe(4);
  });
  it('applies the rule of 2 & 4 with a cap', () => {
    expect(ruleOfNEquity(9, 2)).toBe(36); // flush draw on the flop
    expect(ruleOfNEquity(9, 1)).toBe(18); // on the turn
    expect(ruleOfNEquity(15, 2)).toBe(60); // 15 × 4
    expect(ruleOfNEquity(20, 2)).toBe(80); // 20 × 4, below the cap
    expect(ruleOfNEquity(25, 2)).toBe(95); // 25 × 4 = 100, capped at 95
  });
});
