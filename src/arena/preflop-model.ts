import data from './models/preflop.json';
import { handClassOf } from '../bots/preflopStrength';
import type { Combo } from './ranges';
import type { PreflopModel } from './preflop-training';

export const preflopModel = data as PreflopModel;
const ids = new Map(preflopModel.classes.map((c, i) => [c, i]));
const randomEquity = preflopModel.classes.map((_, i) => preflopModel.equity[i].reduce((s, eq, j) => s + eq * preflopModel.compatible[i][j] / 1225, 0));
const percentiles = randomEquity.map(value => randomEquity.reduce((s, eq, j) => s + (eq < value ? 1 : eq === value ? .5 : 0) * preflopModel.combinations[j] / 1326, 0));

export function classIndex(hole: [number, number]): number { return ids.get(handClassOf(hole))!; }
export function trainedHandPercentile(hole: [number, number]): number { return percentiles[classIndex(hole)]; }

export function shortStackPolicy(depth: number, hole: [number, number]): { jam: number; call: number } {
  const policies = preflopModel.policies;
  const upper = policies.findIndex(p => p.depthBB >= depth);
  const high = policies[upper < 0 ? policies.length - 1 : upper];
  const low = policies[Math.max(0, upper < 0 ? policies.length - 1 : upper - 1)];
  const t = high.depthBB === low.depthBB ? 0 : Math.max(0, Math.min(1, (depth - low.depthBB) / (high.depthBB - low.depthBB)));
  const i = classIndex(hole);
  return { jam: low.sbJam[i] * (1 - t) + high.sbJam[i] * t, call: low.bbCall[i] * (1 - t) + high.bbCall[i] * t };
}

export function preflopRangeEquity(hole: [number, number], range: Combo[]): number {
  const row = preflopModel.equity[classIndex(hole)];
  let sum = 0, mass = 0;
  for (const combo of range) {
    if (combo.cards.some(c => hole.includes(c))) continue;
    mass += combo.weight; sum += combo.weight * row[classIndex(combo.cards)];
  }
  return mass > 0 ? sum / mass : .5;
}
