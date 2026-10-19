import { allHandClasses, classToCombos } from '../engine/range';
import { mulberry32 } from '../engine/cards';
import { evaluate } from './evaluate';

export interface EquityModel {
  version: 1;
  seed: number;
  samplesPerPair: number;
  classes: string[];
  combinations: number[];
  compatible: number[][];
  equity: number[][];
}
export interface PushFoldPolicy {
  depthBB: number;
  sbJam: number[];
  bbCall: number[];
  sbEV: number;
  bestResponseGapBB: number;
}
export interface PreflopModel extends EquityModel {
  iterations: number;
  policies: PushFoldPolicy[];
  description: string;
}

// Suit-isomorphic hand classes, but exact combo-count and card-removal
// probabilities. Matchup equities average compatible suit arrangements.
export function buildEquityModel(samplesPerPair: number, seed: number, onRow?: (row: number, total: number) => void): EquityModel {
  const classes = allHandClasses().flat(), n = classes.length;
  const combos = classes.map(classToCombos);
  const compatible = classes.map((_, i) => combos.map(cs => cs.filter(c => !c.some(x => combos[i][0].includes(x))).length));
  const matrix = classes.map(() => new Array<number>(n).fill(.5));
  for (let i = 0; i < n; i++) {
    const hole = combos[i][0];
    const pool = Array.from({ length: 52 }, (_, c) => c).filter(c => !hole.includes(c));
    for (let j = i + 1; j < n; j++) {
      const rng = mulberry32((seed ^ Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663)) >>> 0);
      const opponents = combos[j].filter(c => !c.some(x => hole.includes(x)));
      let wins = 0;
      const a = [hole[0], hole[1], 0, 0, 0, 0, 0], b = [0, 0, 0, 0, 0, 0, 0];
      for (let k = 0; k < samplesPerPair; k++) {
        const opp = opponents[Math.floor(rng() * opponents.length)]; b[0] = opp[0]; b[1] = opp[1];
        for (let p = 2; p < 7; p++) {
          let c: number;
          do { c = pool[Math.floor(rng() * pool.length)]; } while (opp.includes(c) || a.slice(2, p).includes(c));
          a[p] = b[p] = c;
        }
        const sa = evaluate(a), sb = evaluate(b); wins += sa > sb ? 1 : sa === sb ? .5 : 0;
      }
      const e = wins / samplesPerPair; matrix[i][j] = e; matrix[j][i] = 1 - e;
    }
    onRow?.(i + 1, n);
  }
  return { version: 1, seed, samplesPerPair, classes, combinations: combos.map(cs => cs.length), compatible, equity: matrix };
}

// CFR+ for the exact two-action, preflop jam/fold abstraction. Utilities are
// net chips from before posting blinds: SB fold=-.5 BB; BB fold=-1 BB.
// This is not a solution to unrestricted NLHE; its deployment is short-stack.
export function trainPushFold(model: EquityModel, depthBB: number, iterations: number): PushFoldPolicy {
  const n = model.classes.length, p = new Float64Array(n).fill(.5), q = new Float64Array(n).fill(.5);
  const sbFoldRegret = new Float64Array(n), sbJamRegret = new Float64Array(n);
  const bbFoldRegret = new Float64Array(n), bbCallRegret = new Float64Array(n);
  const sumP = new Float64Array(n), sumQ = new Float64Array(n);
  const prob = Float64Array.from(model.compatible.flat().map(c => c / 1225));
  const showdown = Float64Array.from(model.equity.flat().map(e => depthBB * (2 * e - 1)));
  const sbValues = new Float64Array(n), bbCallValues = new Float64Array(n), bbFoldValues = new Float64Array(n);
  let sumWeight = 0;
  for (let t = 1; t <= iterations; t++) {
    const weight = t > Math.floor(iterations / 5) ? t : 0; sumWeight += weight;
    for (let i = 0; i < n; i++) {
      const sbR = sbFoldRegret[i] + sbJamRegret[i], bbR = bbFoldRegret[i] + bbCallRegret[i];
      p[i] = sbR > 0 ? sbJamRegret[i] / sbR : .5;
      q[i] = bbR > 0 ? bbCallRegret[i] / bbR : .5;
      sumP[i] += weight * p[i]; sumQ[i] += weight * q[i];
      sbValues[i] = bbCallValues[i] = bbFoldValues[i] = 0;
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const idx = i * n + j, conditionalJ = prob[idx];
      const conditionalI = model.combinations[i] * conditionalJ / model.combinations[j];
      sbValues[i] += conditionalJ * (1 - q[j] + q[j] * showdown[idx]);
      bbCallValues[j] -= conditionalI * p[i] * showdown[idx];
      bbFoldValues[j] -= conditionalI * p[i];
    }
    for (let i = 0; i < n; i++) {
      const sbValue = p[i] * sbValues[i] - (1 - p[i]) * .5;
      sbFoldRegret[i] = Math.max(0, sbFoldRegret[i] - .5 - sbValue);
      sbJamRegret[i] = Math.max(0, sbJamRegret[i] + sbValues[i] - sbValue);
      const bbValue = q[i] * bbCallValues[i] + (1 - q[i]) * bbFoldValues[i];
      bbFoldRegret[i] = Math.max(0, bbFoldRegret[i] + bbFoldValues[i] - bbValue);
      bbCallRegret[i] = Math.max(0, bbCallRegret[i] + bbCallValues[i] - bbValue);
    }
  }
  const sbJam = Array.from(sumP, x => x / sumWeight), bbCall = Array.from(sumQ, x => x / sumWeight);
  return evaluatePushFold(model, depthBB, sbJam, bbCall);
}

export function evaluatePushFold(model: EquityModel, depthBB: number, sbJam: number[], bbCall: number[]): PushFoldPolicy {
  const n = model.classes.length;
  const prob = Float64Array.from(model.compatible.flat().map(c => c / 1225));
  const showdown = Float64Array.from(model.equity.flat().map(e => depthBB * (2 * e - 1)));
  let ev = 0, brSB = 0, brBB = 0;
  for (let i = 0; i < n; i++) {
    let jam = 0, call = 0, fold = 0;
    for (let j = 0; j < n; j++) {
      jam += prob[i * n + j] * (1 - bbCall[j] + bbCall[j] * showdown[i * n + j]);
      const cond = model.combinations[j] * prob[j * n + i] / model.combinations[i];
      call -= cond * sbJam[j] * showdown[j * n + i]; fold -= cond * sbJam[j];
    }
    const prior = model.combinations[i] / 1326;
    ev += prior * (sbJam[i] * jam - (1 - sbJam[i]) * .5);
    brSB += prior * Math.max(-.5, jam);
    // Root SB folds give BB +.5; included identically in both profiles so
    // only improvements at the BB decision enter the BR gap below.
    brBB += prior * (Math.max(call, fold) - (bbCall[i] * call + (1 - bbCall[i]) * fold));
  }
  return { depthBB, sbJam, bbCall, sbEV: ev, bestResponseGapBB: Math.max(0, brSB - ev + brBB) };
}
