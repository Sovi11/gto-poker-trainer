import { describe, it, expect } from 'vitest';
import { CURRICULUM, allLessons } from './lessons';
import { parseCard } from '../engine/cards';

describe('curriculum structure', () => {
  it('every lesson id is unique', () => {
    const ids = allLessons().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every module has lessons and a title', () => {
    for (const m of CURRICULUM) {
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.lessons.length).toBeGreaterThan(0);
    }
  });

  it('every lesson has a body and takeaways', () => {
    for (const l of allLessons()) {
      expect(l.body.trim().length).toBeGreaterThan(0);
      expect(l.takeaways.length).toBeGreaterThan(0);
    }
  });
});

// Validates every illustrated hand so an authoring typo (bad card, duplicate
// card, missing "best" option) fails the build instead of shipping.
describe('illustrated hands (spots)', () => {
  const spots = allLessons()
    .filter((l) => l.spot)
    .map((l) => ({ id: l.id, spot: l.spot! }));

  it('there is at least one spot', () => {
    expect(spots.length).toBeGreaterThan(0);
  });

  for (const { id, spot } of spots) {
    describe(id, () => {
      it('hero holds two distinct, parseable cards', () => {
        expect(spot.heroCards).toHaveLength(2);
        const cards = spot.heroCards.map(parseCard);
        expect(new Set(cards).size).toBe(2);
      });

      it('board is legal and shares no card with the hero', () => {
        const board = (spot.board ?? []).map(parseCard);
        expect(board.length).toBeLessThanOrEqual(5);
        const all = [...spot.heroCards.map(parseCard), ...board];
        expect(new Set(all).size).toBe(all.length); // no card used twice
      });

      it('has exactly one "best" option, all with feedback', () => {
        expect(spot.options.length).toBeGreaterThanOrEqual(2);
        expect(spot.options.filter((o) => o.verdict === 'best')).toHaveLength(1);
        for (const o of spot.options) {
          expect(o.label.trim().length).toBeGreaterThan(0);
          expect(o.because.trim().length).toBeGreaterThan(0);
        }
      });

      it('has a question and a moral', () => {
        expect(spot.question.trim().length).toBeGreaterThan(0);
        expect(spot.moral.trim().length).toBeGreaterThan(0);
      });
    });
  }
});
