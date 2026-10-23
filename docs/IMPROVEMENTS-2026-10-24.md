# October 24 status and candidate evaluation

## Live Season 11 snapshot

The authenticated [season page](https://chipzen.ai/season/11) showed ALLIN-Hybrid
ranked **1 of 24**, with **6 wins and 1 loss**. One win against RiverMind was a
walkover, leaving **5 wins and 1 loss in played season matches**. The bot list
showed rating **1945**, 71.4% over 7 rated matches (which includes the earlier
non-season loss). This is the displayed snapshot, not final standings or a
confirmed playoff result. The fixture against lil-bot-v7b remained planned.

| Season opponent | Displayed result |
|---|---|
| v003 | Win |
| Phineas-III | Win |
| Jarvis | Win |
| RiverMind | Walkover win |
| Nashforgebeater | Loss |
| Blueprint | Win |
| Dexter | Win |
| lil-bot-v7b | Planned |

## Confirmed river safety correction

Finite-iteration CFR averages retain a small amount of initial exploration.
With the random draw at zero, the old bot folded both an exclusive royal flush
and a guaranteed royal-flush-board chop when facing a bet. Regression tests
observed both failures before the fix.

The new `riverSafety` guard checks all legal opponent holdings using only our
cards and the public board. It replaces a fold with a call only when no
possible opponent can beat us. It does not use guessed range weights or the
opponent's hidden cards. A negative test ensures an inferior kicker on a
four-of-a-kind board is not incorrectly protected. Another test verifies
contestable pot odds on an all-in short call.

The guard is enabled by default **in new builds**, with
`CHIPZEN_RIVER_SAFETY=0` available for v1 comparisons. The uploaded Season 11
binary was not replaced. A separate 1,800-hand comparison at 100/20/5 BB
(seed 2410253) returned identical results to v1; this checks ordinary-play
non-regression and does not quantify a win-rate gain from rare protected
states. The targeted tests establish the dominance correction.

Decision diagnostics now include pot, actual call amount, call price and
model-based call EV. They improve diagnosis but do not constitute a complete
deterministic replay log.

## Contextual range experiment: not promoted

Preflop position/raise-count conditioning is now independent of the equity
network through `contextualRanges` / `CHIPZEN_CONTEXT_RANGES=1`. It remains
**off by default**. All deep/short/implicit hand and reconnect resets preserve
the option. Existing network-variant defaults and postflop likelihoods are
unchanged. Comparisons explicitly disable safety on the hybrid v1 baseline;
the context-only candidate also disables it to isolate the range change.

The identical-policy control returned exactly zero across five depths.
Development seed 2410241, 3,000 hands per depth:

| Depth | Change BB/100 vs uploaded hybrid v1 | Approximate paired 95% interval |
|---|---:|---:|
| 100 BB | -3.99 | -18.37 to +10.39 |
| 40 BB | -6.46 | -14.53 to +1.61 |
| 20 BB | -3.89 | -10.95 to +3.17 |
| 10 BB | 0.00 | 0.00 to 0.00 |
| 5 BB | 0.00 | 0.00 to 0.00 |

Field seed 2410247, 1,200 hands per policy per opponent, likewise showed no
clear gain: improvement point estimates were +4.85 vs maniac, -4.36 vs station,
-4.70 vs GTO trainer, -21.22 vs shark and 0 vs jam. Every approximate interval
included zero. These trainer opponents do not represent the live Chipzen
field. Independent confirmation uses seed 2410291 at 40 and 20 BB; its final
report will be retained with the other compact reports in `evaluations/`.

## Validation and reproduction

Fresh verification: 385 tests, arena TypeScript, four SDK conformance scenarios,
local upload-runner start/resume tests on all streets, and production web build
pass. A fresh reviewer reported no important findings. Container resource
validation is performed by the image workflow on push.

```powershell
$env:ARENA_VARIANT = 'hybrid'
$env:ARENA_BASELINE_VARIANT = 'hybrid'
$env:ARENA_CONTEXT_RANGES = '1'
$env:ARENA_RIVER_SAFETY = '0'
$env:ARENA_PAIRS = '1500'
$env:ARENA_SEED = '2410241'
$env:ARENA_LABEL = 'context-development'
npm run arena:compare
```

For a safety-only comparison, set context to `0` and river safety to `1`.
No external matches, bot uploads or season changes were made in this pass.
