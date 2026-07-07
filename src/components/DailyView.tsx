import { useEffect, useMemo, useState } from 'react';
import {
  dailyNumber,
  dailyDrill,
  judgeNumberGuess,
  nextStreak,
  shareText,
  GuessRecord,
  DailyStreak,
  EMPTY_STREAK,
  MAX_NUMBER_GUESSES,
} from '../drills/daily';
import { usePersistentState } from '../lib/usePersistentState';

// Per-day progress; replaced wholesale when the calendar day changes.
interface DayProgress {
  day: number;
  guesses: GuessRecord[];
  solved: boolean;
  failed: boolean;
  usedChoices: number[]; // indices already tried (choice drills)
}

const freshProgress = (day: number): DayProgress => ({
  day,
  guesses: [],
  solved: false,
  failed: false,
  usedChoices: [],
});

function msToNextMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function DailyView({ onGoDrills }: { onGoDrills?: () => void }) {
  const day = dailyNumber();
  const drill = useMemo(() => dailyDrill(day), [day]);
  const maxGuesses = drill.input.kind === 'choice' ? drill.input.choices.length : MAX_NUMBER_GUESSES;

  const [progress, setProgress] = usePersistentState<DayProgress>('daily.progress', freshProgress(day));
  const [streak, setStreak] = usePersistentState<DailyStreak>('daily.streak', EMPTY_STREAK);
  const [numInput, setNumInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState<string | null>(null);

  // A stale progress blob from yesterday resets on first render of a new day.
  useEffect(() => {
    if (progress.day !== day) setProgress(freshProgress(day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, progress.day]);

  const over = progress.solved || progress.failed;

  const recordSolve = (guesses: GuessRecord[]) => {
    setProgress((p) => ({ ...p, guesses, solved: true }));
    setStreak((s) => nextStreak(s, day));
  };

  const guessChoice = (idx: number) => {
    if (over || progress.usedChoices.includes(idx)) return;
    if (drill.input.kind !== 'choice') return;
    const hit = idx === drill.input.correct;
    const rec: GuessRecord = { label: drill.input.choices[idx], hit };
    const guesses = [...progress.guesses, rec];
    if (hit) {
      recordSolve(guesses);
    } else {
      setProgress((p) => ({ ...p, guesses, usedChoices: [...p.usedChoices, idx] }));
    }
  };

  const guessNumber = () => {
    if (over || drill.input.kind !== 'number') return;
    const v = parseFloat(numInput);
    if (!Number.isFinite(v)) return;
    const verdict = judgeNumberGuess(v, drill.input.correct, drill.input.tolerance);
    const hit = verdict === 'correct';
    const rec: GuessRecord = { label: `${v}${drill.input.unit}`, hit, hint: verdict };
    const guesses = [...progress.guesses, rec];
    setNumInput('');
    if (hit) {
      recordSolve(guesses);
    } else if (guesses.length >= MAX_NUMBER_GUESSES) {
      setProgress((p) => ({ ...p, guesses, failed: true }));
    } else {
      setProgress((p) => ({ ...p, guesses }));
    }
  };

  const copyShare = async () => {
    // origin + Vite base so the link survives subpath hosting (GitHub Pages)
    const url =
      typeof window !== 'undefined'
        ? (window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, '')
        : '';
    const text = shareText(day, progress.guesses, progress.solved, maxGuesses, url);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setShareFallback(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (webviews, odd permissions) — show the text to copy manually.
      setShareFallback(text);
    }
  };

  // countdown, refreshed once a minute
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const msLeft = msToNextMidnight();
  const hrs = Math.floor(msLeft / 3_600_000);
  const mins = Math.floor((msLeft % 3_600_000) / 60_000);

  const answerLabel =
    drill.input.kind === 'choice' ? drill.input.choices[drill.input.correct] : `${drill.input.correct}${drill.input.unit}`;

  return (
    <div className="view">
      <div className="panel daily-head">
        <div className="daily-title">
          <span className="daily-no">№{day}</span>
          <div>
            <h2>Daily Puzzle</h2>
            <p className="muted">One puzzle a day, the same for everyone. Solve it, keep the streak, share the grid.</p>
          </div>
        </div>
        <div className="streak-counter">
          <span className="streak-num">{streak.current}</span>
          <span className="streak-label">day streak</span>
          <span className="muted small">best {streak.best}</span>
        </div>
      </div>

      <div className="panel drill-card">
        <div className={`drill-type-tag cat-${drill.category.toLowerCase()}`}>{drill.category}</div>
        <p className="drill-prompt">{drill.prompt}</p>

        {drill.context.length > 0 && (
          <ul className="drill-context">
            {drill.context.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}

        {/* guess history */}
        {progress.guesses.length > 0 && (
          <div className="daily-guesses">
            {progress.guesses.map((g, i) => (
              <div key={i} className={`daily-guess ${g.hit ? 'hit' : 'miss'}`}>
                <span className={`guess-dot ${g.hit ? 'hit' : 'miss'}`} aria-hidden="true" />
                <span>{g.label}</span>
                {g.hint === 'higher' && <span className="daily-hint">↑ higher</span>}
                {g.hint === 'lower' && <span className="daily-hint">↓ lower</span>}
              </div>
            ))}
          </div>
        )}

        {/* inputs */}
        {!over && drill.input.kind === 'choice' && (
          <div className="drill-choices">
            {drill.input.choices.map((choice, i) => (
              <button
                key={i}
                className="drill-choice"
                disabled={progress.usedChoices.includes(i)}
                onClick={() => guessChoice(i)}
              >
                {choice}
              </button>
            ))}
          </div>
        )}
        {!over && drill.input.kind === 'number' && (
          <div className="drill-number">
            <input
              type="number"
              inputMode="decimal"
              value={numInput}
              placeholder="your answer"
              onChange={(e) => setNumInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guessNumber()}
            />
            <span className="drill-unit">{drill.input.unit}</span>
            <button className="primary" onClick={guessNumber} disabled={!Number.isFinite(parseFloat(numInput))}>
              Guess ({progress.guesses.length + 1}/{MAX_NUMBER_GUESSES})
            </button>
          </div>
        )}

        {/* end state */}
        {over && (
          <div className={`drill-verdict ${progress.solved ? 'correct' : 'wrong'}`}>
            <strong>
              {progress.solved
                ? `✓ Solved in ${progress.guesses.length}/${maxGuesses}`
                : `✗ Out of guesses — answer: ${answerLabel}`}
            </strong>
            {drill.explanation.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <div className="btn-row">
              <button className="primary" onClick={copyShare}>
                {copied ? '✓ Copied!' : 'Copy result'}
              </button>
              {onGoDrills && (
                <button onClick={onGoDrills}>Keep grinding → Drills</button>
              )}
            </div>
            {shareFallback && (
              <textarea
                className="share-fallback"
                readOnly
                value={shareFallback}
                rows={3}
                onFocus={(e) => e.target.select()}
              />
            )}
            <p className="muted small daily-countdown">
              Next puzzle in {hrs}h {mins}m
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
