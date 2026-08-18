import { useEffect, useRef, useState } from 'react';
import { HoldemHand, HandConfig, Player } from '../game/holdem';
import { BOTS, botById } from '../bots/personalities';
import { CardRow } from './Card';
import { recordHand } from '../lib/handHistory';

const START_STACK = 1000;
const SB = 5;
const BB = 10;

interface SeatConfig {
  id: string;
  name: string;
  isHuman: boolean;
  botId?: string;
  stack: number;
}

export function PlayView({ initialBotId }: { initialBotId?: string | null }) {
  const [selectedBots, setSelectedBots] = useState<string[]>(
    initialBotId ? [initialBotId] : ['gto', 'station'],
  );
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <TableSetup
        selected={selectedBots}
        setSelected={setSelectedBots}
        onStart={() => setStarted(true)}
      />
    );
  }
  return <Table botIds={selectedBots} onQuit={() => setStarted(false)} />;
}

function TableSetup({
  selected,
  setSelected,
  onStart,
}: {
  selected: string[];
  setSelected: (s: string[]) => void;
  onStart: () => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id));
    else if (selected.length < 5) setSelected([...selected, id]);
  };
  return (
    <div className="view">
      <div className="panel">
        <h2>Set up your table</h2>
        <p className="muted">
          Pick 1–5 bots to sit with. Everyone starts with {START_STACK} chips, blinds {SB}/{BB}. Busted players auto-rebuy
          so you can grind uninterrupted.
        </p>
        <div className="bot-pick-grid">
          {BOTS.map((b) => (
            <button
              key={b.id}
              className={`bot-pick ${selected.includes(b.id) ? 'on' : ''}`}
              onClick={() => toggle(b.id)}
            >
              <span className="bot-avatar">{b.avatar}</span>
              <span className="bot-pick-name">{b.name}</span>
              <span className="bot-arch">{b.archetype}</span>
            </button>
          ))}
        </div>
        <button className="primary big" disabled={selected.length === 0} onClick={onStart}>
          Sit down ({selected.length + 1} players)
        </button>
      </div>
    </div>
  );
}

function Table({ botIds, onQuit }: { botIds: string[]; onQuit: () => void }) {
  const seatsRef = useRef<SeatConfig[]>([
    { id: 'hero', name: 'You', isHuman: true, stack: START_STACK },
    ...botIds.map((bid) => ({ id: bid, name: botById(bid).name, isHuman: false, botId: bid, stack: START_STACK })),
  ]);
  const buttonRef = useRef(0);
  const handRef = useRef<HoldemHand | null>(null);
  // Hero's stack when the hand was dealt, and a latch so a finished hand is
  // only written to the history once (the driver effect runs every render).
  const heroStartRef = useRef(START_STACK);
  const recordedRef = useRef(false);
  const [, setTick] = useState(0);
  const [handNum, setHandNum] = useState(0);
  const [raiseTo, setRaiseTo] = useState(BB * 3);

  const rerender = () => setTick((t) => t + 1);

  const startHand = () => {
    // Auto-rebuy short stacks.
    for (const s of seatsRef.current) if (s.stack < BB) s.stack = START_STACK;
    const cfg: HandConfig = {
      players: seatsRef.current.map((s) => ({
        id: s.id,
        name: s.name,
        isHuman: s.isHuman,
        bot: s.botId ? botById(s.botId) : undefined,
        stack: s.stack,
      })),
      smallBlind: SB,
      bigBlind: BB,
      buttonIndex: buttonRef.current % seatsRef.current.length,
      seed: (Date.now() ^ (handNum * 2654435761)) >>> 0,
    };
    heroStartRef.current = seatsRef.current[0].stack;
    recordedRef.current = false;
    handRef.current = new HoldemHand(cfg);
    setHandNum((n) => n + 1);
    rerender();
  };

  // Start the first hand on mount.
  useEffect(() => {
    if (!handRef.current) startHand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive bots automatically.
  useEffect(() => {
    const hand = handRef.current;
    if (!hand || hand.finished) {
      // persist stacks when a hand ends
      if (hand?.finished) {
        hand.players.forEach((p, i) => (seatsRef.current[i].stack = p.stack));
        if (!recordedRef.current) {
          recordedRef.current = true;
          const hero = hand.players[0];
          const heroIdx = hand.players.findIndex((p) => p.isHuman);
          recordHand({
            ts: Date.now(),
            hole: hero.hole ?? [0, 0],
            board: [...hand.board],
            bots: [...botIds],
            net: hero.stack - heroStartRef.current,
            bigBlind: BB,
            invested: hero.totalCommitted,
            sawShowdown: hand.players.filter((p) => !p.folded).length > 1,
            won: hand.winners.includes(heroIdx),
            log: hand.log.map((l) => ({ text: l.text, kind: l.kind })),
          });
        }
      }
      return;
    }
    if (!hand.isHumanTurn()) {
      const t = setTimeout(() => {
        hand.stepBot();
        rerender();
      }, 650);
      return () => clearTimeout(t);
    }
  });

  const hand = handRef.current;
  const legal = hand && hand.isHumanTurn() ? hand.legalActions() : null;

  // keep raise slider within legal bounds
  useEffect(() => {
    if (legal) setRaiseTo((r) => Math.min(Math.max(r, legal.minRaiseTo), legal.maxRaiseTo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legal?.minRaiseTo, legal?.maxRaiseTo]);

  if (!hand) return <div className="view">Dealing…</div>;

  const hero = hand.players.find((p) => p.isHuman)!;
  const showdown = hand.finished;

  const doAct = (kind: 'fold' | 'check' | 'call' | 'raise', amt?: number) => {
    hand.act(kind, amt);
    rerender();
  };

  const nextHand = () => {
    buttonRef.current = (buttonRef.current + 1) % seatsRef.current.length;
    startHand();
  };

  return (
    <div className="view play-view">
      <div className="table-bar">
        <span>
          Hand #{handNum} · Blinds {SB}/{BB}
        </span>
        <span>Pot: {hand.pot}</span>
        <button className="link-btn" onClick={onQuit}>
          ← Leave table
        </button>
      </div>

      <div className="table-felt">
        <div className="table-center">
          <CardRow cards={padBoard(hand.board)} dealt />
          <div className="pot-chip">Pot {hand.pot}</div>
        </div>

        {hand.players.map((p, i) => {
          const isCurrent = hand.toActIndex === i && !hand.finished;
          const isWinner = showdown && hand.winners.includes(i);
          const reveal = p.isHuman || showdown;
          const pos = seatPosition(i, hand.players.length);
          return (
            <div
              key={p.id}
              className={`seat seat-abs ${i === 0 ? 'seat-hero' : ''} ${p.folded ? 'folded' : ''} ${isCurrent ? 'to-act' : ''} ${isWinner ? 'winner' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="seat-head">
                <span className="seat-name">
                  {!p.isHuman && botById(p.bot!.id).avatar} {p.name}
                  {hand.buttonIndex === i && <span className="dealer-btn">D</span>}
                </span>
                <span className="seat-stack">{p.stack}</span>
              </div>
              <div className="seat-cards">
                {p.hole ? (
                  reveal ? (
                    <CardRow cards={p.hole} small />
                  ) : (
                    <CardRow cards={[null, null]} small />
                  )
                ) : null}
              </div>
              {p.committed > 0 && <div className="seat-bet">{p.committed}</div>}
              {isCurrent && !p.isHuman && (
                <div className="seat-thinking" aria-label="thinking">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {p.lastAction && !isCurrent && <div className={`action-badge ${p.lastAction === 'FOLD' ? 'is-fold' : ''}`}>{p.lastAction}</div>}
              {isWinner && <div className="seat-status win">WINS</div>}
            </div>
          );
        })}
      </div>

      {legal && (
        <div className="action-bar">
          {legal.canFold && (
            <button className="act fold" onClick={() => doAct('fold')}>
              Fold
            </button>
          )}
          {legal.canCheck && (
            <button className="act check" onClick={() => doAct('check')}>
              Check
            </button>
          )}
          {legal.canCall && (
            <button className="act call" onClick={() => doAct('call')}>
              Call {legal.callAmount}
            </button>
          )}
          {legal.canRaise && legal.maxRaiseTo > legal.minRaiseTo && (
            <div className="raise-controls">
              <input
                type="range"
                min={legal.minRaiseTo}
                max={legal.maxRaiseTo}
                value={raiseTo}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
              />
              <div className="raise-presets">
                <button onClick={() => setRaiseTo(clampTo(Math.round(hand.pot * 0.5), legal))}>½ pot</button>
                <button onClick={() => setRaiseTo(clampTo(Math.round(hand.pot * 0.75), legal))}>¾ pot</button>
                <button onClick={() => setRaiseTo(clampTo(hand.pot, legal))}>pot</button>
                <button onClick={() => setRaiseTo(legal.maxRaiseTo)}>all-in</button>
              </div>
              <button className="act raise" onClick={() => doAct('raise', raiseTo)}>
                {raiseTo >= legal.maxRaiseTo ? `All-in ${raiseTo}` : `Raise to ${raiseTo}`}
              </button>
            </div>
          )}
          {legal.canRaise && legal.maxRaiseTo <= legal.minRaiseTo && (
            <button className="act raise" onClick={() => doAct('raise', legal.maxRaiseTo)}>
              All-in {legal.maxRaiseTo}
            </button>
          )}
        </div>
      )}

      {showdown && (
        <div className="action-bar">
          <button className="primary big" onClick={nextHand}>
            Next hand →
          </button>
        </div>
      )}

      <HandLog hand={hand} hero={hero} />
    </div>
  );
}

function HandLog({ hand, hero }: { hand: HoldemHand; hero: Player }) {
  const log = hand.log;
  return (
    <div className="hand-log">
      <div className="hand-log-head">
        <span>
          Your hand: {hero.hole ? <CardRow cards={hero.hole} small /> : '—'}
        </span>
      </div>
      <div className="log-lines">
        {log.slice(-12).map((l, i) => (
          <div key={i} className={`log-line ${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// Seat coordinates (%) around the oval. Index 0 is always the hero (bottom
// center); bots spread along the top arc, left to right.
function seatPosition(index: number, count: number): { x: number; y: number } {
  if (index === 0) return { x: 50, y: 84 };
  const arcs: Record<number, { x: number; y: number }[]> = {
    2: [{ x: 50, y: 12 }],
    3: [
      { x: 26, y: 14 },
      { x: 74, y: 14 },
    ],
    4: [
      { x: 14, y: 28 },
      { x: 50, y: 10 },
      { x: 86, y: 28 },
    ],
    5: [
      { x: 11, y: 34 },
      { x: 30, y: 11 },
      { x: 70, y: 11 },
      { x: 89, y: 34 },
    ],
    6: [
      { x: 9, y: 38 },
      { x: 26, y: 12 },
      { x: 50, y: 8 },
      { x: 74, y: 12 },
      { x: 91, y: 38 },
    ],
  };
  const arc = arcs[count] ?? arcs[6];
  return arc[Math.min(index - 1, arc.length - 1)];
}

function padBoard(board: number[]): (number | null)[] {
  const out: (number | null)[] = [...board];
  while (out.length < 5) out.push(null);
  return out;
}

function clampTo(v: number, legal: { minRaiseTo: number; maxRaiseTo: number }): number {
  return Math.min(Math.max(v, legal.minRaiseTo), legal.maxRaiseTo);
}
