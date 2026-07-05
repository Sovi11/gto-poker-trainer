import { describe, it, expect } from 'vitest';
import { EMPTY_SCHEDULER, recordAnswer, dueType, reviewCount, REVIEW_GAPS, SchedulerState } from './scheduler';

const ALL = ['pot-odds', 'mdf', 'alpha', 'rfi-open'];

// Answer `n` filler drills correctly (a type not under review) to advance the clock.
function tick(state: SchedulerState, n: number): SchedulerState {
  let s = state;
  for (let i = 0; i < n; i++) s = recordAnswer(s, 'filler', true);
  return s;
}

describe('recordAnswer', () => {
  it('a wrong answer queues the type for review after the first gap', () => {
    const s = recordAnswer(EMPTY_SCHEDULER, 'pot-odds', false);
    expect(s.due['pot-odds']).toEqual({ dueAt: 1 + REVIEW_GAPS[0], box: 0 });
    expect(reviewCount(s)).toBe(1);
  });

  it('a correct answer on an unqueued type changes nothing but the clock', () => {
    const s = recordAnswer(EMPTY_SCHEDULER, 'pot-odds', true);
    expect(s.seq).toBe(1);
    expect(reviewCount(s)).toBe(0);
  });

  it('three correct reviews graduate a type out of the queue', () => {
    let s = recordAnswer(EMPTY_SCHEDULER, 'mdf', false); // box 0
    s = recordAnswer(s, 'mdf', true); // -> box 1
    expect(s.due['mdf'].box).toBe(1);
    s = recordAnswer(s, 'mdf', true); // -> box 2
    expect(s.due['mdf'].box).toBe(2);
    s = recordAnswer(s, 'mdf', true); // graduated
    expect(s.due['mdf']).toBeUndefined();
    expect(reviewCount(s)).toBe(0);
  });

  it('missing a review resets the type to box 0', () => {
    let s = recordAnswer(EMPTY_SCHEDULER, 'mdf', false);
    s = recordAnswer(s, 'mdf', true); // box 1
    s = recordAnswer(s, 'mdf', false); // wrong again -> box 0
    expect(s.due['mdf'].box).toBe(0);
  });
});

describe('dueType', () => {
  it('is null before the gap elapses, then surfaces the type', () => {
    let s = recordAnswer(EMPTY_SCHEDULER, 'pot-odds', false); // due at seq 3
    expect(dueType(s, ALL)).toBeNull(); // seq 1
    s = tick(s, REVIEW_GAPS[0]);
    expect(dueType(s, ALL)).toBe('pot-odds');
  });

  it('respects the category filter', () => {
    let s = recordAnswer(EMPTY_SCHEDULER, 'pot-odds', false);
    s = tick(s, REVIEW_GAPS[0]);
    expect(dueType(s, ['rfi-open'])).toBeNull(); // pot-odds not in the allowed set
    expect(dueType(s, ALL)).toBe('pot-odds');
  });

  it('surfaces the longest-overdue type first', () => {
    let s = recordAnswer(EMPTY_SCHEDULER, 'alpha', false);
    s = tick(s, 1);
    s = recordAnswer(s, 'mdf', false);
    s = tick(s, 10); // both overdue; alpha has the earlier dueAt
    expect(dueType(s, ALL)).toBe('alpha');
  });
});
