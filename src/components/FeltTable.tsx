import { parseCard } from '../engine/cards';
import { Hand, TableState } from '../lib/handReplay';
import { CardRow } from './Card';

const SEAT_LETTERS = 'ABCDEF';

// The animated felt: board, pot, and seats fanned around the oval. Pure
// render of a TableState — Study's theater and the Daily both draw exactly
// this, so a hand can never look different between the two.
export function FeltTable({
  hand,
  seat,
  state,
  pot,
  showCards,
  showRealNames = false,
}: {
  hand: Hand;
  seat: number;
  state: TableState;
  /** What the pot line displays (live total vs contested pot is the caller's call). */
  pot: number;
  showCards: (i: number) => boolean;
  showRealNames?: boolean;
}) {
  const n = hand.players.length;
  const sym = hand.symbol ?? (hand.currency === 'USD' ? '$' : '');
  const money = (x: number) => `${sym}${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

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

  return (
    <div className="felt">
      <div className="felt-centre">
        <CardRow cards={state.board.map(parseCard)} dealt />
        <div className="felt-pot">{money(pot)}</div>
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
              {showRealNames && <span className="felt-real"> · {hand.players[i]}</span>}
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
  );
}
