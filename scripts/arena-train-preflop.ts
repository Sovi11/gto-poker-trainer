import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildEquityModel, trainPushFold, EquityModel, PreflopModel } from '../src/arena/preflop-training';

mkdirSync('artifacts', { recursive: true });
mkdirSync('src/arena/models', { recursive: true });
const samples = Number(process.env.TRAIN_SAMPLES ?? 8192), seed = Number(process.env.TRAIN_SEED ?? 4201943);
const iterations = Number(process.env.TRAIN_ITERATIONS ?? 10000);
if (![samples, seed, iterations].every(Number.isInteger) || samples < 128 || iterations < 100) throw new Error('Invalid training settings');
const cache = `artifacts/preflop-equity-${seed}-${samples}.json`;
const started = Date.now();
const matrix: EquityModel = existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : buildEquityModel(samples, seed, (row, n) => {
  if (row % 4 === 0 || row === n) console.log(JSON.stringify({ phase: 'equity-matrix', row, totalRows: n, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
});
writeFileSync(cache, JSON.stringify(matrix));
const policies = [];
for (const depth of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20]) {
  const policy = trainPushFold(matrix, depth, iterations); policies.push(policy);
  console.log(JSON.stringify({ phase: 'cfr', depthBB: depth, bestResponseGapBB: policy.bestResponseGapBB, sbEV: policy.sbEV, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
}
const result: PreflopModel = { ...matrix, iterations, policies, description: 'Monte Carlo class matchup equities with exact combo-removal probabilities; CFR+ short-stack jam/fold abstraction. Not unrestricted NLHE equilibrium.' };
writeFileSync('src/arena/models/preflop.json', JSON.stringify(result) + '\n');
console.log(JSON.stringify({ phase: 'complete', seconds: (Date.now() - started) / 1000 }));
