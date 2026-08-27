import { useEffect, useMemo, useRef, useState } from 'react';
import { parseCard } from '../engine/cards';
import { DailyStreak, EMPTY_STREAK, dailyNumber, nextStreak, shareText } from '../drills/daily';
import { DailySpot, actualActionLabel, briefingLines, pickDaily } from '../lib/dailyHand';
import { DailyChoice, fetchDailyVotes, recordDailyVote } from '../lib/dailyVotes';
import { loadLibrary } from '../lib/handLibrary';
import {
  ActStep,
  Choice,
  Hand,
  choicesAt,
  matches,
  replayState,
  showdownWinners,
} from '../lib/handReplay';
import { useProfileState } from '../lib/profiles';
import { loadJSON } from '../lib/storage';
import { supabaseEnabled } from '../lib/supabase';
import { CardRow } from './Card';
import { FeltTable } from './FeltTable';

const SEAT_LETTERS = 'ABCDEF';

// The Daily: one recorded hand, one frozen decision, the same for everyone.
// You get the scenario a player would genuinely know, the table animates to
// the key moment and asks, then the reveal shows what the real player did —
// and, when the backend is on, what everyone here chose.

interface DayResult {
  day: number;
  choice: DailyChoice | null;
}

function msToNextMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function DailyView({ onGoDrills }: { onGoDrills?: () => void }) {
  const day = dailyNumber();
  const [hands, setHands] = useState<Hand[] | null>(null);

  useEffect(() => {
    let live = true;
    loadLibrary().then((h) => live && setHands(h));
    return () => {
      live = false;
    };
  }, []);

  const spot = useMemo(() => (hands ? pickDaily(day, hands) : null), [hands, day]);

  if (!hands) {
    return (
      <div className="view">
        <div className="panel empty-state">
          <h2>Daily Hand</h2>
          <p className="muted">Shuffling up today’s hand…</p>
        </div>
      </div>
    );
  }
  if (!spot) {
    return (
      <div className="view">
        <div className="panel empty-state">
          <h2>Daily Hand</h2>
          <p className="muted">No hand qualified today — that should be impossible. Try the Study tab.</p>
        </div>
      </div>
    );
  }
  return <DailyHand key={day} day={day} spot={spot} onGoDrills={onGoDrills} />;
}

function DailyHand({ day, spot, onGoDrills }: { day: number; spot: DailySpot; onGoDrills?: () => void }) {
  const { hand, seat, step: frozenStep } = spot;

  // Seed the profile-scoped streak from the old browser-wide one, so nobody
  // loses a streak to the storage move.
  const [streak, setStreak] = useProfileState<DailyStreak>(
    'daily.streak',
    loadJSON('daily.streak', EMPTY_STREAK),
  );
  const [result, setResult] = useProfileState<DayResult>('daily.hand', { day, choice: null });
  const answered = result.day === day && result.choice !== null;

  const [started, setStarted] = useState(answered); // reload after answering skips the intro
  const [step, setStep] = useState(answered ? hand.steps.length : 0);
  const [votes, setVotes] = useState<Record<string, number> | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const done = step >= hand.steps.length;
  const frozen = started && !answered && step === frozenStep;

  // Auto-advance the replay except at the frozen decision.
  useEffect(() => {
    if (!started || done || frozen) return;
    const next = hand.steps[step];
    const delay = next?.t === 'board' ? 1250 : 950;
    timer.current = window.setTimeout(() => setStep((s) => s + 1), delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [started, step, done, frozen, hand.steps]);

  // Community numbers, fetched once the reveal is reachable. A fresh answer
  // waits a beat so its own vote has landed server-side.
  useEffect(() => {
    if (!answered || !supabaseEnabled()) return;
    let live = true;
    const t = window.setTimeout(() => {
      void fetchDailyVotes(day).then((v) => live && setVotes(v));
    }, done ? 0 : 900);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, day]);

  const answer = (c: Choice) => {
    if (!frozen) return;
    setResult({ day, choice: c.a });
    setStreak((s) => nextStreak(s, day));
    recordDailyVote(day, c.a);
  };

  const state = replayState(hand, step);
  const potNow = done ? state.effectivePot : state.pot;
  const sym = hand.symbol ?? (hand.currency === 'USD' ? '$' : '');
  const money = (x: number) => `${sym}${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const actual = hand.steps[frozenStep] as ActStep;
  const matched = answered ? matches(result.choice as DailyChoice, actual.a) : false;
  const winners = done ? showdownWinners(hand) : [];
  const showCards = (i: number) => i === seat || (done && answered) || state.shown[i];

  const voteTotal = votes ? Object.values(votes).reduce((a, b) => a + b, 0) : 0;
  const agreePct =
    votes && voteTotal > 0 && answered
      ? Math.round((100 * (votes[result.choice as string] ?? 0)) / voteTotal)
      : null;

  const copyShare = async () => {
    const url =
      typeof window !== 'undefined'
        ? (window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, '')
        : '';
    const text = shareText(day, matched, agreePct, url);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setShareFallback(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareFallback(text); // clipboard blocked — show the text to copy manually
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

  const heroCards = hand.hole[seat];

  return (
    <div className="view">
      <div className="panel daily-head">
        <div className="daily-title">
          <span className="daily-no">№{day}</span>
          <div>
            <h2>Daily Hand</h2>
            <p className="muted">One real hand a day, the same for everyone. Freeze at the moment that matters.</p>
          </div>
        </div>
        <div className="streak-counter">
          <span className="streak-num">{streak.current}</span>
          <span className="streak-label">day streak</span>
          <span className="muted small">best {streak.best}</span>
        </div>
      </div>

      {!started && (
        <div className="panel daily-brief">
          <h3>The scenario</h3>
          {briefingLines(spot).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {heroCards && (
            <div className="daily-brief-cards">
              <span className="muted small">Your hand:</span>
              <CardRow cards={heroCards.map(parseCard)} small dealt />
            </div>
          )}
          <button className="primary big" onClick={() => setStarted(true)}>
            Play the hand
          </button>
        </div>
      )}

      {started && (
        <>
          <FeltTable
            hand={hand}
            seat={seat}
            state={state}
            pot={potNow}
            showCards={showCards}
            showRealNames={done && answered && !hand.anon}
          />

          {frozen && (
            <div className="theater-ask">
              <strong>Your move.</strong>
              <div className="theater-choices">
                {choicesAt(hand, frozenStep).map((c) => (
                  <button key={c.a} className="theater-choice" onClick={() => answer(c)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answered && !done && (
            <p className="muted small daily-watch">You chose to {result.choice}. Watch how it really went…</p>
          )}

          {done && answered && (
            <div className="panel daily-reveal">
              <h3>
                {matched ? '✓ You matched the table' : '✗ You went your own way'}
              </h3>
              <p>
                You chose to <strong>{result.choice}</strong>.{' '}
                {hand.anon ? 'The real player' : hand.players[seat]}{' '}
                <strong>{actualActionLabel(spot)}</strong>.
              </p>

              {votes && voteTotal > 0 && (
                <div className="vote-bars">
                  <p className="muted small">What everyone here chose ({voteTotal.toLocaleString()} answers):</p>
                  {Object.entries(votes)
                    .sort((a, b) => b[1] - a[1])
                    .map(([choice, n]) => (
                      <div key={choice} className="vote-row">
                        <span className="vote-label">{choice}</span>
                        <div className="vote-track">
                          <div
                            className={`vote-fill ${choice === result.choice ? 'mine' : ''}`}
                            style={{ width: `${Math.max(3, (100 * n) / voteTotal)}%` }}
                          />
                        </div>
                        <span className="vote-pct">{Math.round((100 * n) / voteTotal)}%</span>
                      </div>
                    ))}
                </div>
              )}

              <table className="reveal-table">
                <tbody>
                  {hand.players.map((name, i) => (
                    <tr key={i} className={i === seat ? 'you' : ''}>
                      <td>{i === seat ? 'You' : `Seat ${SEAT_LETTERS[i] ?? i + 1}`}</td>
                      <td>{hand.anon ? <span className="muted small">name not in the data</span> : name}</td>
                      <td>
                        {hand.hole[i] ? (
                          <CardRow cards={hand.hole[i]!.map(parseCard)} small />
                        ) : (
                          <span className="muted small">never shown</span>
                        )}
                      </td>
                      <td className={winners.includes(i) ? 'won' : 'muted small'}>
                        {state.folded[i] ? 'folded' : winners.includes(i) ? 'won the pot' : 'to showdown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                Final pot {money(hand.pot)} ({hand.potBB} bb) ·{' '}
                <a href={hand.source} target="_blank" rel="noreferrer">
                  hand history
                </a>
              </p>

              <div className="btn-row">
                <button className="primary" onClick={copyShare}>
                  {copied ? '✓ Copied!' : 'Copy result'}
                </button>
                {onGoDrills && <button onClick={onGoDrills}>Keep grinding → Drills</button>}
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
                Next hand in {hrs}h {mins}m
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
