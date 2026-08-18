// Versioned localStorage helpers. All persistence goes through this module so
// keys stay namespaced and a missing/corrupt value can never crash the app —
// every failure mode degrades to the caller's fallback.

const PREFIX = 'gto-trainer:v1:';

function backend(): Storage | null {
  try {
    // localStorage can be undefined (SSR/tests) or throw (some private modes).
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* fall through */
  }
  return null;
}

export function loadJSON<T>(key: string, fallback: T): T {
  const s = backend();
  if (!s) return fallback;
  try {
    const raw = s.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback; // corrupt JSON → fresh start, never a crash
  }
}

export function saveJSON(key: string, value: unknown): void {
  const s = backend();
  if (!s) return;
  try {
    s.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode — persistence is best-effort */
  }
}

export function removeKey(key: string): void {
  const s = backend();
  if (!s) return;
  try {
    s.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Profile scoping
// ---------------------------------------------------------------------------
// Everything a player accumulates (progress, streaks, hand history) is stored
// under the active profile so several people can share one browser without
// stepping on each other. Profile-independent settings (theme, the profile
// list itself) keep using the bare keys.

let activeProfile: string | null = null;

export function setActiveProfileKey(id: string | null): void {
  activeProfile = id;
}

export function scopedKey(key: string): string {
  return activeProfile ? `p/${activeProfile}/${key}` : key;
}

/** Delete every stored value belonging to one profile. */
export function purgeProfile(id: string): void {
  const s = backend();
  if (!s) return;
  const prefix = `${PREFIX}p/${id}/`;
  const doomed: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) s.removeItem(k);
  } catch {
    /* best effort */
  }
}
