// Preflop hand-strength model used to give bots real, position- and
// personality-aware starting ranges (instead of treating every hand as equity
// vs a random holding). We score the 169 strategically-distinct starting hands
// with the Chen formula, then turn each score into a combo-weighted percentile
// (0 = worst hand dealt, 1 = best). A bot "plays the top X%" by comparing a
// hand's percentile against a threshold derived from its personality.

import { Card, rankOf, suitOf } from '../engine/cards';
import { HandClass, handClass, classToCombos } from '../engine/range';

// Bill Chen's starting-hand formula. Deterministic and cheap (no simulation),
// which keeps it unit-testable and free at import time.
function highCardPoints(rankIdx: number): number {
  if (rankIdx === 12) return 10; // A
  if (rankIdx === 11) return 8; // K
  if (rankIdx === 10) return 7; // Q
  if (rankIdx === 9) return 6; // J
  return (rankIdx + 2) / 2; // T..2 -> half the face value
}

export function chenScore(hi: number, lo: number, suited: boolean): number {
  if (hi === lo) {
    // Pair: twice the high card, minimum 5.
    return Math.round(Math.max(highCardPoints(hi) * 2, 5));
  }
  const high = Math.max(hi, lo);
  const low = Math.min(hi, lo);
  let score = highCardPoints(high);
  if (suited) score += 2;
  const gap = high - low - 1; // 0 for connectors
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  // Straight bonus: 0/1-gap and both cards below Q.
  if (gap <= 1 && high < 10) score += 1;
  return Math.round(score);
}

interface ClassInfo {
  cls: HandClass;
  score: number;
  combos: number;
}

const TOTAL_COMBOS = 1326; // C(52,2)

const CLASSES: ClassInfo[] = (() => {
  const arr: ClassInfo[] = [];
  for (let hi = 12; hi >= 0; hi--) {
    for (let lo = hi; lo >= 0; lo--) {
      if (hi === lo) {
        arr.push({ cls: handClass(hi, lo, false), score: chenScore(hi, lo, false), combos: 6 });
      } else {
        arr.push({ cls: handClass(hi, lo, true), score: chenScore(hi, lo, true), combos: 4 });
        arr.push({ cls: handClass(hi, lo, false), score: chenScore(hi, lo, false), combos: 12 });
      }
    }
  }
  return arr;
})();

// Combo-weighted percentile: fraction of random hands strictly weaker, plus
// half the equally-ranked mass (so ties land in the middle of their band).
const PERCENTILE: Map<HandClass, number> = (() => {
  const m = new Map<HandClass, number>();
  for (const ci of CLASSES) {
    let weaker = 0;
    let equal = 0;
    for (const cj of CLASSES) {
      if (cj.score < ci.score) weaker += cj.combos;
      else if (cj.score === ci.score) equal += cj.combos;
    }
    m.set(ci.cls, (weaker + equal / 2) / TOTAL_COMBOS);
  }
  return m;
})();

export function classPercentile(cls: HandClass): number {
  return PERCENTILE.get(cls) ?? 0;
}

export function handClassOf(hole: [Card, Card]): HandClass {
  const r0 = rankOf(hole[0]);
  const r1 = rankOf(hole[1]);
  const hi = Math.max(r0, r1);
  const lo = Math.min(r0, r1);
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  return handClass(hi, lo, suited);
}

export function handPercentile(hole: [Card, Card]): number {
  return classPercentile(handClassOf(hole));
}

// Concrete combos for the top `fraction` of starting hands, for use as a
// villain "continuing range" in postflop equity. Cached per rounded fraction.
const SORTED = [...CLASSES].sort((a, b) => b.score - a.score);
const rangeCache = new Map<number, [Card, Card][]>();

export function topRangeCombos(fraction: number): [Card, Card][] {
  const key = Math.round(clamp(fraction, 0.02, 1) * 100) / 100;
  const cached = rangeCache.get(key);
  if (cached) return cached;
  const target = key * TOTAL_COMBOS;
  const combos: [Card, Card][] = [];
  let count = 0;
  for (const ci of SORTED) {
    combos.push(...classToCombos(ci.cls));
    count += ci.combos;
    if (count >= target) break;
  }
  rangeCache.set(key, combos);
  return combos;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
