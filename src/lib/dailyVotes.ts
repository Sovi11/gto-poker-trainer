import { getSupabase, supabaseEnabled } from './supabase';

// Community vote split for the daily hand. Same shape as handPlays.ts:
// public read, writes only through a bounds-checked RPC.

export type DailyChoice = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export async function fetchDailyVotes(day: number): Promise<Record<string, number>> {
  if (!supabaseEnabled()) return {};
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('daily_votes').select('choice,votes').eq('day', day);
    if (error || !data) return {};
    const out: Record<string, number> = {};
    for (const row of data) out[row.choice as string] = row.votes as number;
    return out;
  } catch {
    return {};
  }
}

/** Fire-and-forget: one vote per answered daily. */
export function recordDailyVote(day: number, choice: DailyChoice): void {
  if (!supabaseEnabled()) return;
  void getSupabase()
    .then((supabase) => supabase.rpc('record_daily_vote', { p_day: day, p_choice: choice }))
    .catch(() => {
      /* a lost vote is fine */
    });
}
