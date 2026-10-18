import { Combo } from './ranges';
import { evaluate } from './evaluate';

// Weighted sampling with card removal. Exact on the river; bounded Monte
// Carlo elsewhere. The caller owns randomness for reproducible evaluation.
export function equity(hole: number[], board: number[], range: Combo[], rng: () => number, samples = 1600, deadline = Infinity): number {
  const dead = new Set([...hole, ...board]);
  const legal = range.filter(c => !c.cards.some(x => dead.has(x)));
  let total = 0; const cumulative = legal.map(c => total += c.weight);
  if (!total) throw new Error('Empty opponent range after card removal');
  if (board.length === 5) {
    const own = evaluate([...hole, ...board]); let wins = 0;
    for (const c of legal) { const s = evaluate([...c.cards, ...board]); wins += c.weight * (own > s ? 1 : own === s ? .5 : 0); }
    return wins / total;
  }
  const deck = Array.from({ length: 52 }, (_, i) => i).filter(c => !dead.has(c));
  let wins = 0, n = 0;
  for (; n < samples; n++) {
    if (n >= 128 && n % 64 === 0 && performance.now() > deadline) break;
    const target = rng() * total; let lo = 0, hi = legal.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (cumulative[mid] < target) lo = mid + 1; else hi = mid; }
    const opp = legal[lo].cards, full = board.slice();
    while (full.length < 5) {
      const c = deck[Math.floor(rng() * deck.length)];
      if (!opp.includes(c) && !full.includes(c)) full.push(c);
    }
    const a = evaluate([...hole, ...full]), b = evaluate([...opp, ...full]);
    wins += a > b ? 1 : a === b ? .5 : 0;
  }
  return wins / n;
}
