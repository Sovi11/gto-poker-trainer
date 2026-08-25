# Supabase backend: login, sync, and cross-user play counts

Date: 2026-08-25 · Status: approved by Pravar (chat)

## Goal

Add optional player accounts to the (currently 100% client-side) trainer so
progress follows a person across devices, make the Study tab's "most played"
sort real across all users, and put the app in a shippable state on
Cloudflare Pages. The app must keep working exactly as today when logged out,
offline, or when Supabase is unconfigured/down.

## Decisions (from brainstorming)

- **Login model:** optional login + sync. Local guest profiles keep working
  untouched; signing in links the active local profile to the account.
- **Auth method:** email magic link only (`signInWithOtp`). No passwords.
- **Cross-user:** yes — global play counts + decision match-rate per Study hand.
- **Hosting:** Cloudflare Pages primary (served at `/`), GitHub Pages stays
  alive until flipped.

## Architecture (approach C — hybrid)

Personal data syncs as a JSONB state blob; the one genuinely shared feature
gets a normalized public table.

### Components

1. `src/lib/supabase.ts` — lazy async singleton around `@supabase/supabase-js`
   (dynamic import so guests never download it). Reads
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; when absent, every cloud
   feature silently disables (`supabaseEnabled() === false`).
2. `src/lib/sync.ts` — the sync engine.
   - Envelope stored per user in `player_state.data`:
     `{ [scopedKey]: { v: <value>, t: <ms epoch> } }`.
   - Local per-key timestamps in a scoped `__sync_ts` map (excluded from sync).
   - Push: storage layer notifies on every profile-scoped write → stamp ts →
     debounce 2 s → upsert whole envelope. Failures queue silently; next write
     or an online event retries.
   - Pull on login/app start: last-write-wins per key (remote wins only when
     `remote.t` is newer); merged local-newer keys push back. If the pull
     changed anything, the Trainer remounts.
   - Profile identity (name/avatar) rides in a `profile` JSONB column so a
     fresh device can recreate the profile.
3. Auth UI — ProfileGate gains a "sync across devices" email form (magic
   link); topbar gains a cloud chip showing signed-out / syncing / synced /
   offline, with sign-out.
   - Link record (bare key `cloudLink`): `{ uid, profileId }`. Session + link
     → sync that profile. Session + no link → link active profile, or
     recreate from the remote row on a fresh device.
4. Cross-user table `hand_plays(hand_id text pk, plays int, guesses int, matched int)`.
   - Readable by everyone; writable ONLY via RPC `record_hand_play` (security
     definer, bounds-checked) so counters cannot be set directly.
   - Study: new "Most played" sort; reveal screen shows "N players ran this
     hand · matched X% of decisions". Recorded fire-and-forget when a hand
     finishes (guests included).
5. `supabase/schema.sql` — one file to paste into the Supabase SQL editor:
   tables, RLS policies, RPC.
6. Shipping — `public/_redirects` SPA fallback; Vite `base` switches to `/`
   when `CF_PAGES` env is present; `.env.example`; README setup section
   (Supabase URL config + redirect allowlist + Cloudflare Pages connect
   steps).

### Error handling

- No env vars → app is byte-for-byte today's behaviour (no supabase-js in the
  bundle path, no chip, no popular sort).
- Supabase down / offline → writes keep landing in localStorage; chip shows
  "offline"; push retries on next change/online event. Nothing blocks the UI.
- RPC abuse guarded server-side: bounds (0 ≤ matched ≤ guesses ≤ 30),
  increment-only.

### Testing

- Pure-function tests for the merge (`mergeStates`): remote-newer wins,
  local-newer survives, unknown remote keys land, `__sync_ts` never syncs.
- Envelope build/apply round-trip test against a fake storage.
- Existing 334 tests must stay green; typecheck + build clean.

### Out of scope

Leaderboards, usernames/social, migrating GitHub Pages off, custom domain,
payments (explicitly none).
