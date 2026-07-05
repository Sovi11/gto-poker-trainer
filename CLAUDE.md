# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

**GTO Poker Trainer** — a single-page web app for learning Game-Theory-Optimal
(GTO) poker and grinding against AI bots. Three pillars:

1. **Learn** — a structured GTO course (foundations → preflop → postflop → exploitation).
2. **Solver** — a hand-vs-hand equity calculator, preflop range charts, and Nash push/fold tables.
3. **Play** — a Texas Hold'em table where you sit against bots that each have a distinct, exploitable personality.

It's a study tool. Everything runs client-side; there is no backend, no auth, no network calls.

## Tech stack

- **Vite** + **React 18** + **TypeScript** (strict mode).
- No UI framework — hand-rolled CSS in `src/styles.css` (dark "poker felt" theme).
- No state library — local component state + a couple of `useRef`s for the game loop.

## Commands

```bash
npm install        # install deps
npm run dev        # start Vite dev server on :5173
npm run build      # tsc -b && vite build → dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm test           # vitest run (engine + bot + betting unit tests)
npm run test:watch # vitest in watch mode
```

## Architecture / where things live

Pure, framework-free logic lives under `src/engine`, `src/gto`, `src/bots`, `src/game`.
React only lives under `src/components` and `src/App.tsx`. Keep that separation —
the engine must stay UI-agnostic and unit-testable.

```
src/
  engine/            ← pure poker math, no React
    cards.ts         · Card = int 0..51; rank/suit helpers, deck, seedable RNG (mulberry32)
    evaluator.ts     · 5- and 7-card hand evaluator → comparable integer score
    equity.ts        · hand-vs-hand equity (exact enumeration when small, else Monte Carlo);
                       board-aware "equity vs random" and "equity vs a continuing range"
    range.ts         · parse range notation ("99+, ATs+, KQo") → hand classes / combos;
                       the 13×13 starting-hand grid
  gto/
    ranges.ts        · 6-max RFI + response charts (range strings)
    pushfold.ts      · heads-up Nash push/fold table by stack depth (BB)
  drills/
    types.ts         · seedable, auto-graded drill generators (8 types, 4 categories)
    daily.ts         · Daily Puzzle: deterministic drill-of-the-day from the calendar
                       date, guess judging, streak math, emoji share grid
  lib/
    storage.ts       · versioned, corruption-proof localStorage helpers
    usePersistentState.ts · useState that survives reloads (JSON-serializable values)
  bots/
    personalities.ts · the 6 bots and their numeric profiles (tightness, aggression, …)
    preflopStrength.ts · Chen-formula starting-hand percentiles + top-X% range builder
    decision.ts      · the decision engine: context + profile → Action.
                       Preflop plays a position/personality-aware range (preflopStrength);
                       postflop gauges equity vs a plausible continuing range.
  game/
    holdem.ts        · HoldemHand — full betting state machine (blinds, streets, side pots,
                       showdown). Bots are driven via hand.stepBot().
  data/
    lessons.ts       · the course content (modules → lessons)
  components/        ← all React
    App.tsx          · top-level tabs (Learn / Solver / Bots / Play)
    SolverView.tsx   · equity tool + charts + push/fold
    PlayView.tsx     · table setup + live table + action bar + hand log
    LearnView.tsx    · course reader with progress tracking
    BotsView.tsx     · bot roster with stat bars
    Card.tsx, RangeGrid.tsx  · shared visual primitives
```

## Key invariants & conventions

- **Card encoding**: a card is an integer `0..51`. `rank = card % 13` (0=Two … 12=Ace),
  `suit = floor(card / 13)` (0=c,1=d,2=h,3=s). Don't change this — everything depends on it.
- **Hand scores** from `evaluateBest()` are opaque comparable integers
  (`category * 13^5 + tiebreakers`). Higher = better. Use `categoryOf()` / `describeScore()`
  to interpret, never reverse-engineer the packing elsewhere.
- **Equity** auto-selects exact enumeration when the remaining-card space is ≤ ~30k combos
  (e.g. turn/river), otherwise Monte Carlo. The result carries an `exact` flag.
- **The game loop**: `HoldemHand` mutates internal state. The UI re-renders by bumping a
  tick counter; bots are stepped on a timer in a `useEffect`. The engine itself is synchronous
  and deterministic given a seed.
- **Ranges are reference data, not a live solver.** The RFI/response/push-fold ranges are
  solver-derived study charts encoded as strings. If you "improve" them, keep them as
  parseable range notation and update the descriptions to match.

## Adding things

- **New bot**: add an entry to `BOTS` in `personalities.ts`. The decision engine reads its
  numeric profile — no new code needed unless you want new behavior levers.
- **New lesson**: add to `CURRICULUM` in `data/lessons.ts`. Body splits on blank lines into `<p>`.
- **New preflop chart**: add a `PreflopChart` to `ranges.ts` with a valid range string.
- **New push/fold depth**: add a row to `PUSHFOLD_TABLE`; the tool snaps to the nearest charted depth.

## Testing

`npm test` runs **Vitest** (`*.test.ts` next to the code under `src/`). Coverage anchors:
- `engine/evaluator.test.ts` — hand-ranking order, kickers, the wheel (A-2-3-4-5) straight, best-5-of-7.
- `engine/equity.test.ts` — known matchups (`AA vs KK ≈ 82%`, `AK vs AQ ≈ 73%`), exact-enumeration determinism, range awareness.
- `engine/range.test.ts` — range-notation parsing and combo counts (full grid = 1326).
- `bots/preflop.test.ts` — Chen scores, percentiles, and that a nit's range is strictly tighter than a maniac's.
- `game/holdem.test.ts` — chip conservation / side pots over many auto-played hands, and the
  incomplete-all-in re-opening rule (a short jam must not let a player who already acted re-raise).

CI (`.github/workflows/ci.yml`) runs typecheck → test → build on every push/PR.

## Gotchas

- `noUnusedLocals` / `noUnusedParameters` are on — dead imports break the build.
- Preflop bot decisions are a cheap percentile lookup, but **postflop** decisions run Monte Carlo
  (small iteration counts) on the main thread. If you add many bots or speed up play, watch the
  cost; consider a Web Worker before cranking iterations.
- Heads-up (2 players) blind/position rules differ from 3+-handed; `postBlinds()` handles both —
  test both seat counts if you touch it.
