import { useMemo, useState } from 'react';
import { Card, parseCard, cardToString, fullDeck, shuffle } from '../engine/cards';
import { handVsHandEquity, EquityResult } from '../engine/equity';
import { describeScore, evaluateBest } from '../engine/evaluator';
import { parseRange, comboCount, TOTAL_COMBOS } from '../engine/range';
import { RFI_CHARTS, RESPONSE_CHARTS, PreflopChart } from '../gto/ranges';
import { PUSHFOLD_TABLE, nearestPushFold, PUSHFOLD_DEPTHS } from '../gto/pushfold';
import {
  requiredEquity,
  minDefenseFrequency,
  alpha,
  balancedBluffFraction,
  valueToBluffRatio,
  spr,
  ruleOfNEquity,
} from '../engine/gtomath';
import { solveRiverGame, closedForm, bestBettorEV, bestDefenderEV } from '../solver/rivergame';
import { TreeSolverView } from './TreeSolverView';
import { RangeGrid } from './RangeGrid';
import { CardRow } from './Card';

type Mode = 'equity' | 'charts' | 'pushfold' | 'math' | 'river' | 'tree';

export function SolverView() {
  const [mode, setMode] = useState<Mode>('equity');
  return (
    <div className="view">
      <div className="subtabs">
        <button className={mode === 'equity' ? 'active' : ''} onClick={() => setMode('equity')}>
          Hand vs Hand
        </button>
        <button className={mode === 'charts' ? 'active' : ''} onClick={() => setMode('charts')}>
          Preflop Charts
        </button>
        <button className={mode === 'pushfold' ? 'active' : ''} onClick={() => setMode('pushfold')}>
          Push / Fold
        </button>
        <button className={mode === 'math' ? 'active' : ''} onClick={() => setMode('math')}>
          GTO Math
        </button>
        <button className={mode === 'river' ? 'active' : ''} onClick={() => setMode('river')}>
          River Solver
        </button>
        <button className={mode === 'tree' ? 'active' : ''} onClick={() => setMode('tree')}>
          Tree Solver
        </button>
      </div>
      {mode === 'equity' && <EquityTool />}
      {mode === 'charts' && <ChartsTool />}
      {mode === 'pushfold' && <PushFoldTool />}
      {mode === 'math' && <MathTool />}
      {mode === 'river' && <RiverSolverTool />}
      {mode === 'tree' && <TreeSolverView />}
    </div>
  );
}

function RiverSolverTool() {
  const [pot, setPot] = useState(100);
  const [bet, setBet] = useState(100);
  const [yourCall, setYourCall] = useState(50); // what-if: defender call %
  const [yourBluff, setYourBluff] = useState(50); // what-if: bettor bluff %

  const params = useMemo(() => ({ pot, bet, valueFrac: 0.5 }), [pot, bet]);
  const sol = useMemo(() => solveRiverGame(params), [params]);
  const cf = useMemo(() => closedForm(params), [params]);

  const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
  const bluffShareOfBets = sol.bluffFreq * 0.5 === 0 ? 0 : (0.5 * sol.bluffFreq) / (0.5 * sol.betNuts + 0.5 * sol.bluffFreq);

  // Exploit explorer: how much a fixed leak loses to a best response.
  const vsYourCall = bestBettorEV(params, yourCall / 100) - sol.bettorEV; // bettor's gain vs your call freq
  const defGainVsBluff = bestDefenderEV(params, 1, yourBluff / 100) - sol.defenderEV;

  return (
    <div className="panel">
      <h2>River Solver</h2>
      <p className="muted">
        A real solver (counterfactual regret minimization) for the polarized river spot: you bet the nuts or air, villain
        holds a bluff-catcher. It converges to the exact Nash equilibrium live in your browser — then shows you what any
        deviation loses to a best response.
      </p>

      <div className="math-inputs">
        <label>
          Pot
          <input type="number" min={1} value={pot} onChange={(e) => setPot(Math.max(1, Number(e.target.value)))} />
        </label>
        <label>
          Bet size
          <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value)))} />
        </label>
        <div className="math-presets">
          {[0.33, 0.5, 0.75, 1, 1.5, 2].map((f) => (
            <button key={f} onClick={() => setBet(Math.round(pot * f))}>
              {f === 1 ? 'pot' : `${Math.round(f * 100)}%`}
            </button>
          ))}
        </div>
      </div>

      <h3>Equilibrium</h3>
      <div className="math-grid">
        <MathStat label="Value bet (nuts)" value={pct(sol.betNuts, 0)} note="always" />
        <MathStat label="Bluff (with air)" value={pct(sol.bluffFreq)} note={`${pct(bluffShareOfBets)} of all bets are bluffs`} />
        <MathStat label="Villain calls (MDF)" value={pct(sol.callFreq)} note={`closed form: ${pct(cf.callFreq)}`} />
        <MathStat label="Bettor EV" value={sol.bettorEV.toFixed(1)} note={`of the ${pot} pot`} />
        <MathStat label="Exploitability" value={pct(sol.exploitability, 2)} note={`of the pot · ${sol.iterations.toLocaleString()} CFR iters`} />
      </div>

      <h3>Exploit explorer</h3>
      <p className="muted">Drag a strategy off equilibrium and see what a perfect opponent extracts from the leak.</p>

      <div className="exploit-row">
        <label>
          You defend (call) <strong>{yourCall}%</strong> of the time
          <input type="range" min={0} max={100} value={yourCall} onChange={(e) => setYourCall(Number(e.target.value))} />
        </label>
        <div className={`exploit-verdict ${vsYourCall > 0.5 ? 'leak' : 'sound'}`}>
          {vsYourCall > 0.5 ? (
            <>
              Best response: {yourCall / 100 < cf.callFreq ? 'bluff every hand' : 'never bluff, value bet only'} →
              villain gains <strong>+{vsYourCall.toFixed(1)}</strong> per hand over equilibrium.
            </>
          ) : (
            <>At MDF — villain’s bluffs and value make the same profit no matter what they do.</>
          )}
        </div>
      </div>

      <div className="exploit-row">
        <label>
          You bluff <strong>{yourBluff}%</strong> of your air
          <input type="range" min={0} max={100} value={yourBluff} onChange={(e) => setYourBluff(Number(e.target.value))} />
        </label>
        <div className={`exploit-verdict ${defGainVsBluff > 0.5 ? 'leak' : 'sound'}`}>
          {defGainVsBluff > 0.5 ? (
            <>
              Best response: {yourBluff / 100 > cf.bluffFreq ? 'call every bluff-catcher' : 'fold every bluff-catcher'} →
              villain gains <strong>+{defGainVsBluff.toFixed(1)}</strong> per hand over equilibrium.
            </>
          ) : (
            <>Balanced — your value-to-bluff ratio makes villain indifferent between calling and folding.</>
          )}
        </div>
      </div>

      <p className="muted small">
        Fixed 50/50 nuts-or-air range. The lesson: equilibrium isn’t about winning the maximum — it’s the strategy that
        concedes nothing to any counter-strategy. Suppress your leaks, then exploit theirs.
      </p>
    </div>
  );
}

function MathTool() {
  const [pot, setPot] = useState(100);
  const [bet, setBet] = useState(66);
  const [stack, setStack] = useState(400);
  const [outs, setOuts] = useState(9);

  const req = requiredEquity(pot, bet) * 100;
  const mdf = minDefenseFrequency(pot, bet) * 100;
  const a = alpha(pot, bet) * 100;
  const bluff = balancedBluffFraction(pot, bet) * 100;
  const ratio = valueToBluffRatio(pot, bet);
  const num = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—');

  return (
    <div className="panel">
      <h2>GTO Math</h2>
      <p className="muted">
        The formulas behind the theory, live. Change the pot and bet and watch MDF, alpha, and the balanced bluff ratio
        move — these are the same functions the Drills tab grades you on.
      </p>

      <div className="math-inputs">
        <label>
          Pot (before the bet)
          <input type="number" min={1} value={pot} onChange={(e) => setPot(Math.max(1, Number(e.target.value)))} />
        </label>
        <label>
          Bet size
          <input type="number" min={1} value={bet} onChange={(e) => setBet(Math.max(1, Number(e.target.value)))} />
        </label>
        <div className="math-presets">
          {[0.33, 0.5, 0.66, 0.75, 1].map((f) => (
            <button key={f} onClick={() => setBet(Math.round(pot * f))}>
              {f === 1 ? 'pot' : `${Math.round(f * 100)}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="math-grid">
        <MathStat label="Required equity to call" value={`${num(req)}%`} note="bet ÷ (pot + 2·bet)" />
        <MathStat label="Min defence frequency (MDF)" value={`${num(mdf)}%`} note="pot ÷ (pot + bet)" />
        <MathStat label="Alpha (bluff must work)" value={`${num(a)}%`} note="bet ÷ (pot + bet)" />
        <MathStat label="Balanced bluff fraction" value={`${num(bluff)}%`} note="of your betting range" />
        <MathStat label="Value : bluff" value={`${num(ratio, 2)} : 1`} note="for an unexploitable range" />
      </div>

      <div className="math-inputs">
        <label>
          Effective stack
          <input type="number" min={1} value={stack} onChange={(e) => setStack(Math.max(1, Number(e.target.value)))} />
        </label>
        <label>
          Pot (for SPR)
          <input type="number" min={1} value={pot} onChange={(e) => setPot(Math.max(1, Number(e.target.value)))} />
        </label>
        <label>
          Outs
          <input type="number" min={0} max={20} value={outs} onChange={(e) => setOuts(Math.max(0, Number(e.target.value)))} />
        </label>
      </div>

      <div className="math-grid">
        <MathStat label="Stack-to-pot ratio (SPR)" value={num(spr(stack, pot), 1)} note="low SPR → commit lighter" />
        <MathStat label="Equity by river (flop, ×4)" value={`≈ ${ruleOfNEquity(outs, 2)}%`} note={`${outs} outs, 2 to come`} />
        <MathStat label="Equity by river (turn, ×2)" value={`≈ ${ruleOfNEquity(outs, 1)}%`} note={`${outs} outs, 1 to come`} />
      </div>
    </div>
  );
}

function MathStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="math-stat">
      <div className="math-stat-label">{label}</div>
      <div className="math-stat-value">{value}</div>
      <div className="math-stat-note">{note}</div>
    </div>
  );
}

function tryParse(s: string): Card | null {
  if (s.length !== 2) return null;
  try {
    return parseCard(s);
  } catch {
    return null;
  }
}

function parseCards(s: string): Card[] | null {
  const cleaned = s.replace(/\s+/g, '');
  const out: Card[] = [];
  for (let i = 0; i + 1 < cleaned.length; i += 2) {
    const c = tryParse(cleaned.slice(i, i + 2));
    if (c === null) return null;
    out.push(c);
  }
  return out;
}

function EquityTool() {
  const [a, setA] = useState('Ah Kh');
  const [b, setB] = useState('Qs Qd');
  const [boardStr, setBoardStr] = useState('');
  const [result, setResult] = useState<EquityResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const compute = () => {
    setError('');
    const ca = parseCards(a);
    const cb = parseCards(b);
    const cboard = parseCards(boardStr);
    if (!ca || ca.length !== 2) return setError('Hand A must be two cards, e.g. "Ah Kh".');
    if (!cb || cb.length !== 2) return setError('Hand B must be two cards, e.g. "Qs Qd".');
    if (!cboard) return setError('Board must be cards like "2c 7d 9h".');
    if (cboard.length > 5) return setError('Board can have at most 5 cards.');
    const all = [...ca, ...cb, ...cboard];
    if (new Set(all).size !== all.length) return setError('Duplicate card detected.');
    setBusy(true);
    setTimeout(() => {
      const res = handVsHandEquity(ca as [Card, Card], cb as [Card, Card], cboard, 30000);
      setResult(res);
      setBusy(false);
    }, 10);
  };

  const dealRandom = () => {
    const d = shuffle(fullDeck());
    setA(`${cardToString(d[0])} ${cardToString(d[1])}`);
    setB(`${cardToString(d[2])} ${cardToString(d[3])}`);
    setBoardStr('');
    setResult(null);
  };

  const ca = parseCards(a);
  const cb = parseCards(b);
  const cboard = parseCards(boardStr) ?? [];
  const madeA = ca?.length === 2 && cboard.length >= 3 ? describeScore(evaluateBest([...ca, ...cboard])) : null;
  const madeB = cb?.length === 2 && cboard.length >= 3 ? describeScore(evaluateBest([...cb, ...cboard])) : null;

  return (
    <div className="panel">
      <h2>Hand vs Hand Equity Solver</h2>
      <p className="muted">
        Enter two starting hands and an optional board. Computes win/tie/lose via exact enumeration when the runout is
        small, otherwise a 30k-hand Monte Carlo. Format: rank+suit like <code>Ah</code>, <code>Td</code>, <code>2c</code>.
      </p>

      <div className="equity-inputs">
        <label>
          Hand A
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Ah Kh" />
          {ca?.length === 2 && <CardRow cards={ca} small />}
        </label>
        <span className="vs">vs</span>
        <label>
          Hand B
          <input value={b} onChange={(e) => setB(e.target.value)} placeholder="Qs Qd" />
          {cb?.length === 2 && <CardRow cards={cb} small />}
        </label>
        <label>
          Board (optional)
          <input value={boardStr} onChange={(e) => setBoardStr(e.target.value)} placeholder="2c 7d 9h" />
          {cboard.length > 0 && <CardRow cards={cboard} small />}
        </label>
      </div>

      <div className="btn-row">
        <button className="primary" onClick={compute} disabled={busy}>
          {busy ? 'Computing…' : 'Compute Equity'}
        </button>
        <button onClick={dealRandom}>Deal Random</button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="equity-result">
          <div className="equity-bars">
            <EquityBar label="Hand A" pct={result.equity} cls="bar-a" sub={madeA} />
            <EquityBar label="Hand B" pct={1 - result.equity} cls="bar-b" sub={madeB} />
          </div>
          <table className="stats">
            <tbody>
              <tr>
                <td>A equity</td>
                <td>{(result.equity * 100).toFixed(2)}%</td>
                <td>B equity</td>
                <td>{((1 - result.equity) * 100).toFixed(2)}%</td>
              </tr>
              <tr>
                <td>A wins</td>
                <td>{(result.win * 100).toFixed(2)}%</td>
                <td>Tie</td>
                <td>{(result.tie * 100).toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Samples</td>
                <td>{result.iterations.toLocaleString()}</td>
                <td>Method</td>
                <td>{result.exact ? 'Exact' : 'Monte Carlo'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EquityBar({ label, pct, cls, sub }: { label: string; pct: number; cls: string; sub?: string | null }) {
  return (
    <div className="equity-bar-wrap">
      <div className="equity-bar-label">
        {label} {sub && <span className="made">· {sub}</span>}
      </div>
      <div className="equity-bar-track">
        <div className={`equity-bar-fill ${cls}`} style={{ width: `${pct * 100}%` }}>
          {(pct * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function ChartsTool() {
  const [chart, setChart] = useState<PreflopChart>(RFI_CHARTS[0]);
  const selected = useMemo(() => parseRange(chart.range), [chart]);
  const combos = comboCount(selected);
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1);

  return (
    <div className="panel">
      <h2>Preflop Range Charts</h2>
      <p className="muted">Solver-derived 6-max opening and response ranges. Green = in range.</p>
      <div className="chart-layout">
        <div className="chart-list">
          <h4>Opening (RFI)</h4>
          {RFI_CHARTS.map((c) => (
            <button key={c.id} className={chart.id === c.id ? 'chip active' : 'chip'} onClick={() => setChart(c)}>
              {c.title}
            </button>
          ))}
          <h4>Responses</h4>
          {RESPONSE_CHARTS.map((c) => (
            <button key={c.id} className={chart.id === c.id ? 'chip active' : 'chip'} onClick={() => setChart(c)}>
              {c.title}
            </button>
          ))}
        </div>
        <div className="chart-main">
          <h3>{chart.title}</h3>
          <p className="muted">{chart.description}</p>
          <p className="range-stat">
            <strong>{pct}%</strong> of hands · {combos} combos
          </p>
          <RangeGrid selected={selected} />
          <details className="range-notation">
            <summary>Range notation</summary>
            <code>{chart.range}</code>
          </details>
        </div>
      </div>
    </div>
  );
}

function PushFoldTool() {
  const [bb, setBb] = useState(10);
  const entry = nearestPushFold(bb);
  const shove = useMemo(() => parseRange(entry.sbShove), [entry]);
  const call = useMemo(() => parseRange(entry.bbCall), [entry]);
  const shovePct = ((comboCount(shove) / TOTAL_COMBOS) * 100).toFixed(1);
  const callPct = ((comboCount(call) / TOTAL_COMBOS) * 100).toFixed(1);

  return (
    <div className="panel">
      <h2>Heads-Up Push / Fold (Nash)</h2>
      <p className="muted">
        Pick an effective stack depth. Shows the Nash-equilibrium small-blind jam range and the big-blind calling range.
        Snapped to the nearest charted depth ({PUSHFOLD_DEPTHS.join(', ')} BB).
      </p>
      <div className="slider-row">
        <input type="range" min={1} max={20} value={bb} onChange={(e) => setBb(Number(e.target.value))} />
        <span className="depth-badge">{bb} BB</span>
        <span className="muted">→ chart at {entry.bb} BB</span>
      </div>
      <div className="pushfold-grids">
        <div>
          <h3>SB Shove · {shovePct}%</h3>
          <RangeGrid selected={shove} />
        </div>
        <div>
          <h3>BB Call · {callPct}%</h3>
          <RangeGrid selected={call} />
        </div>
      </div>
      <details className="range-notation">
        <summary>Range notation</summary>
        <p>
          <strong>SB shove:</strong> <code>{entry.sbShove}</code>
        </p>
        <p>
          <strong>BB call:</strong> <code>{entry.bbCall}</code>
        </p>
      </details>
      <p className="muted small">Charted depths: {PUSHFOLD_TABLE.map((e) => e.bb).join(', ')} BB.</p>
    </div>
  );
}
