import { useState } from 'react';
import { cardToString } from '../engine/cards';
import { RiverSpot, solveRiverSpot, walkPath } from '../solver/riverspot';
import { Action } from '../solver/tree';
import { CardRow } from './Card';

const DEFAULTS = {
  board: 'Kh 7d 2c 3s 9h',
  oopRange: '99, 77, 22, K9s, K7s, KQo, KJs, A5s, 65s',
  ipRange: 'AA, QQ, JJ, TT, AKo, AQo, AJs, KTs, T8s',
  pot: 100,
  stack: 300,
  betSizes: '33, 75',
  raiseSizes: '100',
  maxRaises: 1,
};

function actionTone(a: Action): string {
  if (a.kind === 'fold') return 'fold';
  if (a.kind === 'check' || a.kind === 'call') return 'passive';
  return 'aggro';
}

export function TreeSolverView() {
  const [form, setForm] = useState(DEFAULTS);
  const [spot, setSpot] = useState<RiverSpot | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof DEFAULTS, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const parseSizes = (s: string) =>
    s
      .split(/[,\s]+/)
      .map((x) => parseFloat(x))
      .filter((x) => Number.isFinite(x) && x > 0)
      .map((x) => x / 100);

  const run = () => {
    setError('');
    setBusy(true);
    // Yield a frame so the button can paint its busy state before we block.
    setTimeout(() => {
      try {
        const betSizes = parseSizes(form.betSizes);
        const raiseSizes = parseSizes(form.raiseSizes);
        if (betSizes.length === 0) throw new Error('Give at least one bet size, e.g. "33, 75"');
        const solved = solveRiverSpot({
          board: form.board,
          oopRange: form.oopRange,
          ipRange: form.ipRange,
          pot: Number(form.pot),
          stack: Number(form.stack),
          betSizes,
          raiseSizes,
          maxRaises: Number(form.maxRaises),
          iterations: 2500,
          maxCombos: 110,
        });
        setSpot(solved);
        setPath([]);
      } catch (e) {
        setSpot(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const view = spot ? walkPath(spot, path) : null;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  // Labels for the breadcrumb, rebuilt by walking the path.
  const crumbs: { label: string; upto: number }[] = [];
  if (spot) {
    let node = spot.tree.root;
    for (let k = 0; k < path.length; k++) {
      if (node.kind !== 'decision') break;
      const a = node.actions[path[k]];
      crumbs.push({ label: `${node.player === 0 ? 'OOP' : 'IP'} ${a.label}`, upto: k + 1 });
      node = node.children[path[k]];
    }
  }

  return (
    <div className="panel">
      <h2>Tree Solver</h2>
      <p className="muted">
        A real CFR solver for a heads-up river spot. Give it a board, both ranges and a bet tree; it finds the Nash
        equilibrium, then lets you walk any line and see exactly what the solver does there — and with which hands.
      </p>

      <div className="ts-form">
        <label className="ts-wide">
          Board (5 cards)
          <input value={form.board} onChange={(e) => set('board', e.target.value)} placeholder="Kh 7d 2c 3s 9h" />
        </label>
        <label className="ts-wide">
          OOP range (acts first)
          <input value={form.oopRange} onChange={(e) => set('oopRange', e.target.value)} />
        </label>
        <label className="ts-wide">
          IP range
          <input value={form.ipRange} onChange={(e) => set('ipRange', e.target.value)} />
        </label>
        <label>
          Pot
          <input type="number" min={1} value={form.pot} onChange={(e) => set('pot', Number(e.target.value))} />
        </label>
        <label>
          Stack
          <input type="number" min={1} value={form.stack} onChange={(e) => set('stack', Number(e.target.value))} />
        </label>
        <label>
          Bet sizes (% pot)
          <input value={form.betSizes} onChange={(e) => set('betSizes', e.target.value)} placeholder="33, 75" />
        </label>
        <label>
          Raise sizes (% pot)
          <input value={form.raiseSizes} onChange={(e) => set('raiseSizes', e.target.value)} placeholder="100" />
        </label>
        <label>
          Max raises
          <input
            type="number"
            min={0}
            max={3}
            value={form.maxRaises}
            onChange={(e) => set('maxRaises', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="btn-row">
        <button className="primary big" onClick={run} disabled={busy}>
          {busy ? 'Solving…' : 'Solve'}
        </button>
        {spot && (
          <button className="link-btn" onClick={() => setPath([])} disabled={path.length === 0}>
            back to start
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {spot && view && (
        <>
          <div className="ts-board">
            <CardRow cards={spot.board} small />
            <span className="muted small">
              {spot.oop.length} vs {spot.ip.length} combos
              {spot.subsampled ? ' (sampled)' : ''}
            </span>
          </div>

          <div className="math-grid">
            <Stat label="OOP EV" value={spot.solution.ev0.toFixed(1)} note={`of the ${spot.pot} pot`} />
            <Stat label="IP EV" value={spot.solution.ev1.toFixed(1)} note={`of the ${spot.pot} pot`} />
            <Stat
              label="Exploitability"
              value={`${(spot.solution.exploitability * 100).toFixed(2)}%`}
              note="0% = solved"
            />
            <Stat
              label="Solved in"
              value={`${spot.solution.ms} ms`}
              note={`${spot.solution.iterations} CFR iterations`}
            />
          </div>

          <div className="ts-path">
            <button className="ts-crumb" onClick={() => setPath([])}>
              river
            </button>
            {crumbs.map((c) => (
              <button key={c.upto} className="ts-crumb" onClick={() => setPath(path.slice(0, c.upto))}>
                → {c.label}
              </button>
            ))}
          </div>

          {view.node.kind === 'terminal' ? (
            <div className="ts-terminal">
              <strong>
                {view.node.showdown
                  ? 'Showdown.'
                  : `${view.node.folder === 0 ? 'OOP' : 'IP'} folds — hand over.`}
              </strong>
              <p className="muted">
                This line is reached by {pct(view.reach0)} of the OOP range and {pct(view.reach1)} of the IP range.
              </p>
            </div>
          ) : (
            <>
              <h3>
                {view.node.player === 0 ? 'OOP' : 'IP'} to act
                <span className="muted small ts-reach">
                  {' '}
                  · {pct(view.node.player === 0 ? view.reach0 : view.reach1)} of their range is still here
                </span>
              </h3>

              {(view.node.player === 0 ? view.reach0 : view.reach1) < 0.005 && (
                <p className="ts-warn">
                  Equilibrium almost never takes this line, so the solver spent little time here — treat the
                  frequencies below as unreliable rather than as the GTO answer.
                </p>
              )}

              <div className="ts-actions">
                {view.node.actions.map((a, i) => (
                  <button
                    key={i}
                    className={`ts-action ${actionTone(a)}`}
                    onClick={() => setPath([...path, i])}
                    title="Walk down this branch"
                  >
                    <span className="ts-action-head">
                      <span className="ts-action-label">{a.label}</span>
                      <span className="ts-action-freq">{pct(view.frequencies[i])}</span>
                    </span>
                    <span className="ts-bar">
                      <span className="ts-bar-fill" style={{ width: `${view.frequencies[i] * 100}%` }} />
                    </span>
                  </button>
                ))}
              </div>

              <HandTable view={view} actions={view.node.actions} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="math-stat">
      <div className="math-stat-label">{label}</div>
      <div className="math-stat-value">{value}</div>
      <div className="math-stat-note">{note}</div>
    </div>
  );
}

function HandTable({
  view,
  actions,
}: {
  view: NonNullable<ReturnType<typeof walkPath>>;
  actions: Action[];
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = view.perHand.filter((h) => h.weight > 0.0001);
  const shown = showAll ? rows : rows.slice(0, 18);

  return (
    <div className="ts-hands">
      <div className="ts-hands-head">
        <h4>Strategy by hand</h4>
        <div className="ts-legend">
          {actions.map((a, i) => (
            <span key={i} className={`ts-key ${actionTone(a)}`}>
              {a.label}
            </span>
          ))}
        </div>
      </div>
      {shown.map((h) => (
        <div key={h.combo.label} className="ts-hand-row">
          <span className="ts-hand-cards">
            {cardToString(h.combo.cards[0])} {cardToString(h.combo.cards[1])}
          </span>
          <span className="ts-mix">
            {h.probs.map((p, i) =>
              p > 0.001 ? (
                <span
                  key={i}
                  className={`ts-mix-seg ${actionTone(actions[i])}`}
                  style={{ width: `${p * 100}%` }}
                  title={`${actions[i].label} ${(p * 100).toFixed(1)}%`}
                />
              ) : null,
            )}
          </span>
        </div>
      ))}
      {rows.length > 18 && (
        <button className="link-btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'show fewer' : `show all ${rows.length} hands`}
        </button>
      )}
    </div>
  );
}
