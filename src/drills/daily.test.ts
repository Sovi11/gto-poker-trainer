import { describe, it, expect } from 'vitest';
import {
  dailyNumber,
  dailyDrill,
  judgeNumberGuess,
  nextStreak,
  shareText,
  EMPTY_STREAK,
  GuessRecord,
} from './daily';
import { DRILL_TYPES } from './types';

describe('dailyNumber', () => {
  it('epoch day is #1 and consecutive days increment by 1', () => {
    expect(dailyNumber(new Date(2026, 6, 1, 12, 0))).toBe(1);
    expect(dailyNumber(new Date(2026, 6, 2, 0, 1))).toBe(2);
    expect(dailyNumber(new Date(2026, 6, 31, 23, 59))).toBe(31);
  });

  it('never goes below 1 (pre-epoch clock skew)', () => {
    expect(dailyNumber(new Date(2020, 0, 1))).toBe(1);
  });

  it('is constant across one calendar day regardless of time', () => {
    expect(dailyNumber(new Date(2026, 6, 5, 0, 0, 1))).toBe(dailyNumber(new Date(2026, 6, 5, 23, 59, 59)));
  });
});

describe('dailyDrill', () => {
  it('is fully deterministic: same day → identical drill', () => {
    for (const n of [1, 7, 42, 365]) {
      expect(JSON.stringify(dailyDrill(n))).toBe(JSON.stringify(dailyDrill(n)));
    }
  });

  it('rotates through every drill type before repeating a format', () => {
    const types = new Set<string>();
    for (let n = 1; n <= DRILL_TYPES.length; n++) types.add(dailyDrill(n).typeId);
    expect(types.size).toBe(DRILL_TYPES.length);
  });

  it('produces a valid drill for a year of days', () => {
    for (let n = 1; n <= 365; n++) {
      const d = dailyDrill(n);
      expect(d.prompt.length).toBeGreaterThan(0);
      if (d.input.kind === 'choice') {
        expect(d.input.correct).toBeGreaterThanOrEqual(0);
        expect(d.input.correct).toBeLessThan(d.input.choices.length);
      } else {
        expect(Number.isFinite(d.input.correct)).toBe(true);
      }
    }
  });
});

describe('judgeNumberGuess', () => {
  it('grades within tolerance as correct and hints direction otherwise', () => {
    expect(judgeNumberGuess(50, 50, 1.5)).toBe('correct');
    expect(judgeNumberGuess(51, 50, 1.5)).toBe('correct'); // inside tolerance
    expect(judgeNumberGuess(40, 50, 1.5)).toBe('higher');
    expect(judgeNumberGuess(60, 50, 1.5)).toBe('lower');
  });
});

describe('nextStreak', () => {
  it('starts at 1, extends on consecutive days, restarts after a gap', () => {
    const d1 = nextStreak(EMPTY_STREAK, 10);
    expect(d1).toEqual({ current: 1, best: 1, lastSolvedDay: 10 });
    const d2 = nextStreak(d1, 11);
    expect(d2.current).toBe(2);
    const gap = nextStreak(d2, 15); // missed days 12-14
    expect(gap.current).toBe(1);
    expect(gap.best).toBe(2); // best is preserved
  });

  it('solving the same day twice does not double-count', () => {
    const d1 = nextStreak(EMPTY_STREAK, 10);
    expect(nextStreak(d1, 10)).toEqual(d1);
  });
});

describe('shareText', () => {
  const g = (hits: boolean[]): GuessRecord[] => hits.map((hit) => ({ label: 'x', hit }));

  it('renders the Wordle-style grid and score', () => {
    const t = shareText(37, g([false, true]), true, 4, 'https://example.com');
    expect(t).toContain('♠ Fold Call Jam №37 2/4');
    expect(t).toContain('🟥🟩');
    expect(t).toContain('https://example.com');
  });

  it('renders X for a failed day', () => {
    const t = shareText(5, g([false, false, false, false]), false, 4, 'u');
    expect(t).toContain('X/4');
    expect(t).toContain('🟥🟥🟥🟥');
  });
});
