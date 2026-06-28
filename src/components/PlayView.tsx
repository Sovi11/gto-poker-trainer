import { useEffect, useRef, useState } from 'react';
import { HoldemHand, HandConfig, Player } from '../game/holdem';
import { BOTS, botById } from '../bots/personalities';
import { CardRow } from './Card';

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

      <div className="poker-table">
        <div className="board-area">
          <div className="board-label">Board</div>
          <CardRow cards={padBoard(hand.board)} />
          <div className="pot-chip">Pot {hand.pot}</div>
        </div>

        <div className="seats">
          {hand.players.map((p, i) => {
            const isCurrent = hand.toActIndex === i && !hand.finished;
            const isWinner = showdown && hand.winners.includes(i);
            const reveal = p.isHuman || showdown;
            return (
              <div key={p.id} className={`seat ${p.folded ? 'folded' : ''} ${isCurrent ? 'to-act' : ''} ${isWinner ? 'winner' : ''}`}>
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
                {p.committed > 0 && <div className="seat-bet">bet {p.committed}</div>}
                {p.folded && <div className="seat-status">folded</div>}
                {isWinner && <div className="seat-status win">winner</div>}
              </div>
            );
          })}
        </div>
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

function padBoard(board: number[]): (number | null)[] {
  const out: (number | null)[] = [...board];
  while (out.length < 5) out.push(null);
  return out;
}

function clampTo(v: number, legal: { minRaiseTo: number; maxRaiseTo: number }): number {
  return Math.min(Math.max(v, legal.minRaiseTo), legal.maxRaiseTo);
}
