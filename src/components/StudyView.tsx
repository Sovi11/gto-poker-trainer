import { useMemo, useState } from 'react';
import { parseCard } from '../engine/cards';
import { STUDY_SPOTS, StudySpot, StudyTag, TAG_LABELS } from '../data/famousHands';
import { useProfileState } from '../lib/profiles';
import { CardRow } from './Card';

type Filter = StudyTag | 'all';
const FILTERS: Filter[] = ['all', 'bluff', 'fold', 'call', 'read'];

export function StudyView() {
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [solved, setSolved] = useProfileState<string[]>('study.solved', []);

  const spots = useMemo(
    () => (filter === 'all' ? STUDY_SPOTS : STUDY_SPOTS.filter((s) => s.tag === filter)),
    [filter],
  );

  const markSolved = (id: string) => setSolved((prev) => (prev.includes(id) ? prev : [...prev, id]));

  return (
    <div className="view">
      <div className="panel">
        <h2>Study</h2>
        <p className="muted">
          Famous hands, played as puzzles. You sit in the seat, you make the decision, then you see what actually
          happened and why it worked. {solved.length}/{STUDY_SPOTS.length} attempted.
        </p>
        <div className="subtabs study-filters">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : TAG_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="study-grid">
        {spots.map((s) => (
          <StudyCard
            key={s.id}
            spot={s}
            open={openId === s.id}
            attempted={solved.includes(s.id)}
            onOpen={() => setOpenId(openId === s.id ? null : s.id)}
            onAnswered={() => markSolved(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StudyCard({
  spot,
  open,
  attempted,
  onOpen,
  onAnswered,
}: {
  spot: StudySpot;
  open: boolean;
  attempted: boolean;
  onOpen: () => void;
  onAnswered: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const revealed = choice !== null;
  const actualIdx = spot.options.findIndex((o) => o.verdict === 'actual');

  const pick = (i: number) => {
    if (revealed) return;
    setChoice(i);
    onAnswered();
  };

  const money = (n: number) => (spot.unit === '$' ? `$${n.toLocaleString()}` : `${n.toLocaleString()} ${spot.unit}`);

  return (
    <div className={`panel study-card ${open ? 'open' : ''}`}>
      <button className="study-head" onClick={onOpen}>
        <div>
          <div className="study-tags">
            <span className={`study-tag ${spot.tag}`}>{TAG_LABELS[spot.tag]}</span>
            {spot.verified ? (
              <span className="study-tag real" title="Real televised hand, details from public reporting">
                ✓ real hand
              </span>
            ) : (
              <span className="study-tag made" title="Constructed teaching spot — no real player involved">
                teaching spot
              </span>
            )}
            {attempted && <span className="study-tag done">attempted</span>}
          </div>
          <h3>{spot.title}</h3>
          <p className="muted small">{spot.event}</p>
        </div>
        <span className="study-chev">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="study-body">
          <div className="study-table">
            <div className="study-seat">
              <span className="spot-pos">
                {spot.heroName} · you
              </span>
              <CardRow cards={spot.heroCards.map(parseCard)} small dealt />
            </div>
            <div className="study-board">
              <CardRow cards={spot.board.map(parseCard)} small dealt />
              <span className="spot-pot">
                {spot.street} · pot {money(spot.pot)}
                {spot.toCall ? ` · to call ${money(spot.toCall)}` : ''}
              </span>
            </div>
          </div>

          <ul className="spot-history">
            {spot.history.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>

          <p className="spot-question">{spot.question}</p>

          <div className="spot-options">
            {spot.options.map((o, i) => {
              const cls = [
                'spot-option',
                revealed && o.verdict === 'actual' ? 'best' : '',
                revealed && choice === i && o.verdict === 'bad' ? 'bad' : '',
                revealed && choice === i && o.verdict === 'reasonable' ? 'ok' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={i} className={cls} disabled={revealed} onClick={() => pick(i)}>
                  <span>{o.label}</span>
                  {revealed && (o.verdict === 'actual' || choice === i) && (
                    <span className={`spot-tag ${o.verdict === 'actual' ? 'best' : o.verdict === 'bad' ? 'bad' : 'ok'}`}>
                      {o.verdict === 'actual' ? 'what they did' : o.verdict}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className={`spot-feedback ${spot.options[choice].verdict === 'bad' ? 'bad' : 'best'}`}>
              <p>
                <strong>{choice === actualIdx ? 'That’s the play.' : 'Not what happened.'}</strong>{' '}
                {spot.options[choice].because}
              </p>
              {choice !== actualIdx && (
                <p className="muted">
                  <strong>They played:</strong> {spot.options[actualIdx].label} — {spot.options[actualIdx].because}
                </p>
              )}

              <div className="study-outcome">
                <h4>{spot.verified ? 'What actually happened' : 'About this spot'}</h4>
                <p>{spot.whatHappened}</p>
              </div>

              <p className="spot-moral">💡 {spot.lesson}</p>

              {spot.verified && spot.source && (
                <p className="muted small">
                  Hand details from public reporting ·{' '}
                  <a href={spot.source} target="_blank" rel="noreferrer">
                    source
                  </a>
                </p>
              )}

              <button className="link-btn" onClick={() => setChoice(null)}>
                ↺ try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
