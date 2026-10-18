# Fold Call or Jam: Chipzen arena bot

Measured results and limitations: [CHIPZEN-VALIDATION.md](CHIPZEN-VALIDATION.md).

This is a heads-up No-Limit Hold'em competitor running locally over the Chipzen
External API. It reuses this repository's card encoding, range library,
push/fold reference data and vector CFR implementation. It does not depend on
the React app or Supabase. Node 24 LTS is recommended (Node 22+ also supports the
runner's env-file loading).

## Run locally

```powershell
npm ci
npm run arena:check
npm run arena:test
npm run arena:conformance
npm run arena:benchmark
```

`arena:benchmark` plays duplicate deals with bot seats swapped against all six
trainer personalities and four diagnostic policies (random, always call,
check/fold, shove). Starting stacks alternate between 100, 40, 15 and 8 BB.
Stacks reset between hands: results measure cash chip EV under those depths,
not elimination match wins. Output includes bb/100, paired approximate 95%
confidence intervals, decision latency and river CFR use. The report is saved
to `artifacts/arena-benchmark-<seed>.json` (ignored by Git).

For a larger independent run:

```powershell
$env:ARENA_PAIRS = '1000'
$env:ARENA_SEED = '127931'
npm run arena:benchmark
```

`ARENA_OPPONENT=shark` selects one opponent. `ARENA_NO_CFR=1` runs an ablation
using only range equity on the river. Baseline trainer bots intentionally have
leaks; beating them does not establish a Chipzen rating or equilibrium strength.

## Connect to Chipzen

1. Sign in at https://chipzen.ai and create an **External API** bot.
2. Copy its bot ID and create an API token on the bot detail page.
3. Create the ignored local config:

```powershell
Copy-Item .env.arena.example .env.arena.local
```

Fill in `CHIPZEN_BOT_ID` and `CHIPZEN_EXTBOT_TOKEN` in that file, then run:

```powershell
npm run arena:run
```

Never commit the token or paste it in an issue. `.env.arena.local` and
`chipzen.toml` are ignored. Credentials are never printed by our runner.
`CHIPZEN_MAX_MATCHES=1` stops after one completed match for a first test.
Default mode stays in the production lobby and accepts dispatched matches.
Start the process before issuing a challenge. For a sandboxed house opponent,
the current SDK walkthrough specifies an **unranked exhibition** because
external and sandboxed bots have separate ranked divisions.

The runner uses a thin observed WebSocket transport. It logs connection event
types and timestamps, never tokens or raw frames. It also shares an outstanding
read across the SDK lobby's timeout races: the upstream SDK leaves timed-out
reads pending, which otherwise swallow future heartbeats and match dispatches.
`src/arena/lobby.test.ts` reproduces a heartbeat arriving after that timeout.

Keep the machine powered, awake and connected while fixtures run. The SDK
handles the lobby, per-match authentication, heartbeat, rejection fallbacks
and reconnect/resume. Each match gets a fresh bot instance. The runner uses
strict failure mode so an unexpected strategy error exits visibly; fix the
logged error and restart instead of letting an unhealthy bot quietly fold.
No live challenge, account creation or season registration is performed by
the local scripts.

## Strategy and engineering

- Preflop: broad heads-up button opens, positional 3-bets, stack-aware shove
  sizing, reference push/fold at <=10 BB, and equity/pricing for facing a shove.
  Shoving ranges widen after enough observed opponent shoves.
- Beliefs: both players have explicit weighted distributions over all 1,326
  combinations. Known board cards remove impossible combinations. Observed
  actions update weights using a regularized heuristic likelihood, retaining
  bluff probability rather than collapsing to a narrow fixed range.
- Flop/turn: weighted Monte Carlo equity against the current opponent range;
  draw-aware semibluffs, position, pot odds, effective stacks and a smoothed
  opponent fold model. Sampling is capped, with a 400 ms computation target.
- River: exact range equity and the existing vector CFR on a finite betting
  abstraction rooted at the current wager. Uses 36 stratified range samples
  per side, always includes our actual hand, handles card collisions, and
  runs 100 iterations with half-pot, pot and effective-stack sizes. This is
  approximate solving with heuristic ranges, not a full-game Nash strategy.
- Integration: raise amounts are street totals; the action boundary clamps
  to legal integer bet ranges. Betting closed after an incomplete raise never
  forces a small requested bet into a shove. Board-only ties count half.
- Speed: a direct 5–7-card evaluator is cross-checked against the independent
  existing evaluator on 6,000 seeded deals and specific edge cases. Expensive
  CFR remains confined to a small river tree.

The current strategy supports two players only. It explicitly rejects larger
tables; the daily six-max game needs a separate strategy. The platform's actual
match timeout remains authoritative; local latency excludes network travel.
Preflop and flop/turn policies are heuristic, not trained full-game solutions.

## Sources and schedule

- Solver base commit: `34564c0825f8767e27aefd53bd9a6259d1bac513`
- SDK pin and licensing: [vendor/README.md](../vendor/README.md)
- [Official SDK](https://github.com/chipzen-ai/chipzen-sdk)
- [External API walkthrough](https://github.com/chipzen-ai/chipzen-sdk/blob/main/docs/external-api/FIRST-30-MINUTES.md)
- [Authoritative poker protocol](https://github.com/chipzen-ai/chipzen-sdk/blob/main/docs/protocol/POKER-GAME-STATE-PROTOCOL.md)

Dave's October 17 email describes Season 11 as heads-up NLHE, initially
10,000 chips at 50/100, increasing blinds and elimination. He gives fixtures
October 20–23 and playoffs October 24–25, with registration closing Monday
night, October 19, 2026. The email does not give the cutoff timezone; verify
the live season page before relying on the deadline.
