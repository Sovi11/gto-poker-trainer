import { useState } from 'react';
import { Drill, DrillCategory, DRILL_CATEGORIES, drillTypesIn, generateDrill, generateDrillByType } from '../drills/types';
import { SchedulerState, EMPTY_SCHEDULER, recordAnswer, dueType, reviewCount } from '../drills/scheduler';
import { usePersistentState } from '../lib/usePersistentState';

type Cat = DrillCategory | 'All';

interface Score {
  correct: number;
  total: number;
  streak: number;
  best: number;
}

// Per-category accuracy, persisted — the raw data for leak detection.
type CategoryStats = Record<string, { correct: number; total: number }>;

const EMPTY_SCORE: Score = { correct: 0, total: 0, streak: 0, best: 0 };

export function DrillsView() {
  const [cat, setCat] = useState<Cat>('All');
  const [drill, setDrill] = useState<Drill>(() => generateDrill('All'));
  const [selected, setSelected] = useState<number | null>(null);
  const [numInput, setNumInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = usePersistentState<Score>('drills.score', EMPTY_SCORE);
  const [catStats, setCatStats] = usePersistentState<CategoryStats>('drills.byCategory', {});
  const [scheduler, setScheduler] = usePersistentState<SchedulerState>('drills.scheduler', EMPTY_SCHEDULER);
  const [isReview, setIsReview] = useState(false);

  // Spaced repetition: a due (previously missed) type jumps the queue.
  const pickDrill = (c: Cat, sched: SchedulerState): { drill: Drill; review: boolean } => {
    const allowed = drillTypesIn(c).map((t) => t.id);
    const due = dueType(sched, allowed);
    if (due) {
      const d = generateDrillByType(due);
      if (d) return { drill: d, review: true };
    }
    return { drill: generateDrill(c), review: false };
  };

  const next = (c: Cat = cat, sched: SchedulerState = scheduler) => {
    const picked = pickDrill(c, sched);
    setDrill(picked.drill);
    setIsReview(picked.review);
    setSelected(null);
    setNumInput('');
    setChecked(false);
  };

  const changeCat = (c: Cat) => {
    setCat(c);
    next(c);
  };

  const isCorrect = (): boolean => {
    if (drill.input.kind === 'choice') return selected === drill.input.correct;
    const v = parseFloat(numInput);
    return Number.isFinite(v) && Math.abs(v - drill.input.correct) <= drill.input.tolerance;
  };

  const answerReady =
    drill.input.kind === 'choice' ? selected !== null : numInput.trim() !== '' && Number.isFinite(parseFloat(numInput));

  const submit = () => {
    if (checked) {
      next();
      return;
    }
    if (!answerReady) return;
    const ok = isCorrect();
    setChecked(true);
    setScore((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return { correct: s.correct + (ok ? 1 : 0), total: s.total + 1, streak, best: Math.max(s.best, streak) };
    });
    setCatStats((s) => {
      const prev = s[drill.category] ?? { correct: 0, total: 0 };
      return { ...s, [drill.category]: { correct: prev.correct + (ok ? 1 : 0), total: prev.total + 1 } };
    });
    setScheduler((s) => recordAnswer(s, drill.typeId, ok));
  };

  const resetStats = () => {
    setScore(EMPTY_SCORE);
    setCatStats({});
    setScheduler(EMPTY_SCHEDULER);
  };

  const ok = checked && isCorrect();
  const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="view">
      <div className="panel">
        <div className="drill-head">
          <div>
            <h2>Practice Drills</h2>
            <p className="muted">
              Endless, auto-graded problems on the math and ranges from the Learn tab. Type a number (or pick an option),
              hit Check, read the explanation, repeat.
            </p>
          </div>
          <div className="drill-score">
            <div className="drill-score-main">
              {score.correct}/{score.total}
              <span className="muted"> · {pct}%</span>
            </div>
            <div className="drill-score-sub">
              <span className={score.streak >= 3 ? 'streak-hot' : ''}>streak {score.streak}</span>
              <span className="muted">best {score.best}</span>
              {reviewCount(scheduler) > 0 && <span className="review-badge">{reviewCount(scheduler)} to review</span>}
            </div>
            {score.total > 0 && (
              <button className="link-btn drill-reset" onClick={resetStats}>
                reset stats
              </button>
            )}
          </div>
        </div>

        <div className="subtabs drill-cats">
          {DRILL_CATEGORIES.map((c) => (
            <button key={c} className={cat === c ? 'active' : ''} onClick={() => changeCat(c)}>
              {c}
            </button>
          ))}
        </div>

        {Object.keys(catStats).length > 0 && (
          <div className="drill-cat-stats">
            {Object.entries(catStats).map(([name, s]) => {
              const acc = Math.round((s.correct / s.total) * 100);
              return (
                <span key={name} className={`cat-stat ${acc < 60 ? 'weak' : acc >= 85 ? 'strong' : ''}`}>
                  {name} {acc}% <span className="muted">({s.total})</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel drill-card">
        <div className="drill-tags">
          <div className={`drill-type-tag cat-${drill.category.toLowerCase()}`}>{drill.category}</div>
          {isReview && <div className="drill-review-tag">review · you missed this type before</div>}
        </div>
        <p className="drill-prompt">{drill.prompt}</p>

        {drill.context.length > 0 && (
          <ul className="drill-context">
            {drill.context.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}

        {drill.input.kind === 'choice' ? (
          <div className="drill-choices">
            {drill.input.choices.map((choice, i) => {
              const correctIdx = drill.input.kind === 'choice' ? drill.input.correct : -1;
              const cls = [
                'drill-choice',
                selected === i ? 'selected' : '',
                checked && i === correctIdx ? 'correct' : '',
                checked && selected === i && i !== correctIdx ? 'wrong' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={i} className={cls} disabled={checked} onClick={() => setSelected(i)}>
                  {choice}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="drill-number">
            <input
              type="number"
              inputMode="decimal"
              value={numInput}
              disabled={checked}
              placeholder="your answer"
              onChange={(e) => setNumInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <span className="drill-unit">{drill.input.unit}</span>
            {checked && (
              <span className={`drill-answer ${ok ? 'correct' : 'wrong'}`}>
                answer: {drill.input.correct}
                {drill.input.unit}
              </span>
            )}
          </div>
        )}

        {checked && (
          <div className={`drill-verdict ${ok ? 'correct' : 'wrong'}`}>
            <strong>{ok ? '✓ Correct' : '✗ Not quite'}</strong>
            {drill.explanation.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        <div className="btn-row">
          <button className="primary big" onClick={submit} disabled={!checked && !answerReady}>
            {checked ? 'Next →' : 'Check'}
          </button>
          {!checked && (
            <button onClick={() => next()} className="link-btn">
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
