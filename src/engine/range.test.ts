import { describe, it, expect } from 'vitest';
import { parseRange, comboCount, classToCombos, TOTAL_COMBOS } from './range';

describe('parseRange', () => {
  it('expands a pair-plus into every pair at or above it', () => {
    const r = parseRange('22+');
    expect(r.size).toBe(13); // 22 through AA
    expect(r.has('AA')).toBe(true);
    expect(r.has('22')).toBe(true);
  });

  it('expands suited aces with a plus', () => {
    const r = parseRange('ATs+');
    expect([...r].sort()).toEqual(['AJs', 'AKs', 'AQs', 'ATs'].sort());
  });

  it('handles explicit suited/offsuit tokens', () => {
    expect([...parseRange('AKo')]).toEqual(['AKo']);
    expect([...parseRange('AKs')]).toEqual(['AKs']);
    // No suffix means both.
    expect(new Set(parseRange('AK'))).toEqual(new Set(['AKs', 'AKo']));
  });

  it('expands a suited-connector dash range', () => {
    const r = parseRange('T9s-76s');
    expect(new Set(r)).toEqual(new Set(['T9s', '98s', '87s', '76s']));
  });

  it('parses comma/space separated mixed input', () => {
    const r = parseRange('AA, KK, AKs AKo');
    expect(new Set(r)).toEqual(new Set(['AA', 'KK', 'AKs', 'AKo']));
  });
});

describe('comboCount', () => {
  it('counts combos per class type', () => {
    expect(comboCount(parseRange('AA'))).toBe(6); // pair
    expect(comboCount(parseRange('AKs'))).toBe(4); // suited
    expect(comboCount(parseRange('AKo'))).toBe(12); // offsuit
  });

  it('a full range of every hand totals 1326 combos', () => {
    // All 169 classes = 13 pairs + 78 suited + 78 offsuit.
    const all = parseRange(
      [...'AKQJT98765432']
        .flatMap((hi, i, arr) =>
          arr.slice(i).map((lo) => (hi === lo ? hi + lo : `${hi}${lo}s ${hi}${lo}o`)),
        )
        .join(' '),
    );
    expect(comboCount(all)).toBe(TOTAL_COMBOS);
  });
});

describe('classToCombos', () => {
  it('produces the right number of concrete combos', () => {
    expect(classToCombos('AA')).toHaveLength(6);
    expect(classToCombos('AKs')).toHaveLength(4);
    expect(classToCombos('AKo')).toHaveLength(12);
  });

  it('suited combos share a suit; offsuit combos do not', () => {
    for (const [a, b] of classToCombos('AKs')) expect(Math.floor(a / 13)).toBe(Math.floor(b / 13));
    for (const [a, b] of classToCombos('AKo')) expect(Math.floor(a / 13)).not.toBe(Math.floor(b / 13));
  });
});
