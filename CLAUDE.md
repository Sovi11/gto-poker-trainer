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
    equity.ts        · hand-vs-hand equity (exact enumeration when small, else Monte Carlo)
                       + board-aware "equity vs random" used by the bots
    range.ts         · parse range notation ("99+, ATs+, KQo") → hand classes / combos;
                       the 13×13 starting-hand grid
  gto/
    ranges.ts        · 6-max RFI + response charts (range strings)
    pushfold.ts      · heads-up Nash push/fold table by stack depth (BB)
  bots/
    personalities.ts · the 6 bots and their numeric profiles (tightness, aggression, …)
    decision.ts      · the decision engine: context + profile → Action
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

There's no test runner wired up yet. The engine is pure and easy to test — if you add tests,
prefer `tsx`/`node --test` over a heavy framework. Sanity anchors when changing the engine:
`AKs vs QQ ≈ 46.4%`, `AA vs KK ≈ 82.5%`, hand-ranking order (straight flush > quads > … > high card),
and the wheel (A-2-3-4-5) must register as a straight.

## Gotchas

- `noUnusedLocals` / `noUnusedParameters` are on — dead imports break the build.
- The bots run Monte Carlo on every decision (small iteration counts). If you add many bots or
  speed up play, watch the main-thread cost; consider a Web Worker before cranking iterations.
- Heads-up (2 players) blind/position rules differ from 3+-handed; `postBlinds()` handles both —
  test both seat counts if you touch it.
