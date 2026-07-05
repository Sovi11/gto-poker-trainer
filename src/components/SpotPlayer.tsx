import { useState } from 'react';
import { parseCard } from '../engine/cards';
import { Spot } from '../data/lessons';
import { CardRow } from './Card';

// Renders an "illustrated hand": a scripted spot with a mini table, one key
// decision, per-option feedback, and the lesson's takeaway.
export function SpotPlayer({ spot, onAnswered }: { spot: Spot; onAnswered?: () => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const revealed = choice !== null;
  const hero = spot.heroCards.map(parseCard);
  const board = spot.board?.map(parseCard) ?? [];
  const bestIdx = spot.options.findIndex((o) => o.verdict === 'best');

  const verdictLead = (v: Spot['options'][number]['verdict']) =>
    v === 'best' ? '✓ Best play.' : v === 'ok' ? '~ Playable.' : '✗ Leak.';

  return (
    <div className="spot">
      <div className="spot-head">
        <span className="spot-badge">🃏 Illustrated hand</span>
        <span className="muted">{spot.scenario}</span>
      </div>

      <div className="spot-table">
        <div className="spot-seat">
          <span className="spot-pos">{spot.heroPos} · you</span>
          <CardRow cards={hero} small dealt />
        </div>
        <div className="spot-board">
          <CardRow cards={board.length ? board : [null, null, null]} small dealt />
          <span className="spot-pot">
            Pot {spot.pot}
            {spot.toCall ? ` · to call ${spot.toCall}` : ''}
          </span>
        </div>
        {spot.villainPos && (
          <div className="spot-seat villain">
            <span className="spot-pos">
              {spot.villainPos}
              {spot.villainNote ? ` · ${spot.villainNote}` : ''}
            </span>
            <CardRow cards={[null, null]} small />
          </div>
        )}
      </div>

      {spot.history && spot.history.length > 0 && (
        <ul className="spot-history">
          {spot.history.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      <p className="spot-question">{spot.question}</p>

      <div className="spot-options">
        {spot.options.map((o, i) => {
          const cls = [
            'spot-option',
            choice === i ? 'selected' : '',
            revealed && o.verdict === 'best' ? 'best' : '',
            revealed && choice === i && o.verdict !== 'best' ? o.verdict : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={i}
              className={cls}
              disabled={revealed}
              onClick={() => {
                setChoice(i);
                onAnswered?.();
              }}
            >
              <span>{o.label}</span>
              {revealed && (o.verdict === 'best' || choice === i) && (
                <span className={`spot-tag ${o.verdict}`}>{o.verdict === 'best' ? 'GTO' : o.verdict}</span>
              )}
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className={`spot-feedback ${spot.options[choice].verdict}`}>
          <p>
            <strong>{verdictLead(spot.options[choice].verdict)}</strong> {spot.options[choice].because}
          </p>
          {spot.options[choice].verdict !== 'best' && (
            <p className="muted">
              Best line: <strong>{spot.options[bestIdx].label}</strong> — {spot.options[bestIdx].because}
            </p>
          )}
          <p className="spot-moral">💡 {spot.moral}</p>
          <button className="link-btn" onClick={() => setChoice(null)}>
            ↺ Try again
          </button>
        </div>
      )}
    </div>
  );
}
