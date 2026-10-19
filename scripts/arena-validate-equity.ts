import { writeFileSync } from 'node:fs';
import { mulberry32, shuffle } from '../src/engine/cards';
import { evaluate } from '../src/arena/evaluate';
import { equityVsRandomOnBoard } from '../src/engine/equity';
import { drawStrength } from '../src/arena/ranges';
import { equityFeatures, predictEquity, EquityNetwork } from '../src/arena/equity-model';
import modelData from '../src/arena/models/equity-network.json';

// A third board seed, never used for fitting or epoch selection. Targets use
// the trainer's independent evaluator and random-opponent equity routine.
const seed = 19873159, rng = mulberry32(seed), network = modelData as EquityNetwork;
const boardCount = 512, examplesPerBoard = 8, oracleSamples = 1000;
const boardGains = [], errors = [], baselineErrors = [];
for (let b = 0; b < boardCount; b++) {
  const board = shuffle(Array.from({ length: 52 }, (_, i) => i), rng).slice(0, 3 + b % 2), dead = new Set(board);
  const combos: { hole: [number, number]; score: number; percentile: number }[] = [];
  for (let a = 0; a < 52; a++) if (!dead.has(a)) for (let c = a + 1; c < 52; c++) if (!dead.has(c)) combos.push({ hole: [a, c], score: evaluate([a, c, ...board]), percentile: 0 });
  combos.sort((a, c) => a.score - c.score);
  for (let start = 0; start < combos.length;) {
    let end = start + 1; while (end < combos.length && combos[end].score === combos[start].score) end++;
    for (let k = start; k < end; k++) combos[k].percentile = (start + end) / (2 * combos.length);
    start = end;
  }
  let improvement = 0;
  for (let k = 0; k < examplesPerBoard; k++) {
    const c = combos[Math.floor(rng() * combos.length)], baseline = Math.min(1, c.percentile + drawStrength(c.hole, board));
    const value = predictEquity(network, equityFeatures(c.hole, board, c.percentile));
    const truth = equityVsRandomOnBoard(c.hole, board, oracleSamples, seed + b * 811 + k);
    const error = (value - truth) ** 2, baselineError = (baseline - truth) ** 2;
    errors.push(error); baselineErrors.push(baselineError); improvement += baselineError - error;
  }
  boardGains.push(improvement / examplesPerBoard);
  if ((b + 1) % 64 === 0) console.log(JSON.stringify({ boardsDone: b + 1, boardCount }));
}
const mean = boardGains.reduce((a, b) => a + b, 0) / boardGains.length;
const variance = boardGains.reduce((a, b) => a + (b - mean) ** 2, 0) / (boardGains.length - 1);
const result = { seed, boardCount, cases: errors.length, oracleSamples, independentReferenceEvaluator: true,
  mse: errors.reduce((a, b) => a + b, 0) / errors.length,
  baselineMse: baselineErrors.reduce((a, b) => a + b, 0) / errors.length,
  boardClustered95Improvement: [mean - 1.96 * Math.sqrt(variance / boardGains.length), mean + 1.96 * Math.sqrt(variance / boardGains.length)] };
writeFileSync('artifacts/equity-independent-validation.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
