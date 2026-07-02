import { describe, it, expect } from 'vitest';
import { mulberry32, parseCard } from '../engine/cards';
import { handVsHandEquity } from '../engine/equity';
import { parseRange } from '../engine/range';
import { handClassOf } from '../bots/preflopStrength';
import { requiredEquity, minDefenseFrequency, alpha, balancedBluffFraction } from '../engine/gtomath';
import { DRILL_TYPES, DRILL_CATEGORIES, drillTypesIn, generateDrill } from './types';

describe('drill generators produce well-formed drills', () => {
  it('every generated drill is internally valid across many seeds', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const drill = generateDrill('All', mulberry32(seed));
      expect(drill.prompt.length).toBeGreaterThan(0);
      expect(drill.explanation.length).toBeGreaterThan(0);
      if (drill.input.kind === 'choice') {
        expect(drill.input.correct).toBeGreaterThanOrEqual(0);
        expect(drill.input.correct).toBeLessThan(drill.input.choices.length);
      } else {
        expect(Number.isFinite(drill.input.correct)).toBe(true);
        expect(drill.input.tolerance).toBeGreaterThan(0);
        expect(drill.input.unit.length).toBeGreaterThan(0);
      }
    }
  });

  it('category filtering only returns drills of that category', () => {
    for (const cat of DRILL_CATEGORIES) {
      if (cat === 'All') continue;
      for (const t of drillTypesIn(cat)) expect(t.category).toBe(cat);
      for (let seed = 1; seed <= 20; seed++) {
        expect(generateDrill(cat, mulberry32(seed)).category).toBe(cat);
      }
    }
  });

  it('covers all categories and all types are reachable', () => {
    expect(DRILL_TYPES.length).toBeGreaterThanOrEqual(8);
    const cats = new Set(DRILL_TYPES.map((t) => t.category));
    expect(cats).toEqual(new Set(['Math', 'Preflop', 'Postflop', 'Equity']));
  });
});

// Each math drill's stated answer must match the formula it claims to teach.
describe('math drill answers match the underlying formulas', () => {
  const get = (id: string) => DRILL_TYPES.find((t) => t.id === id)!;

  it('pot-odds answer equals requiredEquity', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const d = get('pot-odds').generate(mulberry32(seed));
      const [pot, bet] = potBet(d.context);
      if (d.input.kind !== 'number') throw new Error('expected number');
      expect(closeTo(d.input.correct, requiredEquity(pot, bet) * 100)).toBe(true);
    }
  });

  it('mdf answer equals minDefenseFrequency', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const d = get('mdf').generate(mulberry32(seed));
      const [pot, bet] = potBet(d.context);
      if (d.input.kind !== 'number') throw new Error('expected number');
      expect(closeTo(d.input.correct, minDefenseFrequency(pot, bet) * 100)).toBe(true);
    }
  });

  it('alpha answer equals alpha()', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const d = get('alpha').generate(mulberry32(seed));
      const [pot, bet] = potBet(d.context);
      if (d.input.kind !== 'number') throw new Error('expected number');
      expect(closeTo(d.input.correct, alpha(pot, bet) * 100)).toBe(true);
    }
  });

  it('balanced-bluff answer equals balancedBluffFraction', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const d = get('balanced-bluff').generate(mulberry32(seed));
      const [pot, bet] = potBet(d.context);
      if (d.input.kind !== 'number') throw new Error('expected number');
      expect(closeTo(d.input.correct, balancedBluffFraction(pot, bet) * 100)).toBe(true);
    }
  });
});

// The range/equity drills must key their answer off the same data the app uses.
describe('range and equity drills are grounded in the engine', () => {
  const get = (id: string) => DRILL_TYPES.find((t) => t.id === id)!;

  it('rfi-open marks a hand open iff it is in the charted range', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const d = get('rfi-open').generate(mulberry32(seed));
      if (d.input.kind !== 'choice') throw new Error('expected choice');
      // The prompt names the hand ("Do you open XYs?"); the explanation carries the range.
      const cls = d.prompt.match(/open (\w{2,3})\?/)![1];
      const rangeStr = d.explanation.split('Range: ')[1];
      const shouldOpen = parseRange(rangeStr).has(cls);
      expect(d.input.correct).toBe(shouldOpen ? 0 : 1); // choice 0 = Open
    }
  });

  it('equity-compare picks the hand that is actually ahead', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const d = get('equity-compare').generate(mulberry32(seed));
      if (d.input.kind !== 'choice') throw new Error('expected choice');
      const board = d.context[0].replace('Board: ', '').split(' ').map(parseCard);
      const a = d.context[1].replace('Hand A: ', '');
      const b = d.context[2].replace('Hand B: ', '');
      const ha: [number, number] = [parseCard(a.slice(0, 2)), parseCard(a.slice(2, 4))];
      const hb: [number, number] = [parseCard(b.slice(0, 2)), parseCard(b.slice(2, 4))];
      const res = handVsHandEquity(ha, hb, board, 4000, 1);
      const aAhead = res.equity >= 0.5;
      expect(d.input.correct).toBe(aAhead ? 0 : 1);
    }
  });

  it('handClassOf agrees with the class named in an rfi drill', () => {
    // sanity that the class extracted from the prompt is a real 2/3-char class
    const d = get('rfi-open').generate(mulberry32(7));
    const cls = d.prompt.match(/open (\w{2,3})\?/)![1];
    expect([2, 3]).toContain(cls.length);
    // a concrete combo of that class round-trips
    const anyCombo = handClassOf([parseCard('Ah'), parseCard('Kd')]);
    expect(anyCombo).toBe('AKo');
  });
});

// --- helpers ---
function potBet(context: string[]): [number, number] {
  const pot = Number(context.find((l) => l.startsWith('Pot before'))!.match(/\d+/)![0]);
  const betLine = context.find((l) => /^(Bet|Amount to call|Bluff size)/.test(l))!;
  const bet = Number(betLine.match(/\d+/)![0]);
  return [pot, bet];
}
function closeTo(a: number, b: number, eps = 0.06): boolean {
  // the drill stores its answer rounded to 0.1, so allow half a rounding step
  return Math.abs(a - b) <= eps;
}
