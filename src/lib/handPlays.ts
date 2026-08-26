import { getSupabase, supabaseEnabled } from './supabase';

// Global Study-hand play counters — the one genuinely cross-user feature.
// Readable by everyone; written only through the bounds-checked
// `record_hand_play` RPC so nobody can set a counter directly.

export interface HandPlayStats {
  plays: number;
  guesses: number;
  matched: number;
}

let cache: Record<string, HandPlayStats> | null = null;

export async function fetchHandPlays(): Promise<Record<string, HandPlayStats>> {
  if (!supabaseEnabled()) return {};
  if (cache) return cache;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('hand_plays').select('hand_id,plays,guesses,matched');
    if (error || !data) return {};
    const out: Record<string, HandPlayStats> = {};
    for (const row of data) {
      out[row.hand_id as string] = {
        plays: row.plays as number,
        guesses: row.guesses as number,
        matched: row.matched as number,
      };
    }
    cache = out;
    return out;
  } catch {
    return {};
  }
}

/** Fire-and-forget: a finished Study hand bumps the global counter. */
export function recordHandPlay(handId: string, guesses: number, matched: number): void {
  if (!supabaseEnabled()) return;
  const g = Math.max(0, Math.min(30, Math.round(guesses)));
  const m = Math.max(0, Math.min(g, Math.round(matched)));
  void getSupabase()
    .then((supabase) =>
      supabase.rpc('record_hand_play', { p_hand_id: handId, p_guesses: g, p_matched: m }),
    )
    .then(() => {
      // Keep the local cache roughly honest without a refetch.
      if (cache) {
        const prev = cache[handId] ?? { plays: 0, guesses: 0, matched: 0 };
        cache[handId] = { plays: prev.plays + 1, guesses: prev.guesses + g, matched: prev.matched + m };
      }
    })
    .catch(() => {
      /* a lost counter bump is fine */
    });
}
