# Validation — October 19, 2026

## Upload candidate

The production default is now `hybrid`: trained preflop equity/range rankings
at effective stacks up to 30 BB, learned jam/fold policies up to 12 BB, and
the original deep-stack and postflop decision rules. Neural range equity and
flop/turn continuation search remain experimental and disabled in production.

Fresh local checks pass **373 tests**, arena TypeScript, all four SDK
conformance scenarios, the production web build, and the upload runner's
token/start and ticket/resume WebSocket smoke tests. The container workflow
separately tests the compiled executable under 0.5 CPU, 256 MB, uid 10001,
read-only rootfs and a 10 MB `/tmp` before exporting an image.

Independent paired-deal comparison against the frozen original, seed 8063957:

| Effective stack | Hands | Gain BB/100 | Approximate paired 95% interval |
|---|---:|---:|---:|
| 30 BB | 16,000 | +6.02 | +1.22 to +10.82 |
| 20 BB | 16,000 | +7.31 | +3.58 to +11.05 |

These are the two completed depth blocks captured from the experiment log;
the interrupted 12 BB block is excluded. At 40 and 100 BB a 600-hand
identical-policy control returned exactly zero. A separate short-stack-only
confirmation over 40,000 hands gained +3.29 BB/100 at 5 BB and +3.32 at 10 BB.

Hybrid won 108/200 rising-blind elimination matches against the original
(seed 6198357; paired approximate 95% win-rate interval 49.90%–58.10%).
That interval includes 50%, so tournament superiority is unproven. The search
variant won 104/200 on a separate seed; its deep-stack holdout was weaker,
so it was not selected. See [MODEL-TRAINING.md](MODEL-TRAINING.md).

The original bot's two live exhibition wins validate connectivity, not the
new candidate's strength against the Chipzen field. The upgraded candidate
still needs platform upload validation and live matches.

## Original October 18 baseline

The implementation passes a clean `npm ci`, both TypeScript checks, all
**362 tests**, the four official SDK conformance scenarios, and the web
production build. Real localhost WebSocket tests verify normal match start
and reconnect with seat/button fields omitted from turn requests. Seeded
unequal-stack games check chip conservation and legal actions. The fast hand
evaluator agrees with the independent existing evaluator on 6,000 random
5–7-card deals plus wheel, flush, double-trips and quads cases.

The empty-credential runner exits with setup instructions before connecting.
The user subsequently created the Chipzen account and ALLIN remote bot. Live
authentication is verified, and an unrated practice match against house bot
pebble was dispatched on October 18. No rated challenge or season entry has
been created. The first live run exposed the upstream SDK's abandoned lobby
reads; the runner transport now prevents those reads swallowing future frames,
with a regression test and multiple verified live heartbeats.

First practice match:
https://chipzen.ai/spectate/f4caed41-b864-4eff-bb0a-c1c6380848dc

**Result: completed, winner ALLIN**, verified on the Chipzen challenges page.
This was an unrated house-bot exhibition, not a paid or season match. The
runner resumed the in-progress match after the transport fix and remained
connected through successive 15-second heartbeats to completion. A single
win validates end-to-end operation, not a reliable estimate of playing strength.
Replay: https://chipzen.ai/match/f4caed41-b864-4eff-bb0a-c1c6380848dc

## Frozen-policy holdout

Command: `ARENA_PAIRS=500 ARENA_SEED=127931 npm run arena:benchmark`
(PowerShell environment assignment is documented in CHIPZEN.md.)

Default production sample budget: 1,800 equity samples, 100 CFR iterations.
There are 1,000 hands per opponent, 10,000 hands total, over 100/40/15/8 BB
starting depths. Each deal is played twice with our bot's seat swapped.
The bot adapts from its observations; it never receives the other seat's
hole cards. It has a separate state per seat and per opponent.

| Opponent | bb/100 | Approximate paired 95% interval |
|---|---:|---:|
| Rocky | +57.8 | +35.4 to +80.1 |
| Mad Max | -22.7 | -67.7 to +22.3 |
| Callie | +89.9 | +43.8 to +136.0 |
| GTO Greg | +24.4 | -3.4 to +52.3 |
| Sharon | +23.9 | -7.2 to +55.0 |
| Finn | +103.5 | +58.7 to +148.4 |
| Random legal actions | +123.6 | +39.1 to +208.1 |
| Always call/check | +250.0 | +178.4 to +321.7 |
| Always check/fold | +63.0 | +60.6 to +65.4 |
| Always shove/call | +149.6 | -16.3 to +315.4 |

Worst observed decision time was **121.8 ms**; every opponent group's 95th
percentile was below **34 ms**, measured locally. This excludes network time.
The machine was also running validation/install work during parts of this run.
Full output is `artifacts/arena-benchmark-127931.json` (ignored by Git).

These are cash chip-EV tests with stacks reset each hand, not increasing-blind
elimination tournaments. The six trainer opponents are deliberately exploitable.
Online adaptation also makes observations dependent, so the displayed normal
intervals are descriptive approximations, not calibrated tournament bounds.
GTO Greg, Sharon, Mad Max and the shove diagnostic remain inconclusive in this
particular sample. No claim of full-game equilibrium or strongest bot is made.

A further 3,000-hand Mad Max holdout at seed 333133 returned **+18.9 bb/100**
(approximate paired interval **-5.4 to +43.2**), with a 46.2 ms maximum decision.
This independent follow-up remains inconclusive; it does not justify selecting
only the favorable result. Together the final-policy strength runs cover
13,000 hands before the ablation below. The report is
`artifacts/arena-benchmark-333133.json`.

## River-solver ablation

An additional 600-hand duplicate-deal run against Sharon, seed 199771:

| Policy | bb/100 | Approximate paired 95% interval |
|---|---:|---:|
| Range-equity policy without river CFR | -8.6 | -47.3 to +30.1 |
| Default river CFR | +15.0 | -36.6 to +66.6 |

The point estimate favors CFR here; the sample is too small to establish a
statistically reliable improvement. Reports are retained in `artifacts/`.

## Remaining performance work

First validate on Chipzen exhibitions, inspect rejected actions and decision
timing, then evaluate against independent external bots. Full-game strategy
training, deeper flop/turn search, calibrated action likelihoods and elimination
tournament evaluation remain meaningful ways to improve strength. The present
bot is a tested competition integration with an approximate strategy, not a
proof that these problems are solved.
