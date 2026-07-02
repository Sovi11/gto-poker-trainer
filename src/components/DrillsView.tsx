import { useState } from 'react';
import { Drill, DrillCategory, DRILL_CATEGORIES, generateDrill } from '../drills/types';

type Cat = DrillCategory | 'All';

interface Score {
  correct: number;
  total: number;
  streak: number;
  best: number;
}

export function DrillsView() {
  const [cat, setCat] = useState<Cat>('All');
  const [drill, setDrill] = useState<Drill>(() => generateDrill('All'));
  const [selected, setSelected] = useState<number | null>(null);
  const [numInput, setNumInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState<Score>({ correct: 0, total: 0, streak: 0, best: 0 });

  const next = (c: Cat = cat) => {
    setDrill(generateDrill(c));
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
              <span className={score.streak >= 3 ? 'streak-hot' : ''}>🔥 {score.streak} streak</span>
              <span className="muted">best {score.best}</span>
            </div>
          </div>
        </div>

        <div className="subtabs drill-cats">
          {DRILL_CATEGORIES.map((c) => (
            <button key={c} className={cat === c ? 'active' : ''} onClick={() => changeCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="panel drill-card">
        <div className="drill-type-tag">{drill.category}</div>
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
