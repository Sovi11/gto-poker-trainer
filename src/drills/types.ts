// Drill engine: each DrillType is a *generator* that, given an RNG, produces a
// fresh graded problem. Generators are pure and deterministic in their RNG, so
// they are both infinitely replayable in the UI and exactly testable.

import { Card, fullDeck, shuffle, cardToString } from '../engine/cards';
import { handVsHandEquity } from '../engine/equity';
import { parseRange } from '../engine/range';
import { handClassOf } from '../bots/preflopStrength';
import { RFI_CHARTS } from '../gto/ranges';
import { nearestPushFold, PUSHFOLD_DEPTHS } from '../gto/pushfold';
import {
  requiredEquity,
  minDefenseFrequency,
  alpha,
  balancedBluffFraction,
  ruleOfNEquity,
} from '../engine/gtomath';

export type DrillCategory = 'Math' | 'Preflop' | 'Postflop' | 'Equity';

export type DrillInput =
  | { kind: 'choice'; choices: string[]; correct: number }
  | { kind: 'number'; correct: number; tolerance: number; unit: string };

export interface Drill {
  typeId: string;
  category: DrillCategory;
  prompt: string;
  context: string[]; // extra display lines (board, position, stacks…)
  input: DrillInput;
  explanation: string; // shown after answering — the teaching payload
}

export interface DrillType {
  id: string;
  title: string;
  category: DrillCategory;
  blurb: string;
  generate: (rng: () => number) => Drill;
}

// --- small rng helpers ---
const pick = <T>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];
const randInt = (rng: () => number, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
const round1 = (x: number): number => Math.round(x * 10) / 10;
const drawCards = (rng: () => number, n: number): Card[] => shuffle(fullDeck(), rng).slice(0, n);

const BET_FRACTIONS = [0.33, 0.5, 0.66, 0.75, 1] as const;
const fracLabel = (f: number): string =>
  ({ 0.33: '⅓', 0.5: '½', 0.66: '⅔', 0.75: '¾', 1: 'full' } as Record<number, string>)[f] ?? `${f}×`;

// --- Math drills -----------------------------------------------------------

const potOdds: DrillType = {
  id: 'pot-odds',
  title: 'Pot odds',
  category: 'Math',
  blurb: 'The equity you need to call a bet.',
  generate(rng) {
    const pot = randInt(rng, 4, 20) * 10;
    const f = pick(BET_FRACTIONS, rng);
    const bet = Math.round(pot * f);
    const req = requiredEquity(pot, bet) * 100;
    return {
      typeId: 'pot-odds',
      category: 'Math',
      prompt: `Villain bets ${bet} into a pot of ${pot}. What equity do you need to profitably call?`,
      context: [`Pot before the bet: ${pot}`, `Amount to call: ${bet} (${fracLabel(f)} pot)`],
      input: { kind: 'number', correct: round1(req), tolerance: 1.5, unit: '%' },
      explanation: `You risk ${bet} to win ${pot} + ${bet} = ${pot + bet}. Required equity = ${bet} / (${pot} + 2×${bet}) = ${bet}/${pot + 2 * bet} = ${round1(req)}%.`,
    };
  },
};

const mdf: DrillType = {
  id: 'mdf',
  title: 'Minimum defence frequency',
  category: 'Math',
  blurb: 'How much of your range you must defend.',
  generate(rng) {
    const pot = randInt(rng, 4, 20) * 10;
    const f = pick(BET_FRACTIONS, rng);
    const bet = Math.round(pot * f);
    const m = minDefenseFrequency(pot, bet) * 100;
    return {
      typeId: 'mdf',
      category: 'Math',
      prompt: `Villain bets ${bet} into ${pot}. What % of your range must you defend (MDF) so a pure bluff can't auto-profit?`,
      context: [`Pot before the bet: ${pot}`, `Bet: ${bet} (${fracLabel(f)} pot)`],
      input: { kind: 'number', correct: round1(m), tolerance: 1.5, unit: '%' },
      explanation: `MDF = pot / (pot + bet) = ${pot} / (${pot} + ${bet}) = ${round1(m)}%. Fold more than ${round1(100 - m)}% and betting any two cards prints.`,
    };
  },
};

const bluffSuccess: DrillType = {
  id: 'alpha',
  title: 'Bluff break-even (alpha)',
  category: 'Math',
  blurb: 'How often a bluff must work.',
  generate(rng) {
    const pot = randInt(rng, 4, 20) * 10;
    const f = pick(BET_FRACTIONS, rng);
    const bet = Math.round(pot * f);
    const a = alpha(pot, bet) * 100;
    return {
      typeId: 'alpha',
      category: 'Math',
      prompt: `You bluff ${bet} into a pot of ${pot}. How often must villain fold for the bluff to break even?`,
      context: [`Pot before the bet: ${pot}`, `Bluff size: ${bet} (${fracLabel(f)} pot)`],
      input: { kind: 'number', correct: round1(a), tolerance: 1.5, unit: '%' },
      explanation: `α = bet / (pot + bet) = ${bet} / (${pot} + ${bet}) = ${round1(a)}%. You risk ${bet} to win ${pot}.`,
    };
  },
};

// --- Postflop drill --------------------------------------------------------

const balancedBluff: DrillType = {
  id: 'balanced-bluff',
  title: 'Balanced bluffing',
  category: 'Postflop',
  blurb: 'The bluff frequency that keeps you unexploitable.',
  generate(rng) {
    const pot = randInt(rng, 4, 20) * 10;
    const f = pick(BET_FRACTIONS, rng);
    const bet = Math.round(pot * f);
    const b = balancedBluffFraction(pot, bet) * 100;
    return {
      typeId: 'balanced-bluff',
      category: 'Postflop',
      prompt: `River: you bet ${bet} into ${pot} with a polarized range. For a balanced range, what % of your bets should be bluffs?`,
      context: [`Pot before the bet: ${pot}`, `Bet: ${bet} (${fracLabel(f)} pot)`],
      input: { kind: 'number', correct: round1(b), tolerance: 1.5, unit: '%' },
      explanation: `Bluff fraction = bet / (pot + 2×bet) = ${bet} / ${pot + 2 * bet} = ${round1(b)}%. A pot-sized bet → 33% bluffs (2:1 value:bluff).`,
    };
  },
};

// --- Equity drills ---------------------------------------------------------

const outsToEquity: DrillType = {
  id: 'outs-equity',
  title: 'Outs → equity (rule of 2 & 4)',
  category: 'Equity',
  blurb: 'Turn a draw into a number.',
  generate(rng) {
    const outs = randInt(rng, 4, 15);
    const onFlop = rng() < 0.5;
    const streets = onFlop ? 2 : 1;
    const eq = ruleOfNEquity(outs, streets);
    return {
      typeId: 'outs-equity',
      category: 'Equity',
      prompt: `You have ${outs} outs on the ${onFlop ? 'flop' : 'turn'}. Estimate your equity to improve by the river.`,
      context: [`Outs: ${outs}`, `Cards to come: ${streets}`],
      input: { kind: 'number', correct: eq, tolerance: 3, unit: '%' },
      explanation: `Rule of ${onFlop ? '4 (flop)' : '2 (turn)'}: ${outs} × ${onFlop ? 4 : 2} ≈ ${eq}%. (Slightly lower for large out counts.)`,
    };
  },
};

const equityCompare: DrillType = {
  id: 'equity-compare',
  title: 'Which hand is ahead?',
  category: 'Equity',
  blurb: 'Read equity on a flop.',
  generate(rng) {
    const d = drawCards(rng, 7);
    const a: [Card, Card] = [d[0], d[1]];
    const b: [Card, Card] = [d[2], d[3]];
    const board = d.slice(4, 7); // flop -> exact enumeration of the remaining runout
    const res = handVsHandEquity(a, b, board, 4000, Math.floor(rng() * 1e9));
    const aAhead = res.equity >= 0.5;
    const cards = (h: [Card, Card]) => `${cardToString(h[0])}${cardToString(h[1])}`;
    return {
      typeId: 'equity-compare',
      category: 'Equity',
      prompt: 'On this flop, which hand has more equity?',
      context: [`Board: ${board.map(cardToString).join(' ')}`, `Hand A: ${cards(a)}`, `Hand B: ${cards(b)}`],
      input: { kind: 'choice', choices: [`Hand A (${cards(a)})`, `Hand B (${cards(b)})`], correct: aAhead ? 0 : 1 },
      explanation: `Hand A has ${(res.equity * 100).toFixed(1)}% vs Hand B's ${((1 - res.equity) * 100).toFixed(1)}% on ${board.map(cardToString).join(' ')}.`,
    };
  },
};

// --- Preflop drills --------------------------------------------------------

const rfiOpen: DrillType = {
  id: 'rfi-open',
  title: 'Open or fold? (RFI)',
  category: 'Preflop',
  blurb: 'Is this hand in the opening range?',
  generate(rng) {
    const chart = pick(RFI_CHARTS, rng);
    const range = parseRange(chart.range);
    const [c0, c1] = drawCards(rng, 2);
    const cls = handClassOf([c0, c1]);
    const inRange = range.has(cls);
    return {
      typeId: 'rfi-open',
      category: 'Preflop',
      prompt: `Folded to you at ${chart.position}. Do you open ${cls}?`,
      context: [chart.title],
      input: { kind: 'choice', choices: ['Open (raise)', 'Fold'], correct: inRange ? 0 : 1 },
      explanation: `${cls} is ${inRange ? 'in' : 'not in'} a standard ${chart.position} RFI range.\nRange: ${chart.range}`,
    };
  },
};

const pushFold: DrillType = {
  id: 'push-fold',
  title: 'Jam or fold? (Nash)',
  category: 'Preflop',
  blurb: 'Short-stack push/fold.',
  generate(rng) {
    const bb = pick(PUSHFOLD_DEPTHS, rng);
    const entry = nearestPushFold(bb);
    const range = parseRange(entry.sbShove);
    const [c0, c1] = drawCards(rng, 2);
    const cls = handClassOf([c0, c1]);
    const jam = range.has(cls);
    return {
      typeId: 'push-fold',
      category: 'Preflop',
      prompt: `${bb}bb effective, Small Blind, first in. Jam or fold ${cls}?`,
      context: [`Effective stack: ${bb} BB`],
      input: { kind: 'choice', choices: ['Jam (all-in)', 'Fold'], correct: jam ? 0 : 1 },
      explanation: `At ${entry.bb}bb the Nash SB jam range makes ${cls} a ${jam ? 'jam' : 'fold'}.\nRange: ${entry.sbShove}`,
    };
  },
};

export const DRILL_TYPES: DrillType[] = [
  potOdds,
  mdf,
  bluffSuccess,
  balancedBluff,
  outsToEquity,
  equityCompare,
  rfiOpen,
  pushFold,
];

export const DRILL_CATEGORIES: (DrillCategory | 'All')[] = ['All', 'Math', 'Preflop', 'Postflop', 'Equity'];

export function drillTypesIn(cat: DrillCategory | 'All'): DrillType[] {
  return cat === 'All' ? DRILL_TYPES : DRILL_TYPES.filter((t) => t.category === cat);
}

export function generateDrill(cat: DrillCategory | 'All', rng: () => number = Math.random): Drill {
  return pick(drillTypesIn(cat), rng).generate(rng);
}

// Generate a drill of a specific type (used by the spaced-repetition queue).
export function generateDrillByType(typeId: string, rng: () => number = Math.random): Drill | null {
  const type = DRILL_TYPES.find((t) => t.id === typeId);
  return type ? type.generate(rng) : null;
}
