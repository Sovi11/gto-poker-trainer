import { useEffect, useMemo, useRef, useState } from 'react';
import { parseCard } from '../engine/cards';
import {
  ActStep,
  Choice,
  Hand,
  choicesAt,
  decisionPoints,
  matches,
  replayState,
} from '../lib/handReplay';
import { CardRow } from './Card';

const SEAT_LETTERS = 'ABCDEF';

interface Guess {
  step: number;
  picked: Choice['a'];
  actual: ActStep['a'];
  right: boolean;
}

/** Plays a recorded hand out on the felt, pausing wherever your seat must act. */
export function HandTheater({
  hand,
  seat,
  onExit,
}: {
  hand: Hand;
  seat: number;
  onExit: () => void;
}) {
  const n = hand.players.length;
  const decisions = useMemo(() => decisionPoints(hand, seat), [hand, seat]);
  const [step, setStep] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [reveal, setReveal] = useState(false);
  const [lastVerdict, setLastVerdict] = useState<Guess | null>(null);
  const timer = useRef<number | null>(null);

  const done = step >= hand.steps.length;
  // Pause when the next step is one of our decisions and we have not answered it.
  const pendingDecision =
    !done && decisions.includes(step) && !guesses.some((g) => g.step === step) ? step : null;

  // Auto-advance the replay except while waiting on the player.
  useEffect(() => {
    if (done || pendingDecision !== null) return;
    const next = hand.steps[step];
    const delay = next?.t === 'board' ? 1250 : 950;
    timer.current = window.setTimeout(() => {
      setStep((s) => s + 1);
      setLastVerdict(null);
    }, delay);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [step, done, pendingDecision, hand.steps]);

  const answer = (choice: Choice) => {
    if (pendingDecision === null) return;
    const actual = hand.steps[pendingDecision] as ActStep;
    const g: Guess = {
      step: pendingDecision,
      picked: choice.a,
      actual: actual.a,
      right: matches(choice.a, actual.a),
    };
    setGuesses((prev) => [...prev, g]);
    setLastVerdict(g);
  };

  const state = replayState(hand, step);
  // While the hand is live the pot shows everything wagered; once it is over,
  // any uncalled bet has gone back, so show what was really contested.
  const potNow = done ? state.effectivePot : state.pot;
  const money = (x: number) => (hand.currency === 'USD' ? `$${x.toLocaleString()}` : x.toLocaleString());
  const right = guesses.filter((g) => g.right).length;

  // Seat geometry: you sit at the bottom, everyone else fans around the oval.
  const seatStyle = (i: number) => {
    const rel = (i - seat + n) % n;
    const deg = 90 + (rel * 360) / n;
    const rad = (deg * Math.PI) / 180;
    return {
      left: `${50 + 40 * Math.cos(rad)}%`,
      top: `${50 + 36 * Math.sin(rad)}%`,
    };
  };

  const showCards = (i: number) => i === seat || reveal || state.shown[i];

  return (
    <div className="theater">
      <div className="theater-bar">
        <button className="link-btn" onClick={onExit}>
          ← back to hands
        </button>
        <span className="muted small">
          {state.street} · pot {money(potNow)}
          {decisions.length > 0 && ` · you got ${right}/${guesses.length}`}
        </span>
      </div>

      <div className="felt">
        <div className="felt-centre">
          <CardRow cards={state.board.map(parseCard)} dealt />
          <div className="felt-pot">{money(potNow)}</div>
        </div>

        {hand.players.map((_, i) => {
          const isHero = i === seat;
          const cards = hand.hole[i];
          return (
            <div
              key={i}
              className={`felt-seat ${state.folded[i] ? 'out' : ''} ${isHero ? 'hero' : ''}`}
              style={seatStyle(i)}
            >
              <div className="felt-name">
                {isHero ? 'You' : `Seat ${SEAT_LETTERS[i] ?? i + 1}`}
                {reveal && <span className="felt-real"> · {hand.players[i]}</span>}
              </div>
              <div className="felt-cards">
                {cards && showCards(i) ? (
                  <CardRow cards={cards.map(parseCard)} small dealt />
                ) : (
                  <CardRow cards={[null, null]} small />
                )}
              </div>
              <div className="felt-stack">{money(Math.max(0, state.stacks[i]))}</div>
              {state.lastAction[i] && <div className="felt-badge">{state.lastAction[i]}</div>}
              {state.bets[i] > 0 && <div className="felt-bet">{money(state.bets[i])}</div>}
            </div>
          );
        })}
      </div>

      {pendingDecision !== null && (
        <div className="theater-ask">
          <strong>Your move.</strong>
          <div className="theater-choices">
            {choicesAt(hand, pendingDecision).map((c) => (
              <button key={c.a} className="theater-choice" onClick={() => answer(c)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {lastVerdict && (
        <div className={`theater-verdict ${lastVerdict.right ? 'good' : 'bad'}`}>
          {lastVerdict.right ? '✓ That is what they did — ' : '✗ They actually chose to '}
          <strong>{lastVerdict.actual}</strong>
          {!lastVerdict.right && ` (you said ${lastVerdict.picked})`}.
        </div>
      )}

      {done && !reveal && (
        <div className="theater-end">
          <p>
            Hand over.{' '}
            {guesses.length > 0
              ? `You matched ${right} of ${guesses.length} decisions.`
              : 'Your seat never had to act.'}
          </p>
          <button className="primary big" onClick={() => setReveal(true)}>
            Reveal the hand
          </button>
        </div>
      )}

      {reveal && (
        <div className="theater-reveal panel">
          <h3>{hand.event || 'Recorded hand'}</h3>
          <p className="muted small">
            {hand.year ? `${hand.year} · ` : ''}
            blinds {hand.blinds.filter(Boolean).map(money).join(' / ')} · final pot {money(hand.pot)} (
            {hand.potBB} bb)
          </p>
          <table className="reveal-table">
            <tbody>
              {hand.players.map((name, i) => (
                <tr key={i} className={i === seat ? 'you' : ''}>
                  <td>{i === seat ? 'You' : `Seat ${SEAT_LETTERS[i] ?? i + 1}`}</td>
                  <td>{name}</td>
                  <td>
                    {hand.hole[i] ? (
                      <CardRow cards={hand.hole[i]!.map(parseCard)} small />
                    ) : (
                      <span className="muted small">never shown</span>
                    )}
                  </td>
                  <td className="muted small">{state.folded[i] ? 'folded' : 'to showdown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {guesses.length > 0 && (
            <p className="reveal-score">
              You matched <strong>{right}</strong> of {guesses.length} decisions.
            </p>
          )}
          <p className="muted small">
            Real recorded hand ·{' '}
            <a href={hand.source} target="_blank" rel="noreferrer">
              hand history
            </a>
          </p>
          <button className="primary" onClick={onExit}>
            Next hand →
          </button>
        </div>
      )}
    </div>
  );
}
