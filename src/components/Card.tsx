import { Card as CardT, rankOf, suitOf, RANKS, SUITS, SUIT_SYMBOLS } from '../engine/cards';

export function PlayingCard({ card, small }: { card: CardT | null; small?: boolean }) {
  if (card === null || card === undefined) {
    return <span className={`card card-back ${small ? 'card-sm' : ''}`}>?</span>;
  }
  const r = RANKS[rankOf(card)];
  const s = SUITS[suitOf(card)];
  const red = s === 'h' || s === 'd';
  return (
    <span className={`card ${red ? 'card-red' : 'card-black'} ${small ? 'card-sm' : ''}`}>
      <span className="card-rank">{r}</span>
      <span className="card-suit">{SUIT_SYMBOLS[s]}</span>
    </span>
  );
}

export function CardRow({ cards, small }: { cards: (CardT | null)[]; small?: boolean }) {
  return (
    <span className="card-row">
      {cards.map((c, i) => (
        <PlayingCard key={i} card={c} small={small} />
      ))}
    </span>
  );
}
