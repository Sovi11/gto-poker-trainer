// Heads-up Nash push/fold ranges by effective stack depth (in big blinds).
// Small blind jams or folds; big blind calls or folds. Ranges below are the
// well-known Nash equilibrium approximations (à la HoldemResources / SAGE),
// rounded to the nearest charted depth.

export interface PushFoldEntry {
  bb: number;
  sbShove: string; // SB push (jam-or-fold) range
  bbCall: string; // BB calling range facing the jam
}

// Charted at representative depths; we snap any requested depth to the nearest.
export const PUSHFOLD_TABLE: PushFoldEntry[] = [
  {
    bb: 1,
    sbShove: '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T3o+, 94o+, 84o+, 74o+, 64o+, 53o+, 43o',
    bbCall: '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 93s+, 83s+, 73s+, 63s+, 53s+, 43s, A2o+, K2o+, Q3o+, J5o+, T6o+, 96o+, 86o+, 75o+, 65o',
  },
  {
    bb: 5,
    sbShove: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 86s+, 75s+, 64s+, 53s+, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o',
    bbCall: '22+, A2s+, K7s+, Q9s+, JTs, A7o+, K9o+, QTo+, JTo',
  },
  {
    bb: 8,
    sbShove: '22+, A2s+, K3s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, A2o+, K8o+, Q9o+, JTo',
    bbCall: '44+, A4s+, KTs+, QJs, ATo+, KJo+',
  },
  {
    bb: 10,
    sbShove: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 98s, 87s, A2o+, K9o+, QTo+, JTo',
    bbCall: '55+, A7s+, KTs+, QJs, ATo+, KQo',
  },
  {
    bb: 15,
    sbShove: '22+, A2s+, K7s+, Q9s+, JTs, T9s, A4o+, K9o+, QTo+',
    bbCall: '77+, ATs+, KJs+, AJo+, KQo',
  },
  {
    bb: 20,
    sbShove: '22+, A2s+, K9s+, QTs+, JTs, A7o+, KTo+, QJo',
    bbCall: '88+, AJs+, KQs, AQo+',
  },
];

export function nearestPushFold(bb: number): PushFoldEntry {
  let best = PUSHFOLD_TABLE[0];
  let bestDist = Infinity;
  for (const e of PUSHFOLD_TABLE) {
    const d = Math.abs(e.bb - bb);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export const PUSHFOLD_DEPTHS = PUSHFOLD_TABLE.map((e) => e.bb);
