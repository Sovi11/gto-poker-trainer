import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mulberry32, shuffle } from '../src/engine/cards';
import { evaluate } from '../src/arena/evaluate';
import { EquityNetwork, FEATURE_COUNT, equityFeatures, predictEquity, sampleUniformEquity } from '../src/arena/equity-model';
import { drawStrength } from '../src/arena/ranges';

interface Row { x: number[]; y: number; baseline: number }
const seed = Number(process.env.TRAIN_SEED ?? 615749), boards = Number(process.env.TRAIN_BOARDS ?? 6000);
const samples = Number(process.env.TRAIN_EQUITY_SAMPLES ?? 512), epochs = Number(process.env.TRAIN_EPOCHS ?? 60);
if (![seed, boards, samples, epochs].every(Number.isInteger) || boards < 100 || samples < 128 || epochs < 1) throw new Error('Invalid training settings');
mkdirSync('artifacts', { recursive: true }); mkdirSync('src/arena/models', { recursive: true });
function generate(count: number, perBoard: number, iters: number, seedValue: number): Row[] {
  const rng = mulberry32(seedValue), rows: Row[] = [], deck = Array.from({ length: 52 }, (_, i) => i);
  for (let n = 0; n < count; n++) {
    const shuffled = shuffle(deck, rng), board = shuffled.slice(0, n % 2 ? 4 : 3), dead = new Set(board);
    const combos: { hole: [number, number]; score: number; p: number }[] = [];
    for (let a = 0; a < 52; a++) if (!dead.has(a)) for (let b = a + 1; b < 52; b++) if (!dead.has(b)) combos.push({ hole: [a, b], score: evaluate([a, b, ...board]), p: 0 });
    combos.sort((a, b) => a.score - b.score);
    for (let start = 0; start < combos.length;) {
      let end = start + 1; while (end < combos.length && combos[end].score === combos[start].score) end++;
      for (let k = start; k < end; k++) combos[k].p = (start + end) / (2 * combos.length);
      start = end;
    }
    for (let k = 0; k < perBoard; k++) {
      const c = combos[Math.floor(rng() * combos.length)];
      rows.push({ x: equityFeatures(c.hole, board, c.p), y: sampleUniformEquity(c.hole, board, iters, rng), baseline: Math.min(1, c.p + drawStrength(c.hole, board)) });
    }
    if ((n + 1) % 500 === 0) console.log(JSON.stringify({ phase: 'dataset', boardsDone: n + 1, boards: count, rows: rows.length }));
  }
  return rows;
}
const path = `artifacts/equity-data-${seed}-${boards}-${samples}.json`;
const train: Row[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : generate(boards, 8, samples, seed);
writeFileSync(path, JSON.stringify(train));
// Board seeds are disjoint; no sibling hands from the same board leak between
// train and validation. More rollouts reduce validation-label noise.
const validationPath = `artifacts/equity-validation-${seed}.json`;
const valid: Row[] = existsSync(validationPath) ? JSON.parse(readFileSync(validationPath, 'utf8')) : generate(800, 8, 2048, seed ^ 0x7f213f);
writeFileSync(validationPath, JSON.stringify(valid));
const rng = mulberry32(seed ^ 12345), hidden = 24;
const net: EquityNetwork = { version: 1, hidden, inputWeights: Array.from({ length: hidden * FEATURE_COUNT }, () => (rng() - .5) * .4), hiddenBias: new Array(hidden).fill(0), outputWeights: Array.from({ length: hidden }, () => (rng() - .5) * .2), outputBias: 0,
  seed, trainingRows: train.length, validation: { mse: Infinity, baselineMse: valid.reduce((a, r) => a + (r.baseline - r.y) ** 2, 0) / valid.length, rows: valid.length } };
let best: EquityNetwork = structuredClone(net), bestLoss = Infinity;
const order = Array.from({ length: train.length }, (_, i) => i);
for (let epoch = 0; epoch < epochs; epoch++) {
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const lr = .025 / (1 + epoch / 20), activation = new Float64Array(hidden);
  for (const index of order) {
    const row = train[index]; let out = net.outputBias;
    for (let h = 0; h < hidden; h++) {
      let v = net.hiddenBias[h]; for (let k = 0; k < FEATURE_COUNT; k++) v += net.inputWeights[h * FEATURE_COUNT + k] * row.x[k];
      activation[h] = Math.tanh(v); out += activation[h] * net.outputWeights[h];
    }
    const y = 1 / (1 + Math.exp(-out)), grad = 2 * (y - row.y) * y * (1 - y);
    for (let h = 0; h < hidden; h++) {
      const g = grad * net.outputWeights[h] * (1 - activation[h] ** 2);
      for (let k = 0; k < FEATURE_COUNT; k++) net.inputWeights[h * FEATURE_COUNT + k] -= lr * (g * row.x[k] + .00001 * net.inputWeights[h * FEATURE_COUNT + k]);
      net.hiddenBias[h] -= lr * g; net.outputWeights[h] -= lr * (grad * activation[h] + .00001 * net.outputWeights[h]);
    }
    net.outputBias -= lr * grad;
  }
  const loss = valid.reduce((a, row) => a + (predictEquity(net, row.x) - row.y) ** 2, 0) / valid.length;
  if (loss < bestLoss) { bestLoss = loss; net.validation.mse = loss; best = structuredClone(net); }
  if ((epoch + 1) % 5 === 0) console.log(JSON.stringify({ phase: 'fit', epoch: epoch + 1, mse: loss, bestMse: bestLoss, baselineMse: net.validation.baselineMse }));
}
writeFileSync('src/arena/models/equity-network.json', JSON.stringify(best) + '\n');
console.log(JSON.stringify({ phase: 'complete', ...best.validation }));
