# Match archive

On October 24, 2026, the Chipzen replay UI was used to save **17 matches and
1,135 hands**. The local archive is in
`artifacts/match-data/2026-10-24/`, within this project's OneDrive folder.
OneDrive synchronization was not independently verified. Raw data is ignored by
Git; this document is the durable repository pointer.

## Contents

- `matches.csv`: match IDs, opponents, hand counts, replay URLs and filenames.
- `index.json`: discovery index and collection timestamp.
- `<match-id>.json`: a rendered replay snapshot for every hand. Each snapshot
  includes starting stacks, four revealed hole cards, and the expanded action
  list with board transitions, bets, pot values and displayed outcomes.
- `challenges.txt`: original Challenges page snapshot, including the RiverMind
  walkover, which has no played-hand replay.
- `manifest.json`: per-file SHA256 hashes, bot identity/source mappings and
  coverage limitations.
- `browser-collection-session.js`: saved CUA session routine for refreshing
  existing replay records in bounded, checkpointed batches.

Coverage is the 16 replay links exposed by the current Challenges page plus
the previously known lil-bot-v8 rated match. This is all the replay history
discovered in this session, not proof that Chipzen exposes every historical
match. ALLIN-v2 had no matches at collection time. Preserve bot IDs when
comparing versions; the original remote ALLIN's exact code revision is unknown.

## Refresh procedure

Use the signed-in browser's Challenges page to discover new replay links and
save a new dated index. On each replay, expand the current-hand action list,
reveal both players' cards with their **exact accessible button names**, then
capture the DOM snapshot. Advance with Next hand and check the displayed hand
number before saving. Regex role-name matching missed the card controls in
this browser; the exact-label collection and subsequent verification corrected
that gap. Checkpoint after at most 60 hands per browser call.

The saved session routine refreshes files already present in the index; new
matches first need their initial snapshot records. It requires the documented
CUA browser runtime and is not a standalone authenticated API scraper.

Run from the repository root after collection:

```powershell
node artifacts/match-data/verify-archive.mjs
```

The verifier checks unique match URLs, contiguous hand numbers, displayed
action lists and four revealed starting hole cards for every hand, then writes
the CSV and checksum manifest. The October 24 run passed for all 1,135 hands.

## Analysis limits

These are post-match rendered snapshots, not original server events or a
normalized training dataset. Preserve action labels as reported; do not assume
every displayed raise amount is a raise-to amount. Runtime latency, RNG state,
solver diagnostics and decision-time equity estimates are unavailable here.
Opponent cards are hindsight information and must not enter live policy inputs.

No continuous collection job is installed. Re-run collection after new matches
or build a separately validated ingestion service when a supported export/API
is available. The hosted bot container itself has no durable local storage.
