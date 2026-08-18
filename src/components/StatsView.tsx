import { useMemo, useState } from 'react';
import { cardToString } from '../engine/cards';
import { handVsRandomEquity } from '../engine/equity';
import { describeScore, evaluateBest } from '../engine/evaluator';
import { handClassOf } from '../bots/preflopStrength';
import { botById, BOTS } from '../bots/personalities';
import {
  HandRecord,
  clearHands,
  computeStats,
  deleteHand,
  equityCurve,
  loadHands,
  setNote,
  setStarred,
  statsByBot,
} from '../lib/handHistory';
import { CardRow } from './Card';

type Tab = 'overview' | 'bots' | 'hands' | 'saved';

export function StatsView() {
  const [tab, setTab] = useState<Tab>('overview');
  const [version, bump] = useState(0);
  const hands = useMemo(() => loadHands(), [version]);
  const refresh = () => bump((v) => v + 1);

  const stats = useMemo(() => computeStats(hands), [hands]);

  if (hands.length === 0) {
    return (
      <div className="view">
        <div className="panel empty-state">
          <h2>No hands yet</h2>
          <p className="muted">
            Sit down at the Play table and your results appear here — win rate against each bot, a results graph, and
            every hand you play, ready to save and analyze.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="panel">
        <h2>Your Stats</h2>
        <p className="muted">
          {stats.hands} hands played · results are tracked per profile and stay in this browser.
        </p>
        <div className="subtabs stats-tabs">
          {(['overview', 'bots', 'hands', 'saved'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'saved' ? `Saved (${hands.filter((h) => h.starred).length})` : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && <Overview hands={hands} />}
      {tab === 'bots' && <ByBot hands={hands} />}
      {tab === 'hands' && <HandList hands={hands} onChange={refresh} />}
      {tab === 'saved' && <HandList hands={hands.filter((h) => h.starred)} onChange={refresh} savedOnly />}
    </div>
  );
}

function Overview({ hands }: { hands: HandRecord[] }) {
  const s = computeStats(hands);
  const curve = useMemo(() => equityCurve(hands), [hands]);
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return (
    <>
      <div className="math-grid">
        <Stat label="Net chips" value={sign(s.net)} tone={s.net >= 0 ? 'good' : 'bad'} note="since you started" />
        <Stat
          label="Win rate"
          value={`${s.bb100 >= 0 ? '+' : ''}${s.bb100.toFixed(1)}`}
          tone={s.bb100 >= 0 ? 'good' : 'bad'}
          note="bb / 100 hands"
        />
        <Stat label="Hands won" value={`${Math.round((s.won / s.hands) * 100)}%`} note={`${s.won} of ${s.hands}`} />
        <Stat
          label="Showdown win"
          value={s.showdowns ? `${Math.round((s.showdownWins / s.showdowns) * 100)}%` : '—'}
          note={`${s.showdowns} showdowns`}
        />
        <Stat label="Biggest pot" value={sign(s.biggestPot)} tone="good" note="best single hand" />
        <Stat label="Worst hand" value={sign(s.biggestLoss)} tone="bad" note="largest loss" />
      </div>

      <div className="panel">
        <h3>Results over time</h3>
        <Curve points={curve} />
        <p className="muted small">
          Cumulative chips across {hands.length} hands. Small samples swing wildly — judge the decisions, not the line.
        </p>
      </div>
    </>
  );
}

function Curve({ points }: { points: number[] }) {
  if (points.length < 2) return <p className="muted">Play a few more hands to see a curve.</p>;
  const w = 640;
  const h = 160;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / span) * h;
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const zeroY = y(0);
  const end = points[points.length - 1];

  return (
    <svg className="curve" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Results graph">
      <line x1={0} y1={zeroY} x2={w} y2={zeroY} className="curve-zero" />
      <path d={`${d} L${w},${zeroY} L0,${zeroY} Z`} className={`curve-fill ${end >= 0 ? 'up' : 'down'}`} />
      <path d={d} className={`curve-line ${end >= 0 ? 'up' : 'down'}`} />
    </svg>
  );
}

function ByBot({ hands }: { hands: HandRecord[] }) {
  const [headsUp, setHeadsUp] = useState(false);
  const table = useMemo(() => statsByBot(hands, headsUp), [hands, headsUp]);
  const rows = BOTS.map((b) => ({ bot: b, s: table[b.id] })).filter((r) => r.s && r.s.hands > 0);

  return (
    <div className="panel">
      <div className="drill-head">
        <div>
          <h3>Win rate by opponent</h3>
          <p className="muted small">
            {headsUp
              ? 'Heads-up hands only — a clean read on each bot.'
              : 'All hands. A multiway pot counts once for every bot at the table, so these overlap.'}
          </p>
        </div>
        <button className="link-btn" onClick={() => setHeadsUp((v) => !v)}>
          {headsUp ? 'show all hands' : 'heads-up only'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No heads-up hands yet — sit with a single bot to get a clean win rate.</p>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Hands</th>
              <th>Net</th>
              <th>bb/100</th>
              <th>Won</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bot, s }) => (
              <tr key={bot.id}>
                <td>
                  <span className="bot-avatar">{bot.avatar}</span> {bot.name}
                  <span className="muted small"> · {bot.archetype}</span>
                </td>
                <td>{s.hands}</td>
                <td className={s.net >= 0 ? 'pos' : 'neg'}>{s.net > 0 ? `+${s.net}` : s.net}</td>
                <td className={s.bb100 >= 0 ? 'pos' : 'neg'}>
                  {s.bb100 >= 0 ? '+' : ''}
                  {s.bb100.toFixed(1)}
                </td>
                <td>{Math.round((s.won / s.hands) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">
        A few hundred hands is still noise — bb/100 only starts meaning something in the thousands.
      </p>
    </div>
  );
}

function HandList({
  hands,
  onChange,
  savedOnly,
}: {
  hands: HandRecord[];
  onChange: () => void;
  savedOnly?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (hands.length === 0) {
    return (
      <div className="panel empty-state">
        <h3>Nothing saved yet</h3>
        <p className="muted">Star a hand from the Hands tab to keep it here for study.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="drill-head">
        <h3>{savedOnly ? 'Saved hands' : 'Recent hands'}</h3>
        {!savedOnly && (
          <button
            className="link-btn"
            onClick={() => {
              if (confirm('Clear all unsaved hands? Starred hands are kept.')) {
                clearHands();
                onChange();
              }
            }}
          >
            clear unsaved
          </button>
        )}
      </div>

      <div className="hand-list">
        {hands.slice(0, 60).map((h) => (
          <div key={h.id} className={`hand-item ${openId === h.id ? 'open' : ''}`}>
            <button className="hand-summary" onClick={() => setOpenId(openId === h.id ? null : h.id)}>
              <CardRow cards={h.hole} small />
              <span className="hand-board muted">
                {h.board.length ? h.board.map(cardToString).join(' ') : 'no flop'}
              </span>
              <span className="hand-vs muted small">
                {h.bots.map((b) => botById(b).avatar).join('')}
              </span>
              <span className={`hand-net ${h.net >= 0 ? 'pos' : 'neg'}`}>
                {h.net > 0 ? `+${h.net}` : h.net}
              </span>
            </button>
            <button
              className={`hand-star ${h.starred ? 'on' : ''}`}
              title={h.starred ? 'Unsave' : 'Save for study'}
              onClick={() => {
                setStarred(h.id, !h.starred);
                onChange();
              }}
            >
              {h.starred ? '★' : '☆'}
            </button>
            {openId === h.id && <HandDetail hand={h} onChange={onChange} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function HandDetail({ hand, onChange }: { hand: HandRecord; onChange: () => void }) {
  const [note, setLocalNote] = useState(hand.note ?? '');

  // Post-hoc analysis: what the hand actually was, and how it rated preflop.
  const analysis = useMemo(() => {
    const cls = handClassOf(hand.hole);
    const preflop = handVsRandomEquity(hand.hole, 4000, 99);
    const made =
      hand.board.length >= 3 ? describeScore(evaluateBest([...hand.hole, ...hand.board])) : null;
    return { cls, preflopEquity: preflop.equity, made };
  }, [hand]);

  return (
    <div className="hand-detail">
      <div className="hand-analysis">
        <div>
          <span className="muted small">Starting hand</span>
          <strong>{analysis.cls}</strong>
        </div>
        <div>
          <span className="muted small">Equity vs random</span>
          <strong>{(analysis.preflopEquity * 100).toFixed(1)}%</strong>
        </div>
        {analysis.made && (
          <div>
            <span className="muted small">Made hand</span>
            <strong>{analysis.made}</strong>
          </div>
        )}
        <div>
          <span className="muted small">Result</span>
          <strong className={hand.net >= 0 ? 'pos' : 'neg'}>
            {hand.net > 0 ? `+${hand.net}` : hand.net} ({(hand.net / hand.bigBlind).toFixed(1)} bb)
          </strong>
        </div>
      </div>

      <div className="hand-log-replay">
        {hand.log.map((l, i) => (
          <div key={i} className={`log-line ${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>

      <label className="hand-note">
        Your note
        <textarea
          rows={2}
          value={note}
          placeholder="What did you get wrong here?"
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => {
            setNote(hand.id, note);
            onChange();
          }}
        />
      </label>

      <button
        className="link-btn danger"
        onClick={() => {
          deleteHand(hand.id);
          onChange();
        }}
      >
        delete hand
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="math-stat">
      <div className="math-stat-label">{label}</div>
      <div className={`math-stat-value ${tone ?? ''}`}>{value}</div>
      <div className="math-stat-note">{note}</div>
    </div>
  );
}
