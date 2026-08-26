import type { Session, SupabaseClient } from '@supabase/supabase-js';

// Supabase is entirely optional. Without the env vars the app is exactly the
// local-only trainer it always was: no client is created, no bytes of
// supabase-js are downloaded, and every cloud call site checks
// `supabaseEnabled()` before doing anything.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function supabaseEnabled(): boolean {
  return Boolean(url && anonKey);
}

let clientPromise: Promise<SupabaseClient> | null = null;

/** The shared client, created on first use via dynamic import. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!url || !anonKey) return Promise.reject(new Error('Supabase is not configured'));
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      // detectSessionInUrl picks the tokens out of the magic-link redirect.
      createClient(url, anonKey, { auth: { detectSessionInUrl: true, flowType: 'pkce' } }),
    );
  }
  return clientPromise;
}

export async function getSession(): Promise<Session | null> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Send the magic link. Resolves when the email is queued, not when clicked. */
export async function signInWithEmail(email: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

/** Subscribe to session changes. Returns an unsubscribe function. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  getSupabase()
    .then((supabase) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
      unsub = () => data.subscription.unsubscribe();
    })
    .catch(() => {
      /* not configured */
    });
  return () => {
    cancelled = true;
    unsub?.();
  };
}
