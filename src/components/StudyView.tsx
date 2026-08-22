import { useEffect, useMemo, useState } from 'react';
import { Hand, candidateSeats, replayState } from '../lib/handReplay';
import { useProfileState } from '../lib/profiles';
import { HandTheater } from './HandTheater';

const SEAT_LETTERS = 'ABCDEF';

// The library is a few hundred KB of hand histories. Load it on demand so it
// never slows the first paint for someone who came here to play or drill.
let cached: Hand[] | null = null;
async function loadLibrary(): Promise<Hand[]> {
  if (!cached) {
    const mod = await import('../data/handLibrary.json');
    cached = (mod.default ?? mod) as unknown as Hand[];
  }
  return cached;
}

type Sort = 'pot' | 'action' | 'unplayed' | 'random';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'pot', label: 'Biggest pots' },
  { id: 'action', label: 'Most action' },
  { id: 'unplayed', label: 'Not played yet' },
  { id: 'random', label: 'Shuffle' },
];

type Group = 'all' | 'online' | 'famous' | 'wsop' | 'pluribus';
const GROUPS: { id: Group; label: string }[] = [
  { id: 'all', label: 'All hands' },
  { id: 'online', label: 'Real games' },
  { id: 'famous', label: 'Televised' },
  { id: 'wsop', label: 'WSOP' },
  { id: 'pluribus', label: 'Pluribus (AI)' },
];

export function StudyView() {
  const [HANDS, setHands] = useState<Hand[] | null>(cached);
  const [group, setGroup] = useState<Group>('all');
  const [sort, setSort] = useState<Sort>('pot');
  const [shown, setShown] = useState(48);
  const [seed, setSeed] = useState(1);
  const [handId, setHandId] = useState<string | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [played, setPlayed] = useProfileState<string[]>('study.played', []);

  useEffect(() => {
    let live = true;
    loadLibrary().then((h) => live && setHands(h));
    return () => {
      live = false;
    };
  }, []);

  const hands = useMemo(() => {
    if (!HANDS) return [];
    const pool = group === 'all' ? HANDS : HANDS.filter((h) => h.group === group);
    const list = [...pool];
    if (sort === 'action') {
      list.sort((a, b) => b.steps.length - a.steps.length);
    } else if (sort === 'unplayed') {
      list.sort((a, b) => Number(played.includes(a.id)) - Number(played.includes(b.id)) || b.potBB - a.potBB);
    } else if (sort === 'random') {
      // Deterministic shuffle so the order is stable until you reshuffle.
      const key = (h: Hand) => {
        let x = seed;
        for (let i = 0; i < h.id.length; i++) x = (x * 31 + h.id.charCodeAt(i)) >>> 0;
        return x;
      };
      list.sort((a, b) => key(a) - key(b));
    }
    return list; // 'pot' is the order the library ships in
  }, [HANDS, group, sort, played, seed]);
  const hand = handId && HANDS ? HANDS.find((h) => h.id === handId) ?? null : null;

  const exit = () => {
    if (hand && !played.includes(hand.id)) setPlayed((p) => [...p, hand.id]);
    setHandId(null);
    setSeat(null);
  };

  if (hand && seat !== null) {
    return (
      <div className="view">
        <HandTheater hand={hand} seat={seat} onExit={exit} />
      </div>
    );
  }

  if (hand) {
    return (
      <div className="view">
        <SeatPicker hand={hand} onPick={setSeat} onCancel={() => setHandId(null)} />
      </div>
    );
  }

  if (!HANDS) {
    return (
      <div className="view">
        <div className="panel empty-state">
          <h2>Study</h2>
          <p className="muted">Loading the hand library…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="panel">
        <h2>Study</h2>
        <p className="muted">
          {HANDS.length} real recorded hands. Pick a seat blind, watch it play out, and call the decisions before they
          happen. Nobody’s cards — or names — are shown until the hand is over.
        </p>
        <div className="subtabs study-filters">
          {GROUPS.map((g) => (
            <button key={g.id} className={group === g.id ? 'active' : ''} onClick={() => setGroup(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="study-sort">
        <span className="muted small">Sort</span>
        {SORTS.map((o) => (
          <button
            key={o.id}
            className={`sort-chip ${sort === o.id ? 'on' : ''}`}
            onClick={() => {
              setSort(o.id);
              setShown(48);
              if (o.id === 'random') setSeed((v) => v + 1);
            }}
          >
            {o.label}
          </button>
        ))}
        <span className="muted small study-count">
          {hands.length} hands · {played.length} played
        </span>
      </div>

      <div className="hand-cards">
        {hands.slice(0, shown).map((h) => (
          <button key={h.id} className="hand-tile" onClick={() => setHandId(h.id)}>
            <span className={`tile-group ${h.group}`}>
              {h.group === 'online'
                ? h.venue ?? 'Real game'
                : h.group === 'pluribus'
                  ? 'Pluribus'
                  : h.group === 'wsop'
                    ? 'WSOP'
                    : 'Televised'}
            </span>
            <span className="tile-pot">{h.potBB} bb</span>
            <span className="tile-meta muted small">
              {h.players.length}-handed · {h.board.length ? `${h.board.length} card board` : 'preflop'}
              {played.includes(h.id) ? ' · played' : ''}
            </span>
          </button>
        ))}
      </div>

      {shown < hands.length && (
        <button className="load-more" onClick={() => setShown((v) => v + 48)}>
          Show more ({hands.length - shown} left)
        </button>
      )}
    </div>
  );
}

function SeatPicker({ hand, onPick, onCancel }: { hand: Hand; onPick: (s: number) => void; onCancel: () => void }) {
  const seats = candidateSeats(hand);
  const start = replayState(hand, 0);
  const sym = hand.symbol ?? (hand.currency === 'USD' ? '$' : '');
  const money = (x: number) => `${sym}${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="panel seat-pick">
      <h2>Choose your seat</h2>
      <p className="muted">
        Two seats played this pot. You get their stack and their blind — nothing else. No names, no cards, no idea which
        one is about to do something remarkable.
      </p>
      <div className="seat-options">
        {seats.map((i) => (
          <button key={i} className="seat-option" onClick={() => onPick(i)}>
            <span className="seat-letter">Seat {SEAT_LETTERS[i] ?? i + 1}</span>
            <span className="seat-stat">
              {money(hand.stacks[i])} <span className="muted small">stack</span>
            </span>
            <span className="seat-stat">
              {(hand.stacks[i] / hand.bb).toFixed(0)} bb <span className="muted small">deep</span>
            </span>
            <span className="muted small">
              {start.bets[i] > 0 ? `posted ${money(start.bets[i])}` : 'no blind'}
            </span>
          </button>
        ))}
      </div>
      <button className="link-btn" onClick={onCancel}>
        ← pick a different hand
      </button>
    </div>
  );
}
