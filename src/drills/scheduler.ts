// Spaced repetition for drills, Leitner-style. The unit of repetition is the
// drill TYPE (drills are generated, so "the same question" means the same
// skill). Miss a type and it re-enters the queue; answer it correctly at
// growing intervals to graduate it out.
//
// Intervals are counted in answered drills, not wall time — study sessions are
// bursty, and "come back after N questions" works within and across sessions.

import { DrillCategory } from './types';

// A missed type must be answered correctly at these gaps to graduate:
// first review after 2 drills, then 8, then 20 — three rights and it's out.
export const REVIEW_GAPS = [2, 8, 20] as const;

export interface ReviewEntry {
  dueAt: number; // seq index at which this type is due again
  box: number; // 0..REVIEW_GAPS.length-1 — how far along graduation it is
}

export interface SchedulerState {
  seq: number; // total drills answered (the clock)
  due: Record<string, ReviewEntry>; // typeId -> review entry
}

export const EMPTY_SCHEDULER: SchedulerState = { seq: 0, due: {} };

// Record an answered drill. Wrong answers (re)enter the review queue at box 0;
// correct answers on a queued type move it up a box or graduate it out.
export function recordAnswer(state: SchedulerState, typeId: string, correct: boolean): SchedulerState {
  const seq = state.seq + 1;
  const due = { ...state.due };

  if (!correct) {
    due[typeId] = { dueAt: seq + REVIEW_GAPS[0], box: 0 };
  } else if (due[typeId]) {
    const nextBox = due[typeId].box + 1;
    if (nextBox >= REVIEW_GAPS.length) {
      delete due[typeId]; // graduated
    } else {
      due[typeId] = { dueAt: seq + REVIEW_GAPS[nextBox], box: nextBox };
    }
  }

  return { seq, due };
}

// The type to review now, if any is due (oldest debt first). `allowed`
// restricts to the active category's type ids.
export function dueType(state: SchedulerState, allowed: string[]): string | null {
  let best: string | null = null;
  let bestAt = Infinity;
  for (const [typeId, entry] of Object.entries(state.due)) {
    if (!allowed.includes(typeId)) continue;
    if (entry.dueAt <= state.seq && entry.dueAt < bestAt) {
      best = typeId;
      bestAt = entry.dueAt;
    }
  }
  return best;
}

// How many types are queued for review (for a UI badge).
export function reviewCount(state: SchedulerState): number {
  return Object.keys(state.due).length;
}

export type { DrillCategory };
