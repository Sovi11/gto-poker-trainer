import { describe, it, expect } from 'vitest';
import { parseCard } from '../engine/cards';
import { STUDY_SPOTS, spotsByTag } from './famousHands';

describe('study spots are well formed', () => {
  it('has unique ids', () => {
    const ids = STUDY_SPOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const spot of STUDY_SPOTS) {
    describe(spot.id, () => {
      it('uses legal, non-duplicated cards', () => {
        const hero = spot.heroCards.map(parseCard);
        const board = spot.board.map(parseCard);
        const villainCards = spot.villains.flatMap((v) => (v.cards ?? []).map(parseCard));
        const all = [...hero, ...board, ...villainCards];
        expect(new Set(all).size).toBe(all.length);
        expect(board.length).toBeGreaterThanOrEqual(3);
        expect(board.length).toBeLessThanOrEqual(5);
      });

      it('offers exactly one actual play, with reasoning on every option', () => {
        expect(spot.options.filter((o) => o.verdict === 'actual')).toHaveLength(1);
        expect(spot.options.length).toBeGreaterThanOrEqual(2);
        for (const o of spot.options) {
          expect(o.label.trim().length).toBeGreaterThan(0);
          expect(o.because.trim().length).toBeGreaterThan(20);
        }
      });

      it('carries the framing a learner needs', () => {
        expect(spot.question.trim().length).toBeGreaterThan(0);
        expect(spot.lesson.trim().length).toBeGreaterThan(0);
        expect(spot.whatHappened.trim().length).toBeGreaterThan(0);
        expect(spot.history.length).toBeGreaterThan(0);
      });

      it('cites a source when it claims to be a real hand', () => {
        // Real players may only be named alongside a citation.
        if (spot.verified) expect(spot.source).toMatch(/^https?:\/\//);
      });
    });
  }
});

describe('spotsByTag', () => {
  it('returns everything for "all" and filters otherwise', () => {
    expect(spotsByTag('all')).toHaveLength(STUDY_SPOTS.length);
    for (const s of spotsByTag('fold')) expect(s.tag).toBe('fold');
  });
});
