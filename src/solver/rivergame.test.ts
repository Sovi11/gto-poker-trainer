import { describe, it, expect } from 'vitest';
import { solveRiverGame, closedForm, bettorEVFor, bestBettorEV, bestDefenderEV } from './rivergame';

const near = (x: number, y: number, eps = 0.01) => Math.abs(x - y) <= eps;

describe('CFR converges to the known closed-form equilibrium', () => {
  const cases = [
    { pot: 100, bet: 100, valueFrac: 0.5 }, // pot-sized bet
    { pot: 100, bet: 50, valueFrac: 0.5 }, // half pot
    { pot: 100, bet: 200, valueFrac: 0.5 }, // overbet
    { pot: 60, bet: 45, valueFrac: 0.4 }, // asymmetric priors
  ];

  for (const params of cases) {
    it(`pot=${params.pot} bet=${params.bet} v=${params.valueFrac}`, () => {
      const sol = solveRiverGame(params);
      const cf = closedForm(params);
      expect(near(sol.callFreq, cf.callFreq)).toBe(true);
      expect(near(sol.bluffFreq, cf.bluffFreq)).toBe(true);
      expect(sol.betNuts).toBeGreaterThan(0.98); // always value-bet the nuts
      expect(sol.exploitability).toBeLessThan(0.005); // < 0.5% of the pot
    });
  }
});

describe('equilibrium sanity (pot bet, 50/50 range)', () => {
  const params = { pot: 100, bet: 100, valueFrac: 0.5 };

  it('matches the textbook numbers', () => {
    const sol = solveRiverGame(params);
    expect(near(sol.callFreq, 0.5)).toBe(true); // MDF = 50%
    expect(near(sol.bluffFreq, 0.5)).toBe(true); // bluff half of air → ⅓ of bets are bluffs
    expect(near(sol.bettorEV, 75, 0.6)).toBe(true); // bettor captures 75 of the 100 pot
    expect(near(sol.defenderEV, 25, 0.6)).toBe(true);
  });

  it('a bluff is exactly indifferent at equilibrium', () => {
    const cf = closedForm(params);
    // EV(bluff) = c·(−B) + (1−c)·P = 0 at c = P/(P+B)
    const evBluff = cf.callFreq * -params.bet + (1 - cf.callFreq) * params.pot;
    expect(near(evBluff, 0)).toBe(true);
  });
});

describe('exploitation: deviating from equilibrium loses to the best response', () => {
  const params = { pot: 100, bet: 100, valueFrac: 0.5 };
  const cf = closedForm(params);

  it('an over-folder gets bluffed relentlessly', () => {
    const overFold = 0.2; // calls only 20% instead of 50%
    // bettor best response: bluff every air hand
    const brEV = bestBettorEV(params, overFold);
    const eqEV = bettorEVFor(params, 1, cf.bluffFreq, cf.callFreq);
    // exact: BR vs c=0.2 is 90 chips vs 75 at equilibrium → +15
    expect(near(brEV - eqEV, 15, 0.5)).toBe(true);
  });

  it('an over-bluffer gets called down', () => {
    const overBluff = 0.9; // bluffs 90% of air instead of 50%
    const brDefEV = bestDefenderEV(params, 1, overBluff);
    const eqDefEV = params.pot - bettorEVFor(params, 1, cf.bluffFreq, cf.callFreq);
    expect(brDefEV).toBeGreaterThan(eqDefEV + 10);
  });

  it('at equilibrium neither side gains by deviating', () => {
    const sol = solveRiverGame(params);
    const brBettor = bestBettorEV(params, sol.callFreq);
    const brDef = bestDefenderEV(params, sol.betNuts, sol.bluffFreq);
    expect(near(brBettor, sol.bettorEV, 0.8)).toBe(true);
    expect(near(brDef, sol.defenderEV, 0.8)).toBe(true);
  });
});
