import { Card as CardT, rankOf, suitOf, RANKS, SUITS, SUIT_SYMBOLS } from '../engine/cards';

export function PlayingCard({ card, small }: { card: CardT | null; small?: boolean }) {
  if (card === null || card === undefined) {
    return (
      <span className={`card card-back ${small ? 'card-sm' : ''}`} aria-label="face-down card">
        <span className="card-back-pattern">♠</span>
      </span>
    );
  }
  const r = RANKS[rankOf(card)];
  const s = SUITS[suitOf(card)];
  const red = s === 'h' || s === 'd';
  return (
    <span className={`card ${red ? 'card-red' : 'card-black'} ${small ? 'card-sm' : ''}`} aria-label={`${r}${s}`}>
      <span className="card-corner">
        <span className="card-rank">{r}</span>
        <span className="card-corner-suit">{SUIT_SYMBOLS[s]}</span>
      </span>
      <span className="card-pip">{SUIT_SYMBOLS[s]}</span>
    </span>
  );
}

export function CardRow({ cards, small, dealt }: { cards: (CardT | null)[]; small?: boolean; dealt?: boolean }) {
  return (
    <span className={`card-row ${dealt ? 'card-row-dealt' : ''}`}>
      {cards.map((c, i) => (
        <span key={i} className="card-slot" style={dealt ? { animationDelay: `${i * 70}ms` } : undefined}>
          <PlayingCard card={c} small={small} />
        </span>
      ))}
    </span>
  );
}
