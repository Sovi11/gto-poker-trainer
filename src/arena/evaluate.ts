// Direct 5–7-card evaluator, with the trainer's score encoding. Avoids the
// 21 five-card evaluations per Monte Carlo sample in evaluateBest().
export function evaluate(cards: readonly number[]): number {
  const counts = new Int8Array(13);
  const suits = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) { const r = c % 13; counts[r]++; mask |= 1 << r; suits[Math.floor(c / 13)] |= 1 << r; }
  const ranks = (m: number) => { const a: number[] = []; for (let r = 12; r >= 0; r--) if (m & (1 << r)) a.push(r); return a; };
  const straight = (m: number) => {
    for (let r = 12; r >= 4; r--) if ((m & (31 << (r - 4))) === (31 << (r - 4))) return r;
    return (m & 4111) === 4111 ? 3 : -1;
  };
  const pack = (cat: number, rs: number[]) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 13 + (rs[i] ?? 0); return v; };
  const all = ranks(mask);
  const flush = suits.map(ranks).find(a => a.length >= 5);
  if (flush) { const s = straight(suits.find(m => ranks(m).length >= 5)!); if (s >= 0) return pack(8, [s]); }
  const quads = all.filter(r => counts[r] === 4), trips = all.filter(r => counts[r] >= 3), pairs = all.filter(r => counts[r] >= 2);
  if (quads.length) return pack(7, [quads[0], all.find(r => r !== quads[0])!]);
  if (trips.length && pairs.some(r => r !== trips[0])) return pack(6, [trips[0], pairs.find(r => r !== trips[0])!]);
  if (flush) return pack(5, flush.slice(0, 5));
  const s = straight(mask); if (s >= 0) return pack(4, [s]);
  if (trips.length) return pack(3, [trips[0], ...all.filter(r => r !== trips[0]).slice(0, 2)]);
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], all.find(r => !pairs.slice(0, 2).includes(r))!]);
  if (pairs.length) return pack(1, [pairs[0], ...all.filter(r => r !== pairs[0]).slice(0, 3)]);
  return pack(0, all.slice(0, 5));
}
