import { evaluate } from './evaluate';

export const FEATURE_COUNT = 18;
export interface EquityNetwork {
  version: 1;
  hidden: number;
  inputWeights: number[];
  hiddenBias: number[];
  outputWeights: number[];
  outputBias: number;
  validation: { mse: number; baselineMse: number; rows: number };
  seed: number;
  trainingRows: number;
}

export function equityFeatures(hole: readonly number[], board: readonly number[], percentile: number): number[] {
  const all = [...hole, ...board], suits = [0, 0, 0, 0], ranks = new Int8Array(13);
  for (const c of board) { suits[Math.floor(c / 13)]++; ranks[c % 13]++; }
  const h0 = hole[0] % 13, h1 = hole[1] % 13, hi = Math.max(h0, h1), lo = Math.min(h0, h1);
  const top = Math.max(...board.map(c => c % 13));
  const holeSuits = hole.map(c => Math.floor(c / 13));
  let flushDraw = 0, backdoor = 0;
  for (let s = 0; s < 4; s++) {
    const ours = holeSuits.filter(x => x === s).length;
    if (ours && suits[s] + ours === 4) flushDraw = 1;
    if (ours && suits[s] + ours === 3) backdoor = 1;
  }
  const present = new Set(all.map(c => c % 13)); if (present.has(12)) present.add(-1);
  let straightDraw = 0;
  for (let low = -1; low <= 8; low++) {
    const n = Array.from({ length: 5 }, (_, i) => low + i).filter(r => present.has(r)).length;
    if (n === 4 && [h0, h1].some(r => (r >= low && r < low + 5) || (r === 12 && low === -1))) straightDraw++;
  }
  const category = Math.floor(evaluate(all) / 371293);
  const paired = [...ranks].filter(n => n >= 2).length;
  return [2 * percentile - 1, 2 * percentile * percentile - 1, category / 4 - 1,
    flushDraw * 2 - 1, backdoor * 2 - 1, Math.min(2, straightDraw) - 1,
    hi / 6 - 1, lo / 6 - 1, h0 === h1 ? 1 : -1,
    ((h0 > top ? 1 : 0) + (h1 > top ? 1 : 0)) - 1,
    holeSuits[0] === holeSuits[1] ? 1 : -1, board.length - 4,
    paired - 1, Math.max(...suits) / 2 - 1, top / 6 - 1,
    (ranks[h0] > 0 ? 1 : 0) + (ranks[h1] > 0 ? 1 : 0) - 1,
    (hi - lo) / 6 - 1, board.length === 3 && flushDraw ? 1 : -1];
}

export function predictEquity(network: EquityNetwork, features: readonly number[]): number {
  let output = network.outputBias;
  for (let h = 0; h < network.hidden; h++) {
    let x = network.hiddenBias[h];
    for (let k = 0; k < FEATURE_COUNT; k++) x += network.inputWeights[h * FEATURE_COUNT + k] * features[k];
    output += Math.tanh(x) * network.outputWeights[h];
  }
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, output))));
}

export function sampleUniformEquity(hole: number[], board: number[], samples: number, rng: () => number): number {
  const dead = new Set([...hole, ...board]), pool = Array.from({ length: 52 }, (_, i) => i).filter(c => !dead.has(c));
  const a = [...hole, ...board, ...new Array(5 - board.length).fill(0)], b = [0, 0, ...board, ...new Array(5 - board.length).fill(0)];
  let win = 0;
  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < 7 - board.length; k++) {
      const j = k + Math.floor(rng() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    b[0] = pool[0]; b[1] = pool[1];
    for (let k = board.length; k < 5; k++) a[k + 2] = b[k + 2] = pool[k - board.length + 2];
    const sa = evaluate(a), sb = evaluate(b); win += sa > sb ? 1 : sa === sb ? .5 : 0;
  }
  return win / samples;
}
