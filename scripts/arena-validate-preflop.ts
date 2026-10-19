import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { preflopModel } from '../src/arena/preflop-model';
import { buildEquityModel, evaluatePushFold, EquityModel } from '../src/arena/preflop-training';

const samples = 4096, seed = 99491323, path = `artifacts/preflop-equity-${seed}-${samples}.json`;
const independent: EquityModel = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : buildEquityModel(samples, seed, (row, total) => {
  if (row % 12 === 0) console.log(JSON.stringify({ row, total }));
});
writeFileSync(path, JSON.stringify(independent));
const results = preflopModel.policies.map(policy => evaluatePushFold(independent, policy.depthBB, policy.sbJam, policy.bbCall));
writeFileSync('artifacts/preflop-independent-validation.json', JSON.stringify({ seed, samplesPerPair: samples, trainedSeed: preflopModel.seed,
  results: results.map(({ depthBB, sbEV, bestResponseGapBB }) => ({ depthBB, sbEV, bestResponseGapBB })) }, null, 2) + '\n');
for (const { depthBB, sbEV, bestResponseGapBB } of results) console.log(JSON.stringify({ depthBB, sbEV, bestResponseGapBB }));
