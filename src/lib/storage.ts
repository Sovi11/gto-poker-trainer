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
