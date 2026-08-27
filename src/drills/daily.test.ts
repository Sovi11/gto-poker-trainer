import { describe, it, expect } from 'vitest';
import { dailyNumber, nextStreak, shareText, EMPTY_STREAK } from './daily';

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

describe('nextStreak', () => {
  it('starts at 1, extends on consecutive days, resets after a gap', () => {
    const d1 = nextStreak(EMPTY_STREAK, 10);
    expect(d1).toEqual({ current: 1, best: 1, lastSolvedDay: 10 });
    const d2 = nextStreak(d1, 11);
    expect(d2.current).toBe(2);
    const gap = nextStreak(d2, 15);
    expect(gap.current).toBe(1);
    expect(gap.best).toBe(2); // best survives the reset
  });

  it('is idempotent for the same day', () => {
    const d1 = nextStreak(EMPTY_STREAK, 10);
    expect(nextStreak(d1, 10)).toBe(d1);
  });
});

describe('shareText', () => {
  it('reports a match with the agreement percentage', () => {
    const t = shareText(58, true, 62, 'https://x.test');
    expect(t).toContain('№58');
    expect(t).toContain('✅ matched the table');
    expect(t).toContain('(62% agreed with me)');
    expect(t.endsWith('https://x.test')).toBe(true);
  });

  it('omits the percentage when there are no community votes', () => {
    const t = shareText(3, false, null, 'https://x.test');
    expect(t).toContain('❌ went my own way');
    expect(t).not.toContain('%');
  });
});
