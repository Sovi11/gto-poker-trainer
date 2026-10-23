import { handPercentile } from '../bots/preflopStrength';
import { evaluate } from './evaluate';
import { trainedHandPercentile } from './preflop-model';
import { EquityNetwork, equityFeatures, predictEquity } from './equity-model';

export interface Combo { cards: [number, number]; weight: number; strength: number }
export interface ObservationContext { preflopRaises: number; button: boolean }
export const HANDS: [number, number][] = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) HANDS.push([a, b]);
const PREFLOP = HANDS.map(handPercentile);
const TRAINED_PREFLOP = HANDS.map(trainedHandPercentile);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function drawStrength(hole: readonly number[], board: readonly number[]): number {
  if (board.length >= 5) return 0;
  const all = [...hole, ...board];
  let draw = 0;
  for (let suit = 0; suit < 4; suit++) {
    if (all.filter(c => Math.floor(c / 13) === suit).length === 4 && hole.some(c => Math.floor(c / 13) === suit)) draw += .16;
  }
  const rs = new Set(all.map(c => c % 13)); if (rs.has(12)) rs.add(-1);
  for (let lo = -1; lo <= 8; lo++) {
    const n = Array.from({ length: 5 }, (_, i) => lo + i).filter(r => rs.has(r)).length;
    if (n === 4 && hole.some(c => c % 13 >= lo && c % 13 < lo + 5)) { draw += .09; break; }
  }
  return Math.min(.23, draw);
}

// Explicit combo beliefs retain a nonzero likelihood for bluffs and unusual
// play. Updating never uses the opponent's hidden cards.
export class RangeBelief {
  weights = new Float64Array(HANDS.length).fill(1);
  private key = '';
  private percentiles = PREFLOP;
  board: number[] = [];
  constructor(private trained = false, private network?: EquityNetwork,
    private contextualPreflop = Boolean(network)) { this.percentiles = trained ? TRAINED_PREFLOP : PREFLOP; }

  setBoard(board: number[]): void {
    const key = board.join(','); if (key === this.key) return;
    this.key = key; this.board = board.slice();
    if (!board.length) { this.percentiles = this.trained ? TRAINED_PREFLOP : PREFLOP; return; }
    const dead = new Set(board);
    const scores = HANDS.map(([a, b], i) => ({ i, score: dead.has(a) || dead.has(b) ? -1 : evaluate([a, b, ...board]) }));
    const sorted = scores.filter(x => x.score >= 0).sort((a, b) => a.score - b.score);
    this.percentiles = new Array(HANDS.length).fill(0);
    for (let start = 0; start < sorted.length;) {
      let end = start + 1; while (end < sorted.length && sorted[end].score === sorted[start].score) end++;
      for (let k = start; k < end; k++) this.percentiles[sorted[k].i] = (start + end) / (2 * sorted.length);
      start = end;
    }
    for (const x of scores) if (x.score < 0) this.weights[x.i] = 0;
    if (this.network && board.length < 5) for (let i = 0; i < HANDS.length; i++) {
      if (this.weights[i]) this.percentiles[i] = predictEquity(this.network, equityFeatures(HANDS[i], board, this.percentiles[i]));
    }
  }

  observe(action: string, sizeToPot: number, aggression = .45, context?: ObservationContext): void {
    if (action === 'fold' || action.startsWith('post_')) return;
    const pre = !this.board.length;
    let max = 0;
    for (let i = 0; i < HANDS.length; i++) {
      if (!this.weights[i]) continue;
      const p = this.percentiles[i], draw = pre ? 0 : drawStrength(HANDS[i], this.board), d = this.network ? 0 : draw;
      let likelihood = 1;
      if (action === 'raise' || action === 'all_in') {
        const threshold = pre ? this.contextualPreflop && context
          ? context.preflopRaises === 0 ? (context.button ? .20 : .55) : context.preflopRaises === 1 ? .91 : .975
          : (sizeToPot > 2 ? .90 : .48) : .68 + Math.min(.20, sizeToPot * .10);
        likelihood = .04 + .82 * sigmoid((p - threshold) * 13) + draw * 1.3 + aggression * .16 * (1 - p);
      } else if (action === 'call') {
        const threshold = pre ? this.contextualPreflop && context ? context.preflopRaises <= 1 ? .25 : context.preflopRaises === 2 ? .76 : .94
          : .35 + Math.min(.5, sizeToPot * .12) : .28 + Math.min(.5, sizeToPot * .22);
        likelihood = .06 + .80 * sigmoid((p + d - threshold) * 10);
      } else if (action === 'check') likelihood = .92 - .35 * sigmoid((p - .82) * 12);
      this.weights[i] *= likelihood; max = Math.max(max, this.weights[i]);
    }
    if (max > 0) for (let i = 0; i < this.weights.length; i++) this.weights[i] /= max;
  }

  combos(dead: readonly number[] = []): Combo[] {
    const blocked = new Set(dead);
    return HANDS.flatMap((cards, i) => this.weights[i] > 0 && !cards.some(c => blocked.has(c))
      ? [{ cards, weight: this.weights[i], strength: this.board.length && (!this.network || this.board.length === 5) ? evaluate([...cards, ...this.board]) : this.percentiles[i] }] : []);
  }
}

export function sampleRange(combos: Combo[], count: number, include?: readonly number[]): Combo[] {
  const sorted = combos.slice().sort((a, b) => a.strength - b.strength);
  const total = sorted.reduce((s, c) => s + c.weight, 0);
  if (!total) return [];
  const out: Combo[] = []; let j = 0, mass = sorted[0].weight;
  for (let i = 0; i < count; i++) {
    const target = (i + .5) * total / count;
    while (mass < target && j < sorted.length - 1) mass += sorted[++j].weight;
    const last = out[out.length - 1];
    if (last && last.cards === sorted[j].cards) last.weight++;
    else out.push({ ...sorted[j], weight: 1 });
  }
  if (include && !out.some(c => c.cards.includes(include[0]) && c.cards.includes(include[1]))) {
    const actual = sorted.find(c => c.cards.includes(include[0]) && c.cards.includes(include[1]));
    if (actual) out.push({ ...actual, weight: Math.max(.001, actual.weight / total * count) });
  }
  return out;
}
