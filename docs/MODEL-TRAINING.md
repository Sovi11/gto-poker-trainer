# Arena model training and promotion

The model session began October 18, 2026, after the initial remote runner had
completed two unrated house-bot wins. Strategy strength is evaluated separately
from protocol correctness. The existing production policy was frozen before
training; its readable checkpoint is in `src/arena/reference/baseline.mjs`.

## Models

### Preflop class equity and short-stack CFR

`src/arena/models/preflop.json` contains 169 hand classes and their matchup
equities. For each distinct pair of classes, 8,192 Monte Carlo runouts use
compatible suit arrangements. Combo counts and conditional card removal are
exact; the matchup equities are estimates. Swapped matchup entries sum to one.
Training seed: 4201943.

CFR+ then learns jam/fold policies at 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9,
10, 12, 15 and 20 BB, with 10,000 iterations per depth. Utilities are measured
before posting blinds: SB fold=-0.5 BB, BB fold=-1 BB; called shoves settle
at the simulated showdown equity. Policies between trained depths interpolate.
The reported best-response gap applies only to this restricted action game and
the estimated equity matrix. It is not full-game NLHE exploitability.

```powershell
npm run arena:train-preflop
npm run arena:validate-preflop
```

The validation command builds a second matrix from seed 99491323 with 4,096
samples per class pair, and evaluates the frozen policies on it. Matrix caches
are in ignored `artifacts/`; learned production weights are version-controlled.
The largest observed best-response gap on that independent matrix was
0.000227 BB within the jam/fold abstraction, across all 15 depths.

### Postflop equity network

`src/arena/models/equity-network.json` is a small 18-input, 24-hidden-unit tanh
network with a sigmoid equity output. Features include current made-hand
percentile, suit and straight draws, hole-card ranks, board texture and street.
Targets are Monte Carlo equity against a uniform random opponent, not the
opponent's actual cards. This estimates future showdown potential to improve
range modeling; final action equity still uses the inferred opponent range.

Training uses 48,000 rows from 6,000 boards and 512 rollouts per label. A
disjoint 800-board, 6,400-row validation set with 2,048 rollouts per label
selects the epoch. A third seed evaluates the frozen network using the trainer's
independent evaluator and equity implementation.

```powershell
npm run arena:train-equity
npx tsx scripts/arena-validate-equity.ts
```

Epoch-selection validation MSE: 0.000669; old rank-plus-draw proxy: 0.008912.
These predictive metrics do not establish a better playing policy. Deployment
depends on match comparisons, including negative or inconclusive results.
On the third seed, 4,096 cases checked with the independent reference evaluator
gave network MSE 0.000796 and proxy MSE 0.008689 (RMSE 2.82 and 9.32 percentage
points respectively). The board-clustered approximate 95% MSE improvement
interval was [0.007370, 0.008416].

### Bounded continuation search

The optional search candidate reuses vector CFR for a current-street betting
tree with continuation showdown equities at terminal nodes. Turn continuations
enumerate every legal river; flop continuations sample runouts. Card-colliding
matchups are excluded. The solve caps each range at 16 stratified samples,
includes our actual hand, and uses 120 iterations with a time-budget fallback.
It only runs below 2 SPR on the flop or 4 SPR on the turn. Future betting is
omitted, so this is a finite checkdown-continuation approximation, not a full
multi-street equilibrium solve.

## Evaluation

```powershell
$env:ARENA_VARIANT = 'preflop' # baseline, short, hybrid, full, search
$env:ARENA_PAIRS = '1500'
$env:ARENA_SEED = '5724831'
npm run arena:compare

$env:ARENA_MATCH_PAIRS = '200'
$env:ARENA_OPPONENT = 'baseline'
npm run arena:elimination
```

The comparison plays duplicate deals with seats swapped and matched random
streams. An identical-policy control returned exactly zero profit at all five
stack depths. The frozen baseline receives only its own cards and the same
public observations as the candidate.

The short-stack-only confirmation used seed 4859723 and 20,000 hands at each
of 5 and 10 BB. Versus the frozen bot, observed gains were +3.29 BB/100 at
5 BB (approximate paired interval +1.25 to +5.33) and +3.32 BB/100 at 10 BB
(+0.16 to +6.47). These are results against that particular reference policy,
not a claim about the external Chipzen field.

The elimination harness starts 100 BB deep and increases blinds by 1.5x every
20 hands, carrying stacks through to elimination. This is an explicit test
schedule; it has not been claimed to match Season 11's blind cadence. Forced
all-in blinds and unequal stacks conserve chips and are covered by tests.

Run labels and seeds distinguish development, ablation and independent
confirmation results in `artifacts/`. Candidate comparisons and approximate
confidence intervals are reported in the validation notes; weaker variants
are not silently discarded from the record. Online adaptation and model
selection limit formal statistical interpretations of those intervals.
