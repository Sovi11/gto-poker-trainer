// The Daily Puzzle: one deterministic drill per calendar day, the same for
// every player, with Wordle-style guess feedback and an emoji share grid.
// Everything derives from the day number, so there is no backend and no sync —
// determinism IS the infrastructure.

import { mulberry32 } from '../engine/cards';
import { Drill, DRILL_TYPES } from './types';

// Daily #1 = 1 July 2026 (local calendar date, like Wordle's local midnight).
const EPOCH = { y: 2026, m: 6, d: 1 }; // month is 0-indexed

export function dailyNumber(now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epoch = new Date(EPOCH.y, EPOCH.m, EPOCH.d);
  return Math.max(1, Math.floor((today.getTime() - epoch.getTime()) / 86_400_000) + 1);
}

// Rotate through every drill type so consecutive days never repeat a format,
// then seed the generator from the day so the numbers/cards are fixed too.
export function dailyDrill(n: number): Drill {
  const type = DRILL_TYPES[(n - 1) % DRILL_TYPES.length];
  const rng = mulberry32((n * 2654435761) >>> 0);
  return type.generate(rng);
}

// --- Guess mechanics ---------------------------------------------------------

export const MAX_NUMBER_GUESSES = 4;

export type NumberFeedback = 'correct' | 'higher' | 'lower';

export function judgeNumberGuess(guess: number, correct: number, tolerance: number): NumberFeedback {
  if (Math.abs(guess - correct) <= tolerance) return 'correct';
  return guess < correct ? 'higher' : 'lower';
}

// One entry per guess: hit or miss (misses carry the direction hint for numbers).
export interface GuessRecord {
  label: string; // what the player guessed (option text or number)
  hit: boolean;
  hint?: NumberFeedback;
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

// --- Share grid ----------------------------------------------------------------

export function shareText(day: number, guesses: GuessRecord[], solved: boolean, maxGuesses: number, url: string): string {
  const grid = guesses.map((g) => (g.hit ? '🟩' : '🟥')).join('');
  const score = solved ? `${guesses.length}` : 'X';
  return `♠ Fold Call Jam №${day} ${score}/${maxGuesses}\n${grid}\n${url}`;
}
