import { useState } from 'react';
import { CURRICULUM, Lesson } from '../data/lessons';
import { SpotPlayer } from './SpotPlayer';

export function LearnView() {
  const [active, setActive] = useState<Lesson>(CURRICULUM[0].lessons[0]);
  const [done, setDone] = useState<Set<string>>(new Set());

  const toggleDone = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const total = CURRICULUM.reduce((n, m) => n + m.lessons.length, 0);
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
          {CURRICULUM.map((m) => (
            <div key={m.id} className="module">
              <h4>{m.title}</h4>
              {m.lessons.map((l) => (
                <button
                  key={l.id}
                  className={`lesson-link ${active.id === l.id ? 'active' : ''}`}
                  onClick={() => setActive(l)}
                >
                  <span className={`check ${done.has(l.id) ? 'on' : ''}`}>{done.has(l.id) ? '✓' : '○'}</span>
                  {l.title}
                  <span className="mins">{l.minutes}m</span>
                </button>
              ))}
            </div>
          ))}
        </aside>
        <article className="lesson-body panel">
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
          {active.spot && <SpotPlayer spot={active.spot} />}
          <button className="primary" onClick={() => toggleDone(active.id)}>
            {done.has(active.id) ? 'Mark as not done' : 'Mark complete ✓'}
          </button>
        </article>
      </div>
    </div>
  );
}
