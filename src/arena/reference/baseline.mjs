// src/arena/bot.ts
import { Action as Action2, Bot } from "@chipzen-ai/bot";

// src/engine/cards.ts
var RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
var SUITS = ["c", "d", "h", "s"];
function rankOf(card) {
  return card % 13;
}
function suitOf(card) {
  return Math.floor(card / 13);
}
function makeCard(rank, suit) {
  return suit * 13 + rank;
}
function parseCard(str) {
  const r = str[0].toUpperCase();
  const s = str[1].toLowerCase();
  const rank = RANKS.indexOf(r);
  const suit = SUITS.indexOf(s);
  if (rank < 0 || suit < 0) throw new Error(`Invalid card: ${str}`);
  return makeCard(rank, suit);
}

// src/engine/range.ts
function rankLabel(idx) {
  return RANKS[idx];
}
function handClass(hi, lo, suited) {
  if (hi === lo) return rankLabel(hi) + rankLabel(lo);
  const a = Math.max(hi, lo);
  const b = Math.min(hi, lo);
  return rankLabel(a) + rankLabel(b) + (suited ? "s" : "o");
}
function parseRange(input) {
  const out = /* @__PURE__ */ new Set();
  const tokens = input.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    if (token.includes("-") && token.length > 3) {
      expandDashRange(token, out);
    } else if (token.endsWith("+")) {
      expandPlus(token.slice(0, -1), out);
    } else {
      addExact(token, out);
    }
  }
  return out;
}
function rankIdx(ch) {
  return RANKS.indexOf(ch.toUpperCase());
}
function addExact(token, out) {
  const r1 = rankIdx(token[0]);
  const r2 = rankIdx(token[1]);
  if (r1 < 0 || r2 < 0) return;
  if (r1 === r2) {
    out.add(handClass(r1, r2, false));
  } else {
    const suited = token[2]?.toLowerCase() === "s";
    const offsuit = token[2]?.toLowerCase() === "o";
    if (suited) out.add(handClass(r1, r2, true));
    else if (offsuit) out.add(handClass(r1, r2, false));
    else {
      out.add(handClass(r1, r2, true));
      out.add(handClass(r1, r2, false));
    }
  }
}
function expandPlus(base, out) {
  const r1 = rankIdx(base[0]);
  const r2 = rankIdx(base[1]);
  if (r1 < 0 || r2 < 0) return;
  if (r1 === r2) {
    for (let r = r1; r <= 12; r++) out.add(handClass(r, r, false));
    return;
  }
  const suited = base[2]?.toLowerCase() === "s";
  const offsuit = base[2]?.toLowerCase() === "o";
  const hi = Math.max(r1, r2);
  const loStart = Math.min(r1, r2);
  for (let lo = loStart; lo < hi; lo++) {
    if (suited) out.add(handClass(hi, lo, true));
    else if (offsuit) out.add(handClass(hi, lo, false));
    else {
      out.add(handClass(hi, lo, true));
      out.add(handClass(hi, lo, false));
    }
  }
}
function expandDashRange(token, out) {
  const [a, b] = token.split("-");
  const ra1 = rankIdx(a[0]);
  const ra2 = rankIdx(a[1]);
  const rb1 = rankIdx(b[0]);
  const rb2 = rankIdx(b[1]);
  if (ra1 < 0 || ra2 < 0 || rb1 < 0 || rb2 < 0) return;
  if (ra1 === ra2 && rb1 === rb2) {
    const hi = Math.max(ra1, rb1);
    const lo = Math.min(ra1, rb1);
    for (let r = lo; r <= hi; r++) out.add(handClass(r, r, false));
    return;
  }
  const suited = a[2]?.toLowerCase() === "s";
  const gapA = Math.abs(ra1 - ra2);
  const gapB = Math.abs(rb1 - rb2);
  if (gapA === gapB) {
    const hiStart = Math.max(ra1, ra2);
    const hiEnd = Math.max(rb1, rb2);
    const lo = Math.min(hiStart, hiEnd);
    const hi = Math.max(hiStart, hiEnd);
    for (let h = lo; h <= hi; h++) {
      out.add(handClass(h, h - gapA, suited));
    }
  }
}

// src/bots/preflopStrength.ts
function highCardPoints(rankIdx2) {
  if (rankIdx2 === 12) return 10;
  if (rankIdx2 === 11) return 8;
  if (rankIdx2 === 10) return 7;
  if (rankIdx2 === 9) return 6;
  return (rankIdx2 + 2) / 2;
}
function chenScore(hi, lo, suited) {
  if (hi === lo) {
    return Math.round(Math.max(highCardPoints(hi) * 2, 5));
  }
  const high = Math.max(hi, lo);
  const low = Math.min(hi, lo);
  let score = highCardPoints(high);
  if (suited) score += 2;
  const gap = high - low - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  if (gap <= 1 && high < 10) score += 1;
  return Math.round(score);
}
var TOTAL_COMBOS = 1326;
var CLASSES = (() => {
  const arr = [];
  for (let hi = 12; hi >= 0; hi--) {
    for (let lo = hi; lo >= 0; lo--) {
      if (hi === lo) {
        arr.push({ cls: handClass(hi, lo, false), score: chenScore(hi, lo, false), combos: 6 });
      } else {
        arr.push({ cls: handClass(hi, lo, true), score: chenScore(hi, lo, true), combos: 4 });
        arr.push({ cls: handClass(hi, lo, false), score: chenScore(hi, lo, false), combos: 12 });
      }
    }
  }
  return arr;
})();
var PERCENTILE = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const ci of CLASSES) {
    let weaker = 0;
    let equal = 0;
    for (const cj of CLASSES) {
      if (cj.score < ci.score) weaker += cj.combos;
      else if (cj.score === ci.score) equal += cj.combos;
    }
    m.set(ci.cls, (weaker + equal / 2) / TOTAL_COMBOS);
  }
  return m;
})();
function classPercentile(cls) {
  return PERCENTILE.get(cls) ?? 0;
}
function handClassOf(hole) {
  const r0 = rankOf(hole[0]);
  const r1 = rankOf(hole[1]);
  const hi = Math.max(r0, r1);
  const lo = Math.min(r0, r1);
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  return handClass(hi, lo, suited);
}
function handPercentile(hole) {
  return classPercentile(handClassOf(hole));
}
var SORTED = [...CLASSES].sort((a, b) => b.score - a.score);

// src/gto/pushfold.ts
var PUSHFOLD_TABLE = [
  {
    bb: 1,
    sbShove: "22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T3o+, 94o+, 84o+, 74o+, 64o+, 53o+, 43o",
    bbCall: "22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 93s+, 83s+, 73s+, 63s+, 53s+, 43s, A2o+, K2o+, Q3o+, J5o+, T6o+, 96o+, 86o+, 75o+, 65o"
  },
  {
    bb: 5,
    sbShove: "22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 86s+, 75s+, 64s+, 53s+, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o",
    bbCall: "22+, A2s+, K7s+, Q9s+, JTs, A7o+, K9o+, QTo+, JTo"
  },
  {
    bb: 8,
    sbShove: "22+, A2s+, K3s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, A2o+, K8o+, Q9o+, JTo",
    bbCall: "44+, A4s+, KTs+, QJs, ATo+, KJo+"
  },
  {
    bb: 10,
    sbShove: "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 98s, 87s, A2o+, K9o+, QTo+, JTo",
    bbCall: "55+, A7s+, KTs+, QJs, ATo+, KQo"
  },
  {
    bb: 15,
    sbShove: "22+, A2s+, K7s+, Q9s+, JTs, T9s, A4o+, K9o+, QTo+",
    bbCall: "77+, ATs+, KJs+, AJo+, KQo"
  },
  {
    bb: 20,
    sbShove: "22+, A2s+, K9s+, QTs+, JTs, A7o+, KTo+, QJo",
    bbCall: "88+, AJs+, KQs, AQo+"
  }
];
function nearestPushFold(bb) {
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
var PUSHFOLD_DEPTHS = PUSHFOLD_TABLE.map((e) => e.bb);

// src/arena/evaluate.ts
function evaluate(cards) {
  const counts = new Int8Array(13);
  const suits = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = c % 13;
    counts[r]++;
    mask |= 1 << r;
    suits[Math.floor(c / 13)] |= 1 << r;
  }
  const ranks = (m) => {
    const a = [];
    for (let r = 12; r >= 0; r--) if (m & 1 << r) a.push(r);
    return a;
  };
  const straight = (m) => {
    for (let r = 12; r >= 4; r--) if ((m & 31 << r - 4) === 31 << r - 4) return r;
    return (m & 4111) === 4111 ? 3 : -1;
  };
  const pack = (cat, rs) => {
    let v = cat;
    for (let i = 0; i < 5; i++) v = v * 13 + (rs[i] ?? 0);
    return v;
  };
  const all = ranks(mask);
  const flush = suits.map(ranks).find((a) => a.length >= 5);
  if (flush) {
    const s2 = straight(suits.find((m) => ranks(m).length >= 5));
    if (s2 >= 0) return pack(8, [s2]);
  }
  const quads = all.filter((r) => counts[r] === 4), trips = all.filter((r) => counts[r] >= 3), pairs = all.filter((r) => counts[r] >= 2);
  if (quads.length) return pack(7, [quads[0], all.find((r) => r !== quads[0])]);
  if (trips.length && pairs.some((r) => r !== trips[0])) return pack(6, [trips[0], pairs.find((r) => r !== trips[0])]);
  if (flush) return pack(5, flush.slice(0, 5));
  const s = straight(mask);
  if (s >= 0) return pack(4, [s]);
  if (trips.length) return pack(3, [trips[0], ...all.filter((r) => r !== trips[0]).slice(0, 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], all.find((r) => !pairs.slice(0, 2).includes(r))]);
  if (pairs.length) return pack(1, [pairs[0], ...all.filter((r) => r !== pairs[0]).slice(0, 3)]);
  return pack(0, all.slice(0, 5));
}

// src/arena/ranges.ts
var HANDS = [];
for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) HANDS.push([a, b]);
var PREFLOP = HANDS.map(handPercentile);
var sigmoid = (x) => 1 / (1 + Math.exp(-x));
function drawStrength(hole, board) {
  if (board.length >= 5) return 0;
  const all = [...hole, ...board];
  let draw = 0;
  for (let suit = 0; suit < 4; suit++) {
    if (all.filter((c) => Math.floor(c / 13) === suit).length === 4 && hole.some((c) => Math.floor(c / 13) === suit)) draw += 0.16;
  }
  const rs = new Set(all.map((c) => c % 13));
  if (rs.has(12)) rs.add(-1);
  for (let lo = -1; lo <= 8; lo++) {
    const n = Array.from({ length: 5 }, (_, i) => lo + i).filter((r) => rs.has(r)).length;
    if (n === 4 && hole.some((c) => c % 13 >= lo && c % 13 < lo + 5)) {
      draw += 0.09;
      break;
    }
  }
  return Math.min(0.23, draw);
}
var RangeBelief = class {
  weights = new Float64Array(HANDS.length).fill(1);
  key = "";
  percentiles = PREFLOP;
  board = [];
  setBoard(board) {
    const key = board.join(",");
    if (key === this.key) return;
    this.key = key;
    this.board = board.slice();
    if (!board.length) {
      this.percentiles = PREFLOP;
      return;
    }
    const dead = new Set(board);
    const scores = HANDS.map(([a, b], i) => ({ i, score: dead.has(a) || dead.has(b) ? -1 : evaluate([a, b, ...board]) }));
    const sorted = scores.filter((x) => x.score >= 0).sort((a, b) => a.score - b.score);
    this.percentiles = new Array(HANDS.length).fill(0);
    for (let start = 0; start < sorted.length; ) {
      let end = start + 1;
      while (end < sorted.length && sorted[end].score === sorted[start].score) end++;
      for (let k = start; k < end; k++) this.percentiles[sorted[k].i] = (start + end) / (2 * sorted.length);
      start = end;
    }
    for (const x of scores) if (x.score < 0) this.weights[x.i] = 0;
  }
  observe(action, sizeToPot, aggression = 0.45) {
    if (action === "fold" || action.startsWith("post_")) return;
    const pre = !this.board.length;
    let max = 0;
    for (let i = 0; i < HANDS.length; i++) {
      if (!this.weights[i]) continue;
      const p = this.percentiles[i], d = pre ? 0 : drawStrength(HANDS[i], this.board);
      let likelihood = 1;
      if (action === "raise" || action === "all_in") {
        const threshold = pre ? sizeToPot > 2 ? 0.9 : 0.48 : 0.68 + Math.min(0.2, sizeToPot * 0.1);
        likelihood = 0.04 + 0.82 * sigmoid((p - threshold) * 13) + d * 1.3 + aggression * 0.16 * (1 - p);
      } else if (action === "call") {
        likelihood = 0.06 + 0.8 * sigmoid((p + d - (pre ? 0.35 + Math.min(0.5, sizeToPot * 0.12) : 0.28 + Math.min(0.5, sizeToPot * 0.22))) * 10);
      } else if (action === "check") likelihood = 0.92 - 0.35 * sigmoid((p - 0.82) * 12);
      this.weights[i] *= likelihood;
      max = Math.max(max, this.weights[i]);
    }
    if (max > 0) for (let i = 0; i < this.weights.length; i++) this.weights[i] /= max;
  }
  combos(dead = []) {
    const blocked = new Set(dead);
    return HANDS.flatMap((cards, i) => this.weights[i] > 0 && !cards.some((c) => blocked.has(c)) ? [{ cards, weight: this.weights[i], strength: this.board.length ? evaluate([...cards, ...this.board]) : PREFLOP[i] }] : []);
  }
};
function sampleRange(combos, count, include) {
  const sorted = combos.slice().sort((a, b) => a.strength - b.strength);
  const total = sorted.reduce((s, c) => s + c.weight, 0);
  if (!total) return [];
  const out = [];
  let j = 0, mass = sorted[0].weight;
  for (let i = 0; i < count; i++) {
    const target = (i + 0.5) * total / count;
    while (mass < target && j < sorted.length - 1) mass += sorted[++j].weight;
    const last = out[out.length - 1];
    if (last && last.cards === sorted[j].cards) last.weight++;
    else out.push({ ...sorted[j], weight: 1 });
  }
  if (include && !out.some((c) => c.cards.includes(include[0]) && c.cards.includes(include[1]))) {
    const actual = sorted.find((c) => c.cards.includes(include[0]) && c.cards.includes(include[1]));
    if (actual) out.push({ ...actual, weight: Math.max(1e-3, actual.weight / total * count) });
  }
  return out;
}

// src/arena/equity.ts
function equity(hole, board, range, rng, samples = 1600, deadline = Infinity) {
  const dead = /* @__PURE__ */ new Set([...hole, ...board]);
  const legal = range.filter((c) => !c.cards.some((x) => dead.has(x)));
  let total = 0;
  const cumulative = legal.map((c) => total += c.weight);
  if (!total) throw new Error("Empty opponent range after card removal");
  if (board.length === 5) {
    const own = evaluate([...hole, ...board]);
    let wins2 = 0;
    for (const c of legal) {
      const s = evaluate([...c.cards, ...board]);
      wins2 += c.weight * (own > s ? 1 : own === s ? 0.5 : 0);
    }
    return wins2 / total;
  }
  const deck = Array.from({ length: 52 }, (_, i) => i).filter((c) => !dead.has(c));
  let wins = 0, n = 0;
  for (; n < samples; n++) {
    if (n >= 128 && n % 64 === 0 && performance.now() > deadline) break;
    const target = rng() * total;
    let lo = 0, hi = legal.length - 1;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const opp = legal[lo].cards, full = board.slice();
    while (full.length < 5) {
      const c = deck[Math.floor(rng() * deck.length)];
      if (!opp.includes(c) && !full.includes(c)) full.push(c);
    }
    const a = evaluate([...hole, ...full]), b = evaluate([...opp, ...full]);
    wins += a > b ? 1 : a === b ? 0.5 : 0;
  }
  return wins / n;
}

// src/arena/river.ts
import { Action } from "@chipzen-ai/bot";

// src/solver/cfr.ts
var WIN = 1;
var LOSE = -1;
var BLOCKED = 2;
function normalize(w) {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i];
  const out = new Float64Array(w.length);
  if (s <= 0) return out;
  for (let i = 0; i < w.length; i++) out[i] = w[i] / s;
  return out;
}
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function solve(input) {
  const started = Date.now();
  const { tree, pot, n0, n1, outcome } = input;
  const iterations = input.iterations ?? 600;
  const prior0 = normalize(input.prior0);
  const prior1 = normalize(input.prior1);
  const nodes = tree.nodes;
  const regrets = nodes.map((nd) => new Float64Array((nd.player === 0 ? n0 : n1) * nd.actions.length));
  const stratSum = nodes.map((nd) => new Float64Array((nd.player === 0 ? n0 : n1) * nd.actions.length));
  function terminalValues(node, r0, r1) {
    const v0 = new Float64Array(n0);
    const v1 = new Float64Array(n1);
    const c0 = node.c0;
    const c1 = node.c1;
    if (!node.showdown) {
      const pay0 = node.folder === 1 ? pot + c1 : -c0;
      const pay1 = node.folder === 1 ? -c1 : pot + c0;
      for (let i = 0; i < n0; i++) {
        let s = 0;
        const base = i * n1;
        for (let j = 0; j < n1; j++) if (outcome[base + j] !== BLOCKED) s += r1[j];
        v0[i] = pay0 * s;
      }
      for (let j = 0; j < n1; j++) {
        let s = 0;
        for (let i = 0; i < n0; i++) if (outcome[i * n1 + j] !== BLOCKED) s += r0[i];
        v1[j] = pay1 * s;
      }
      return { v0, v1 };
    }
    const win0 = pot + c1;
    const lose0 = -c0;
    const split0 = (pot + c1 - c0) / 2;
    const win1 = pot + c0;
    const lose1 = -c1;
    const split1 = (pot + c0 - c1) / 2;
    for (let i = 0; i < n0; i++) {
      let w = 0;
      let t = 0;
      let l = 0;
      const base = i * n1;
      for (let j = 0; j < n1; j++) {
        const o = outcome[base + j];
        if (o === BLOCKED) continue;
        const r = r1[j];
        if (o === WIN) w += r;
        else if (o === LOSE) l += r;
        else t += r;
      }
      v0[i] = w * win0 + l * lose0 + t * split0;
    }
    for (let j = 0; j < n1; j++) {
      let w = 0;
      let t = 0;
      let l = 0;
      for (let i = 0; i < n0; i++) {
        const o = outcome[i * n1 + j];
        if (o === BLOCKED) continue;
        const r = r0[i];
        if (o === LOSE) w += r;
        else if (o === WIN) l += r;
        else t += r;
      }
      v1[j] = w * win1 + l * lose1 + t * split1;
    }
    return { v0, v1 };
  }
  function currentStrategy(node) {
    const n = node.player === 0 ? n0 : n1;
    const A = node.actions.length;
    const reg = regrets[node.id];
    const sigma = new Float64Array(n * A);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let a = 0; a < A; a++) {
        const r = reg[i * A + a];
        if (r > 0) sum += r;
      }
      if (sum > 0) {
        for (let a = 0; a < A; a++) {
          const r = reg[i * A + a];
          sigma[i * A + a] = r > 0 ? r / sum : 0;
        }
      } else {
        for (let a = 0; a < A; a++) sigma[i * A + a] = 1 / A;
      }
    }
    return sigma;
  }
  function traverse(node, r0, r1) {
    if (node.kind === "terminal") return terminalValues(node, r0, r1);
    const p = node.player;
    const n = p === 0 ? n0 : n1;
    const A = node.actions.length;
    const reach = p === 0 ? r0 : r1;
    const sigma = currentStrategy(node);
    const childOwn = [];
    const vOther = new Float64Array(p === 0 ? n1 : n0);
    for (let a = 0; a < A; a++) {
      const scaled = new Float64Array(n);
      for (let i = 0; i < n; i++) scaled[i] = reach[i] * sigma[i * A + a];
      const res = traverse(node.children[a], p === 0 ? scaled : r0, p === 0 ? r1 : scaled);
      childOwn.push(p === 0 ? res.v0 : res.v1);
      const other = p === 0 ? res.v1 : res.v0;
      for (let k = 0; k < vOther.length; k++) vOther[k] += other[k];
    }
    const vOwn = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let a = 0; a < A; a++) v += sigma[i * A + a] * childOwn[a][i];
      vOwn[i] = v;
    }
    const reg = regrets[node.id];
    const ss = stratSum[node.id];
    for (let i = 0; i < n; i++) {
      const w = reach[i];
      for (let a = 0; a < A; a++) {
        reg[i * A + a] += childOwn[a][i] - vOwn[i];
        ss[i * A + a] += w * sigma[i * A + a];
      }
    }
    return p === 0 ? { v0: vOwn, v1: vOther } : { v0: vOther, v1: vOwn };
  }
  for (let it = 0; it < iterations; it++) {
    traverse(tree.root, Float64Array.from(prior0), Float64Array.from(prior1));
  }
  const strategy = nodes.map((nd) => {
    const n = nd.player === 0 ? n0 : n1;
    const A = nd.actions.length;
    const ss = stratSum[nd.id];
    const out = new Float64Array(n * A);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let a = 0; a < A; a++) sum += ss[i * A + a];
      for (let a = 0; a < A; a++) out[i * A + a] = sum > 0 ? ss[i * A + a] / sum : 1 / A;
    }
    return out;
  });
  function evaluate2(node, r0, r1) {
    if (node.kind === "terminal") return terminalValues(node, r0, r1);
    const p = node.player;
    const n = p === 0 ? n0 : n1;
    const A = node.actions.length;
    const reach = p === 0 ? r0 : r1;
    const sigma = strategy[node.id];
    const vOwn = new Float64Array(n);
    const vOther = new Float64Array(p === 0 ? n1 : n0);
    for (let a = 0; a < A; a++) {
      const scaled = new Float64Array(n);
      for (let i = 0; i < n; i++) scaled[i] = reach[i] * sigma[i * A + a];
      const res = evaluate2(node.children[a], p === 0 ? scaled : r0, p === 0 ? r1 : scaled);
      const own = p === 0 ? res.v0 : res.v1;
      const other = p === 0 ? res.v1 : res.v0;
      for (let i = 0; i < n; i++) vOwn[i] += sigma[i * A + a] * own[i];
      for (let k = 0; k < vOther.length; k++) vOther[k] += other[k];
    }
    return p === 0 ? { v0: vOwn, v1: vOther } : { v0: vOther, v1: vOwn };
  }
  function bestResponse(node, r0, r1, br) {
    if (node.kind === "terminal") {
      const res = terminalValues(node, r0, r1);
      return br === 0 ? res.v0 : res.v1;
    }
    const p = node.player;
    const A = node.actions.length;
    if (p === br) {
      const n2 = br === 0 ? n0 : n1;
      const best = new Float64Array(n2).fill(-Infinity);
      for (let a = 0; a < A; a++) {
        const child = bestResponse(node.children[a], r0, r1, br);
        for (let i = 0; i < n2; i++) if (child[i] > best[i]) best[i] = child[i];
      }
      return best;
    }
    const n = p === 0 ? n0 : n1;
    const reach = p === 0 ? r0 : r1;
    const sigma = strategy[node.id];
    const acc = new Float64Array(br === 0 ? n0 : n1);
    for (let a = 0; a < A; a++) {
      const scaled = new Float64Array(n);
      for (let i = 0; i < n; i++) scaled[i] = reach[i] * sigma[i * A + a];
      const child = bestResponse(node.children[a], p === 0 ? scaled : r0, p === 0 ? r1 : scaled, br);
      for (let k = 0; k < acc.length; k++) acc[k] += child[k];
    }
    return acc;
  }
  let mass = 0;
  for (let i = 0; i < n0; i++) {
    const base = i * n1;
    for (let j = 0; j < n1; j++) if (outcome[base + j] !== BLOCKED) mass += prior0[i] * prior1[j];
  }
  const evRes = evaluate2(tree.root, Float64Array.from(prior0), Float64Array.from(prior1));
  const ev0 = mass > 0 ? dot(prior0, evRes.v0) / mass : 0;
  const ev1 = mass > 0 ? dot(prior1, evRes.v1) / mass : 0;
  const br0 = dot(prior0, bestResponse(tree.root, Float64Array.from(prior0), Float64Array.from(prior1), 0));
  const br1 = dot(prior1, bestResponse(tree.root, Float64Array.from(prior0), Float64Array.from(prior1), 1));
  const total = pot * mass;
  const exploitability = total > 0 ? Math.max(0, br0 + br1 - total) / total : 0;
  return { strategy, ev0, ev1, exploitability, iterations, ms: Date.now() - started };
}

// src/arena/river.ts
function riverTree(s, committed) {
  const nodes = [];
  const owed = s.toCall, base = s.pot - owed;
  const cap = Math.min(s.yourStack, s.opponentStacks[0] + owed);
  const terminal = (c0, c1, folder) => ({ kind: "terminal", showdown: folder === void 0, folder, c0, c1 });
  const increment = Math.max(1, owed, s.minRaise - committed - owed);
  function node(p, c0, c1, checked, depth, lastRaise, root = false) {
    const own = p === 0 ? c0 : c1, opp = p === 0 ? c1 : c0, call = opp - own;
    const nd = { kind: "decision", id: nodes.length, player: p, c0, c1, path: [], actions: [], children: [] };
    nodes.push(nd);
    const add = (kind, to, child) => {
      nd.actions.push({ kind, to, add: to - own, label: `${kind} ${to}` });
      nd.children.push(child());
    };
    if (call > 0) {
      add("fold", own, () => terminal(c0, c1, p));
      add("call", opp, () => terminal(opp, opp));
    } else {
      add("check", own, () => checked || root && s.yourSeat === s.dealerSeat ? terminal(c0, c1) : node(1 - p, c0, c1, true, depth, lastRaise));
    }
    const canRaise = root ? s.validActions.includes("raise") || s.validActions.includes("all_in") : true;
    if (canRaise && depth < 2 && opp < cap && own < cap) {
      const minimum = root ? Math.max(opp + 1, s.minRaise - committed) : opp + Math.max(lastRaise, 1);
      const maximum = root ? Math.min(cap, s.maxRaise > 0 ? s.maxRaise - committed : cap) : cap;
      const sizes = [...new Set([0.5, 1].map((f) => Math.round(opp + (base + 2 * opp) * f)).concat(cap).map((x) => Math.min(maximum, Math.max(minimum, x))))].filter((x) => x > opp && x <= maximum && (x >= minimum || x === cap));
      for (const to of sizes) add(call > 0 ? "raise" : "bet", to, () => node(1 - p, p === 0 ? to : c0, p === 1 ? to : c1, false, depth + 1, to - opp));
    }
    return nd;
  }
  return { root: node(0, 0, owed, false, 0, increment, true), nodes };
}
function solveRiver(s, committed, hole, ownRange, opponentRange, rng) {
  if (s.toCall > s.yourStack || s.pot <= s.toCall || s.opponentStacks.length !== 1) return null;
  const own = sampleRange(ownRange, 36, hole), opp = sampleRange(opponentRange, 36);
  const index = own.findIndex((c) => c.cards.includes(hole[0]) && c.cards.includes(hole[1]));
  if (index < 0 || !opp.length) return null;
  const outcome = new Int8Array(own.length * opp.length);
  let compatible = 0;
  for (let i = 0; i < own.length; i++) for (let j = 0; j < opp.length; j++) {
    const a = own[i], b = opp[j], blocked = a.cards.some((c) => b.cards.includes(c));
    outcome[i * opp.length + j] = blocked ? BLOCKED : a.strength > b.strength ? 1 : a.strength < b.strength ? -1 : 0;
    if (i === index && !blocked) compatible++;
  }
  if (!compatible) return null;
  const tree = riverTree(s, committed);
  const result = solve({
    tree,
    pot: s.pot - s.toCall,
    n0: own.length,
    n1: opp.length,
    prior0: Float64Array.from(own.map((c) => c.weight)),
    prior1: Float64Array.from(opp.map((c) => c.weight)),
    outcome,
    iterations: 100
  });
  const root = tree.root, A = root.actions.length;
  let u = rng();
  let chosen = root.actions[A - 1];
  for (let a = 0; a < A; a++) {
    u -= result.strategy[root.id][index * A + a];
    if (u <= 0) {
      chosen = root.actions[a];
      break;
    }
  }
  if (chosen.kind === "check") return Action.check();
  if (chosen.kind === "fold") return Action.fold();
  if (chosen.kind === "call") return Action.call();
  const to = committed + chosen.to;
  if (s.validActions.includes("raise")) return Action.raiseTo(to);
  return s.validActions.includes("all_in") && to >= committed + s.yourStack ? Action.allIn() : null;
}

// src/arena/bot.ts
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
var ArenaBot = class extends Bot {
  own = new RangeBelief();
  opponent = new RangeBelief();
  seat = 0;
  matchId = "";
  seatKnown = false;
  dealer = 0;
  dealerKnown = false;
  board = [];
  phase = "preflop";
  committed = [0, 0];
  pot = 0;
  bb = 100;
  hand = -1;
  preRaises = 0;
  lastAggressor = -1;
  observations = 0;
  folds = 0;
  facing = 0;
  aggressions = 0;
  decisions = 0;
  preflopHands = 0;
  jamHands = 0;
  countedPreflop = false;
  countedJam = false;
  rng;
  options;
  lastDecision = null;
  constructor(options = {}) {
    super();
    this.options = options;
    this.rng = options.rng ?? Math.random;
  }
  onMatchStart(info) {
    this.matchId = String(info.match_id ?? "");
    const cfg = info.game_config ?? {};
    this.bb = Number(cfg.big_blind ?? 100);
    const seats = info.seats;
    const self = seats?.find((s) => s.is_self);
    this.seatKnown = self !== void 0;
    this.seat = self?.seat ?? 0;
    this.dealerKnown = false;
    this.observations = this.folds = this.facing = this.aggressions = this.decisions = 0;
    this.preflopHands = this.jamHands = 0;
    this.hand = -1;
  }
  onRoundStart(message) {
    const state = message.state ?? {};
    this.resetHand(Number(state.hand_number ?? 0));
    if (typeof state.dealer_seat === "number") {
      this.dealer = state.dealer_seat;
      this.dealerKnown = true;
    }
    const stacks = state.stacks, after = state.post_blind_stacks;
    if (stacks && after) {
      this.committed = stacks.map((v, i) => v - after[i]);
      this.bb = Math.max(...this.committed, 1);
    } else {
      const dealer = Number(state.dealer_seat ?? 0);
      this.committed = [0, 1].map((i) => i === dealer ? this.bb / 2 : this.bb);
    }
    this.pot = Number(state.pot ?? this.committed.reduce((a, b) => a + b, 0));
  }
  // The SDK restores the snapshot and pending turn. Old range beliefs must not
  // survive a reconnect with a potentially different hand or missed actions.
  onReconnected(message) {
    this.onMatchStart(message);
    const state = message.state ?? {};
    this.resetHand(Number(state.hand_number ?? -1));
    if (typeof state.dealer_seat === "number") {
      this.dealer = state.dealer_seat;
      this.dealerKnown = true;
    }
    this.setBoard((state.board ?? []).map(parseCard), String(state.phase ?? "preflop"));
    this.pot = Number(state.pot ?? 0);
  }
  resetHand(n) {
    this.hand = n;
    this.own = new RangeBelief();
    this.opponent = new RangeBelief();
    this.board = [];
    this.phase = "preflop";
    this.committed = [0, 0];
    this.preRaises = 0;
    this.lastAggressor = -1;
    this.countedPreflop = this.countedJam = false;
  }
  setBoard(board, phase) {
    if (phase !== this.phase) this.committed = [0, 0];
    this.phase = phase;
    this.board = board;
    this.own.setBoard(board);
    this.opponent.setBoard(board);
  }
  onPhaseChange(message) {
    const state = message.state ?? {};
    this.setBoard((state.board ?? []).map(parseCard), String(state.phase ?? "flop"));
  }
  onTurnResult(message) {
    const d = message.details ?? {};
    const seat = Number(message.seat ?? d.seat), action = String(d.action ?? ""), amount = Number(d.amount ?? 0);
    if (!Number.isInteger(seat) || seat < 0 || seat > 1) return;
    const old = this.committed[seat];
    const owed = Math.max(...this.committed) - old;
    const timedOut = Boolean(message.is_timeout ?? d.is_timeout);
    if (!timedOut) {
      if (seat !== this.seat) {
        this.observations++;
        this.decisions++;
        if (!this.board.length) {
          if (!this.countedPreflop) {
            this.preflopHands++;
            this.countedPreflop = true;
          }
          const stacks = d.stacks;
          if (!this.countedJam && (action === "all_in" || action === "raise" && stacks?.[seat] === 0)) {
            this.jamHands++;
            this.countedJam = true;
          }
        }
        if (owed > 0) {
          this.facing++;
          if (action === "fold") this.folds++;
        }
        if (action === "raise" || action === "all_in") this.aggressions++;
      }
      (seat === this.seat ? this.own : this.opponent).observe(action, amount / Math.max(this.pot, this.bb), this.aggression());
    }
    if (action === "raise" || action === "all_in") {
      this.committed[seat] = amount;
      this.lastAggressor = seat;
      if (!this.board.length) this.preRaises++;
    } else if (action === "call" || action.startsWith("post_")) this.committed[seat] += amount;
    this.pot = Number(d.pot ?? this.pot + this.committed[seat] - old);
  }
  aggression() {
    return (this.aggressions + 9) / (this.decisions + 20);
  }
  foldRate() {
    return (this.folds + 10) / (this.facing + 24);
  }
  onMatchEnd(results) {
    const rows = Array.isArray(results) ? results : Array.isArray(results.results) ? results.results : [];
    const own = rows.find((row) => row.seat === this.seat);
    if (this.options.log) console.log(JSON.stringify({
      type: "match_end",
      match: this.matchId,
      seat: this.seat,
      finalStack: own?.final_stack,
      netChips: own?.net_chips,
      errorCount: Array.isArray(own?.bot_errors) ? own.bot_errors.length : void 0
    }));
  }
  decide(input) {
    const started = performance.now();
    const blindButton = input.actionHistory.find((a) => a.action === "post_small_blind")?.seat;
    const s = {
      ...input,
      yourSeat: this.seatKnown ? this.seat : input.yourSeat,
      dealerSeat: blindButton ?? (this.dealerKnown ? this.dealer : input.dealerSeat)
    };
    if (s.opponentStacks.length !== 1) throw new Error("ArenaBot supports heads-up only");
    if (this.hand !== s.handNumber) this.resetHand(s.handNumber);
    this.seat = s.yourSeat;
    const hole = s.holeCards.map((c) => parseCard(c.rank + c.suit));
    const board = s.board.map((c) => parseCard(c.rank + c.suit));
    if (hole.length !== 2 || ![0, 3, 4, 5].includes(board.length) || (/* @__PURE__ */ new Set([...hole, ...board])).size !== hole.length + board.length) throw new Error("Invalid cards");
    this.setBoard(board, s.phase);
    const ownCommitted = s.maxRaise > 0 ? Math.max(0, s.maxRaise - s.yourStack) : this.committed[this.seat];
    this.committed[this.seat] = ownCommitted;
    this.committed[1 - this.seat] = ownCommitted + s.toCall;
    const blind = s.actionHistory.find((a) => a.action === "post_big_blind")?.amount;
    if (blind && blind > 0) this.bb = blind;
    this.pot = s.pot;
    let method = "preflop", eq;
    let action;
    if (!board.length) action = this.preflop(s, hole, ownCommitted);
    else {
      const range = this.opponent.combos(hole);
      eq = equity(hole, board, range, this.rng, this.options.samples ?? 1800, started + 400);
      const river = board.length === 5 && this.options.river !== false ? solveRiver(s, ownCommitted, hole, this.own.combos(), this.opponent.combos(), this.rng) : null;
      method = river ? "river-cfr" : "range-equity";
      action = river ?? this.postflop(s, hole, eq, ownCommitted);
    }
    action = legalize(s, action);
    this.lastDecision = { ms: performance.now() - started, method, equity: eq, action: action.action };
    if (this.options.log) console.log(JSON.stringify({ type: "decision", match: this.matchId, hand: s.handNumber, phase: s.phase, ...this.lastDecision, amount: action.amount }));
    return action;
  }
  preflop(s, hole, committed) {
    const pct = handPercentile(hole), cls = handClassOf(hole);
    const effective = Math.min(s.yourStack + committed, s.opponentStacks[0] + committed + s.toCall) / this.bb;
    const button = s.yourSeat === s.dealerSeat;
    const raises = Math.max(this.preRaises, s.actionHistory.filter((a) => a.action === "raise" || a.action === "all_in").length);
    const premium = parseRange("QQ+, AKs, AKo").has(cls);
    if (effective <= 10 && button && raises === 0) {
      return parseRange(nearestPushFold(effective).sbShove).has(cls) ? this.raise(s, committed + s.yourStack) : Action2.fold();
    }
    const facingJam = s.opponentStacks[0] === 0 && s.toCall > 0;
    if (facingJam) {
      const baseline = effective <= 10 ? 0.45 : effective <= 25 ? 0.18 : 0.055;
      const fraction = Math.max(baseline, this.preflopHands >= 8 ? Math.min(0.95, (this.jamHands + 1) / (this.preflopHands + 15)) : 0);
      const belief = new RangeBelief();
      const combos = belief.combos(hole);
      for (const c of combos) c.weight = handPercentile(c.cards) >= 1 - fraction ? 1 : 0.025;
      const eq = equity(hole, [], combos, this.rng, this.options.samples ?? 1800, performance.now() + 350);
      const call = Math.min(s.toCall, s.yourStack), contestable = s.pot - Math.max(0, s.toCall - s.yourStack);
      return eq > call / (contestable + call) + 0.015 ? Action2.call() : Action2.fold();
    }
    if (raises === 0) {
      if (button) {
        const open = pct >= 0.2 || this.foldRate() > 0.56 && this.observations > 30;
        return open ? this.raise(s, Math.round(this.bb * (effective < 25 ? 2 : 2.25))) : Action2.fold();
      }
      if (pct > 0.62 || pct > 0.4 && this.rng() < 0.18) return this.raise(s, this.bb * 4);
      return Action2.check();
    }
    if (premium || pct > 0.91 && raises <= 1 || raises === 1 && cls.endsWith("s") && cls.startsWith("A") && pct < 0.78 && this.rng() < 0.12) {
      const target = Math.round((committed + s.toCall) * (button ? 3 : 3.6));
      return this.raise(s, effective < 23 || target > (committed + s.yourStack) * 0.38 ? committed + s.yourStack : target);
    }
    const price = s.toCall / Math.max(1, s.pot + s.toCall);
    const threshold = raises >= 3 ? 0.96 : raises === 2 ? 0.8 : clamp(0.22 + price * 0.85 + (!button ? 0.04 : 0), 0.28, 0.83);
    return pct >= threshold ? Action2.call() : s.toCall === 0 ? Action2.check() : Action2.fold();
  }
  raise(s, amount) {
    return legalize(s, Action2.raiseTo(amount));
  }
  postflop(s, hole, eq, committed) {
    const call = Math.min(s.toCall, s.yourStack), contestable = s.pot - Math.max(0, s.toCall - s.yourStack);
    const price = call / Math.max(1, contestable + call);
    const ip = s.yourSeat === s.dealerSeat, draw = drawStrength(hole, this.board);
    const effective = Math.min(s.yourStack, s.opponentStacks[0] + call);
    const spr = effective / Math.max(s.pot, 1);
    const fold = this.foldRate();
    if (call > 0) {
      const valueThreshold = spr < 1 ? 0.65 : 0.77;
      if (eq > valueThreshold && this.rng() < 0.8) return this.raise(s, committed + call + Math.round((s.pot + call) * (eq > 0.9 ? 0.9 : 0.65)));
      if (draw > 0.15 && eq > 0.3 && fold > 0.52 && spr > 1.5 && this.rng() < 0.15) return this.raise(s, committed + call + Math.round((s.pot + call) * 0.8));
      const realization = this.board.length === 5 ? 1 : ip ? 0.96 : 0.88;
      return eq * realization >= price + (this.board.length === 5 ? 0 : 0.015) ? Action2.call() : Action2.fold();
    }
    const value = eq > (this.board.length === 5 ? 0.6 : 0.63);
    const initiative = this.lastAggressor === s.yourSeat;
    const bluffChance = clamp((initiative ? 0.22 : ip ? 0.16 : 0.07) + (fold - 0.42) * 0.5 + draw * 0.5, 0.02, 0.36);
    if (value || eq < 0.48 && this.rng() < bluffChance) {
      const fraction = eq > 0.83 ? 0.9 : eq > 0.68 ? 0.65 : 0.4;
      const bet = Math.max(this.bb, Math.round(s.pot * fraction));
      return this.raise(s, committed + (spr < 1.2 && eq > 0.68 ? effective : bet));
    }
    return Action2.check();
  }
};
function legalize(s, action) {
  if (action.action === "fold" && s.validActions.includes("check")) return Action2.check();
  if (action.action === "raise") {
    if (s.validActions.includes("raise") && s.maxRaise >= s.minRaise && s.maxRaise > 0) {
      return Action2.raiseTo(clamp(Math.round(action.amount), s.minRaise, s.maxRaise));
    }
    if (s.validActions.includes("all_in") && action.amount >= s.yourStack) return Action2.allIn();
    if (s.validActions.includes("call") && action.amount >= Math.min(s.toCall, s.yourStack)) return Action2.call();
  } else if (s.validActions.includes(action.action)) return action;
  if (s.validActions.includes("check")) return Action2.check();
  if (s.validActions.includes("fold")) return Action2.fold();
  if (s.validActions.includes("call")) return Action2.call();
  if (s.validActions.includes("all_in")) return Action2.allIn();
  if (s.validActions.includes("raise")) return Action2.raiseTo(s.minRaise);
  throw new Error("Server provided no legal actions");
}
export {
  ArenaBot,
  legalize
};
