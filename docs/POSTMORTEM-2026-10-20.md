# First live results and improvement targets

The challenges page showed four wins from six ALLIN-Hybrid house-bot
exhibitions: wins versus pebble, fledge, 5ur9e and mochi; losses versus
PluriBot and patches. BonnieBlue won the separate unrated challenge.
lil-bot-v8 won the rated match in 47 hands, taking 10,000 net chips.
These small samples do not estimate long-run win rates reliably.

## Hand 17: range assumptions, not a demonstrated odds bug

[Replay](https://chipzen.ai/match/af45f077-d72c-4718-9749-9b4e683feb05).
ALLIN-Hybrid held 9c9d; the opponent held 9h9s. Board: Ac4dAh5h8d.
Starting stack 8,750; after investing 5,175 through the turn, the bot folded
to a 3,450 river bet into 10,350. A call would have chopped this actual deal.

The live decision log was unavailable. `scripts/arena-audit-hand17.ts`
reconstructs this hand from its public actions, **without the preceding 16
hands' opponent adaptation**. Its inferred full-range equity is 16.65%,
below the required 20%. The 36-sample opponent range gives 17.65%; the
100-iteration solve folds about 85% and the 1,000-iteration solve about 98.5%.
More iterations do not fix this reconstruction's range assumptions.
This does not prove the actual live posterior, or that calling was correct
against the opponent's complete betting range.

Reproduce with `npx tsx scripts/arena-audit-hand17.ts`.

## Priorities

1. **Test contextual preflop range updates independently.** The production
   hybrid variant passes position and raise count to `RangeBelief.observe`,
   but the contextual thresholds are gated on the experimental equity
   network being present. Production therefore uses the simpler thresholds.
   Remove that coupling only in a candidate and compare against the frozen
   uploaded policy; no improvement is assumed before testing.
2. **Capture enough decision context for exact replay.** Add pot, call price,
   inferred street contributions, decision seed/random draw, range state or
   reproducible observation history, and solver diagnostics. Current logs
   report action/method/equity/time but cannot reproduce this live fold.
   Keep credentials and opponent hidden cards out of the runner's inputs.
3. **Add river decision invariants and sampling checks.** Cover board-only
   ties, known nuts, blocker-heavy ranges, and agreement with exact call EV
   when ranges are held fixed. The current river solve compresses each
   range to 36 weighted representatives. Its error was not the explanation
   for this reconstruction's fold, but it is an inexpensive boundary to test.

The uploaded season bot was not modified by this audit. Promotion requires
independent comparisons and runtime validation; a loss alone is not grounds
for changing the entered bot.
