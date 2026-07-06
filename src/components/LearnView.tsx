import { useMemo, useState } from 'react';
import { CURRICULUM, Lesson, allLessons } from '../data/lessons';
import { usePersistentState } from '../lib/usePersistentState';
import { SpotPlayer } from './SpotPlayer';

export function LearnView() {
  const ordered = useMemo(() => allLessons(), []);
  const [activeId, setActiveId] = useState<string>(ordered[0].id);
  // Persisted as an array (JSON-friendly); exposed as a Set for lookups.
  const [doneIds, setDoneIds] = usePersistentState<string[]>('learn.done', []);
  const done = useMemo(() => new Set(doneIds), [doneIds]);

  const idx = Math.max(0, ordered.findIndex((l) => l.id === activeId));
  const active: Lesson = ordered[idx];
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const markDone = (id: string) => {
    setDoneIds((p) => (p.includes(id) ? p : [...p, id]));
  };

  const toggleDone = (id: string) => {
    setDoneIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const goTo = (id: string) => {
    setActiveId(id);
    // Jumping between lessons should read like a new page.
    window.scrollTo({ top: 0 });
  };

  const total = ordered.length;
  const progress = Math.round((done.size / total) * 100);

  return (
    <div className="view">
      <div className="learn-layout">
        <aside className="learn-nav">
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="muted small">
            {done.size}/{total} lessons complete
          </p>
          {CURRICULUM.map((m) => {
            const moduleDone = m.lessons.filter((l) => done.has(l.id)).length;
            return (
              <div key={m.id} className="module">
                <h4>
                  {m.title}
                  <span className="module-count">
                    {moduleDone}/{m.lessons.length}
                  </span>
                </h4>
                {m.lessons.map((l) => (
                  <button
                    key={l.id}
                    className={`lesson-link ${active.id === l.id ? 'active' : ''}`}
                    onClick={() => goTo(l.id)}
                  >
                    <span className={`check ${done.has(l.id) ? 'on' : ''}`}>{done.has(l.id) ? '✓' : '○'}</span>
                    {l.title}
                    <span className="mins">{l.minutes}m</span>
                  </button>
                ))}
              </div>
            );
          })}
        </aside>
        <article className="lesson-body panel" key={active.id}>
          <div className="lesson-meta muted small">
            Lesson {idx + 1} of {total} · {active.minutes} min read
          </div>
          <h2>{active.title}</h2>
          <div className="lesson-text">
            {active.body.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <div className="takeaways">
            <h4>Key takeaways</h4>
            <ul>
              {active.takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          {active.spot && (
            <SpotPlayer key={active.id} spot={active.spot} onAnswered={() => markDone(active.id)} />
          )}
          <div className="lesson-nav">
            {prev ? (
              <button className="lesson-nav-btn" onClick={() => goTo(prev.id)}>
                ← {prev.title}
              </button>
            ) : (
              <span />
            )}
            <button className="link-btn" onClick={() => toggleDone(active.id)}>
              {done.has(active.id) ? '✓ completed (undo)' : 'mark complete'}
            </button>
            {next ? (
              <button className="lesson-nav-btn primary" onClick={() => goTo(next.id)}>
                Next: {next.title} →
              </button>
            ) : (
              <span className="muted">That’s the whole course — go print.</span>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
