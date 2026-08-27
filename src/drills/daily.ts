// The Daily: one recorded hand per calendar day, the same for every player.
// Everything derives from the day number, so picking the hand needs no
// backend — determinism IS the infrastructure. (The optional community vote
// split lives in lib/dailyVotes.ts.)

// Daily #1 = 1 July 2026 (local calendar date, like Wordle's local midnight).
const EPOCH = { y: 2026, m: 6, d: 1 }; // month is 0-indexed

export function dailyNumber(now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epoch = new Date(EPOCH.y, EPOCH.m, EPOCH.d);
  return Math.max(1, Math.floor((today.getTime() - epoch.getTime()) / 86_400_000) + 1);
}

// --- Streak ------------------------------------------------------------------

export interface DailyStreak {
  current: number;
  best: number;
  lastSolvedDay: number; // 0 = never
}

export const EMPTY_STREAK: DailyStreak = { current: 0, best: 0, lastSolvedDay: 0 };

// Called once when the player solves day `n`. Consecutive days extend the
// streak; any gap restarts it at 1.
export function nextStreak(prev: DailyStreak, day: number): DailyStreak {
  if (prev.lastSolvedDay === day) return prev; // already counted
  const current = prev.lastSolvedDay === day - 1 ? prev.current + 1 : 1;
  return { current, best: Math.max(prev.best, current), lastSolvedDay: day };
}

// --- Share text ---------------------------------------------------------------

/** e.g. "♠ Fold Call Jam №58 ✅ matched the table (62% agreed)" + url. */
export function shareText(day: number, matched: boolean, agreePct: number | null, url: string): string {
  const verdict = matched ? '✅ matched the table' : '❌ went my own way';
  const agree = agreePct !== null ? ` (${agreePct}% agreed with me)` : '';
  return `♠ Fold Call Jam №${day} ${verdict}${agree}
${url}`;
}
