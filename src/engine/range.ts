import { Card, makeCard, RANKS } from './cards';

// A "hand class" is one of the 169 strategically distinct starting hands,
// e.g. "AA", "AKs", "AKo". This module expands range notation into both
// the set of hand classes and the concrete 2-card combos they represent.

export type HandClass = string; // e.g. "AKs", "TT", "72o"

// rank index: 0=2 ... 12=A. We use the convention high rank first in labels.
function rankLabel(idx: number): string {
  return RANKS[idx];
}

// Build the canonical label for two rank indices and suitedness.
export function handClass(hi: number, lo: number, suited: boolean): HandClass {
  if (hi === lo) return rankLabel(hi) + rankLabel(lo); // pair
  const a = Math.max(hi, lo);
  const b = Math.min(hi, lo);
  return rankLabel(a) + rankLabel(b) + (suited ? 's' : 'o');
}

// Return the 4 (pair: 6), 4 (suited), or 12 (offsuit) concrete combos for a class.
export function classToCombos(cls: HandClass): [Card, Card][] {
  const r1 = RANKS.indexOf(cls[0] as (typeof RANKS)[number]);
  const r2 = RANKS.indexOf(cls[1] as (typeof RANKS)[number]);
  const combos: [Card, Card][] = [];
  if (r1 === r2) {
    // pair: 6 combos
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = s1 + 1; s2 < 4; s2++) combos.push([makeCard(r1, s1), makeCard(r2, s2)]);
    return combos;
  }
  const suited = cls[2] === 's';
  if (suited) {
    for (let s = 0; s < 4; s++) combos.push([makeCard(r1, s), makeCard(r2, s)]);
  } else {
    for (let s1 = 0; s1 < 4; s1++)
      for (let s2 = 0; s2 < 4; s2++) if (s1 !== s2) combos.push([makeCard(r1, s1), makeCard(r2, s2)]);
  }
  return combos;
}

// All 169 hand classes as a 13x13 grid convention:
// grid[i][j] where i=row (high rank desc), j=col (low rank desc).
// Upper triangle (j>i) = suited, lower (j<i) = offsuit, diagonal = pairs.
export function allHandClasses(): HandClass[][] {
  const grid: HandClass[][] = [];
  for (let i = 12; i >= 0; i--) {
    const row: HandClass[] = [];
    for (let j = 12; j >= 0; j--) {
      const rowRank = i;
      const colRank = j;
      if (rowRank === colRank) row.push(handClass(rowRank, colRank, false));
      else if (rowRank > colRank) row.push(handClass(rowRank, colRank, true)); // suited above diagonal
      else row.push(handClass(colRank, rowRank, false)); // offsuit below
    }
    grid.push(row);
  }
  return grid;
}

// Parse a range string into a Set of hand classes.
// Supports: "AA", "AKs", "AKo", "99+", "ATs+", "KQo+", "T9s-76s", comma/space separated.
export function parseRange(input: string): Set<HandClass> {
  const out = new Set<HandClass>();
  const tokens = input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (token.includes('-') && token.length > 3) {
      expandDashRange(token, out);
    } else if (token.endsWith('+')) {
      expandPlus(token.slice(0, -1), out);
    } else {
      addExact(token, out);
    }
  }
  return out;
}

function rankIdx(ch: string): number {
  return RANKS.indexOf(ch.toUpperCase() as (typeof RANKS)[number]);
}

function addExact(token: string, out: Set<HandClass>): void {
  const r1 = rankIdx(token[0]);
  const r2 = rankIdx(token[1]);
  if (r1 < 0 || r2 < 0) return;
  if (r1 === r2) {
    out.add(handClass(r1, r2, false));
  } else {
    const suited = token[2]?.toLowerCase() === 's';
    const offsuit = token[2]?.toLowerCase() === 'o';
    if (suited) out.add(handClass(r1, r2, true));
    else if (offsuit) out.add(handClass(r1, r2, false));
    else {
      // no suffix: include both
      out.add(handClass(r1, r2, true));
      out.add(handClass(r1, r2, false));
    }
  }
}

// "99+" => 99,TT,...AA. "ATs+" => ATs,AJs,AQs,AKs. "KQo+" => KQo (and up: none above with K high).
function expandPlus(base: string, out: Set<HandClass>): void {
  const r1 = rankIdx(base[0]);
  const r2 = rankIdx(base[1]);
  if (r1 < 0 || r2 < 0) return;
  if (r1 === r2) {
    for (let r = r1; r <= 12; r++) out.add(handClass(r, r, false));
    return;
  }
  const suited = base[2]?.toLowerCase() === 's';
  const offsuit = base[2]?.toLowerCase() === 'o';
  const hi = Math.max(r1, r2);
  const loStart = Math.min(r1, r2);
  // raise the lower card up to (hi-1)
  for (let lo = loStart; lo < hi; lo++) {
    if (suited) out.add(handClass(hi, lo, true));
    else if (offsuit) out.add(handClass(hi, lo, false));
    else {
      out.add(handClass(hi, lo, true));
      out.add(handClass(hi, lo, false));
    }
  }
}

// "T9s-76s" suited connectors range, or "99-66" pair range.
function expandDashRange(token: string, out: Set<HandClass>): void {
  const [a, b] = token.split('-');
  const ra1 = rankIdx(a[0]);
  const ra2 = rankIdx(a[1]);
  const rb1 = rankIdx(b[0]);
  const rb2 = rankIdx(b[1]);
  if (ra1 < 0 || ra2 < 0 || rb1 < 0 || rb2 < 0) return;

  if (ra1 === ra2 && rb1 === rb2) {
    const hi = Math.max(ra1, rb1);
    const lo = Math.min(ra1, rb1);
    for (let r = lo; r <= hi; r++) out.add(handClass(r, r, false));
    return;
  }
  const suited = a[2]?.toLowerCase() === 's';
  const gapA = Math.abs(ra1 - ra2);
  const gapB = Math.abs(rb1 - rb2);
  if (gapA === gapB) {
    const hiStart = Math.max(ra1, ra2);
    const hiEnd = Math.max(rb1, rb2);
    const lo = Math.min(hiStart, hiEnd);
    const hi = Math.max(hiStart, hiEnd);
    for (let h = lo; h <= hi; h++) {
      out.add(handClass(h, h - gapA, suited));
    }
  }
}

// Convert a set of hand classes into all concrete combos (no card removal).
export function rangeToCombos(classes: Set<HandClass>): [Card, Card][] {
  const combos: [Card, Card][] = [];
  for (const cls of classes) combos.push(...classToCombos(cls));
  return combos;
}

// Count weighted combos in a range (for "% of hands" displays).
export function comboCount(classes: Set<HandClass>): number {
  let n = 0;
  for (const cls of classes) {
    if (cls.length === 2) n += 6; // pair
    else if (cls[2] === 's') n += 4;
    else n += 12;
  }
  return n;
}

export const TOTAL_COMBOS = 1326; // C(52,2)
