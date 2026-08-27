# Daily tab rework: a real hand, one frozen decision

Date: 2026-08-27 · Status: approved by Pravar (chat)

## Goal

Replace the math-quiz Daily with a daily recorded hand: briefing (venue,
stakes, year, your stack and cards), the table animates to ONE key decision
and freezes, you choose, the hand runs out, then the reveal shows what the
real player actually did and a vote-split of what site users chose. Streak +
emoji share stay. The math drills remain in the Drills tab untouched.

## Decisions (from brainstorming)

- One frozen decision, not full-replay.
- Reveal = the real player's action AND the community vote split (vote bar
  needs Supabase; without it the reveal shows just the real action).
- Streak extends by playing the daily (no objective "correct"); share text
  reports whether you matched the pro and the agreement %.

## Design

1. `src/lib/dailyHand.ts` (pure, tested):
   - `decisionScore(hand, seat, step)` — 0 unless facing a bet; otherwise
     price (owed/(pot+owed)), street depth, pot in bb.
   - `bestDecision(hand)` — max over `candidateSeats` × `decisionPoints`.
   - `pickDaily(n, hands)` — filter to hands whose best decision clears a
     threshold, then deterministic hash of the day picks one. Same hand for
     everyone; regenerating the library may shift a day's pick (accepted).
   - `briefingLines(spot)` — venue/event + year, stakes + table size, hero
     stack in bb. Famous hands name the player; anon hands describe stakes.
2. `FeltTable` component extracted from HandTheater (same markup/CSS), used
   by both HandTheater and the new Daily so the tables render identically.
3. `src/lib/dailyVotes.ts` — mirrors handPlays.ts: `fetchDailyVotes(day)`
   → `{choice: votes}`, `recordDailyVote(day, choice)` fire-and-forget RPC.
4. `supabase/schema.sql` append: `daily_votes(day int, choice text, votes int,
   pk(day,choice))`, public read, write only via bounds-checked
   `record_daily_vote` (day 1..20000, choice ∈ fold/check/call/bet/raise).
5. `DailyView` rewrite. Phases: brief → playing (auto-advance to the frozen
   step) → ask (choices from `choicesAt`) → runout (auto-advance to end) →
   reveal (real action + matched? + vote bar + winners table + share/streak).
   Per-day result persisted per profile (`daily.hand`) so a reload lands on
   the reveal, votes recorded once. `daily.streak` moves to profile-scoped
   state (cloud-synced), seeded from the old browser-wide value if present.
6. `src/drills/daily.ts` keeps `dailyNumber` + streak; drops the drill
   plumbing (`dailyDrill`, `judgeNumberGuess`, share grid); new `shareText`
   for the hand format. `daily.test.ts` updated to match.

## Error handling

No backend / offline → no vote bar, everything else works. Library missing a
qualifying hand for the day (cannot happen with 884 hands, but guarded) →
fall back to the highest-scoring hand overall.

## Testing

Unit tests: decision scoring (checks are 0, bigger price scores higher),
pickDaily determinism + eligibility across the real library, briefing lines,
streak migration, share text. Full suite + typecheck + build green; Playwright
walk-through of the whole flow.
