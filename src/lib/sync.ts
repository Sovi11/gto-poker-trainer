import { listKeys, loadJSON, saveJSON, setWriteListener } from './storage';
import { getSupabase } from './supabase';

// Cloud sync: mirrors the active profile's localStorage keyspace into one
// Supabase row, last-write-wins per key.
//
// localStorage stays the source of truth — the app never reads from the
// network on the hot path. Sync is a mirror that pushes after local writes and
// merges the remote copy in once, at start-up. If Supabase is down or the
// device is offline nothing blocks: writes queue behind a dirty flag and the
// next write (or regaining focus) retries.

export interface Stamped {
  v: unknown;
  t: number;
}
export type Envelope = Record<string, Stamped>;

/** Timestamp bookkeeping lives under this scoped key and never syncs. */
const TS_KEY = '__sync_ts';
const PUSH_DEBOUNCE_MS = 2000;

export interface MergeResult {
  merged: Envelope;
  /** Keys where the remote copy won and must be written locally. */
  remoteWon: string[];
  /** True when anything local is newer or missing remotely — a push is due. */
  pushNeeded: boolean;
}

/** Last-write-wins per key. Pure so it can be tested to death. */
export function mergeStates(local: Envelope, remote: Envelope): MergeResult {
  const merged: Envelope = {};
  const remoteWon: string[] = [];
  let pushNeeded = false;
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    if (k === TS_KEY) continue; // bookkeeping never syncs
    const l = local[k];
    const r = remote[k];
    if (l && (!r || l.t >= r.t)) {
      merged[k] = l;
      if (!r || l.t > r.t) pushNeeded = true;
    } else if (r) {
      merged[k] = r;
      remoteWon.push(k);
    }
  }
  return { merged, remoteWon, pushNeeded };
}

// ---------------------------------------------------------------------------
// Local envelope <-> storage
// ---------------------------------------------------------------------------

function scopePrefix(profileId: string): string {
  return `p/${profileId}/`;
}

function loadTs(profileId: string): Record<string, number> {
  return loadJSON<Record<string, number>>(scopePrefix(profileId) + TS_KEY, {});
}

/** Snapshot the profile's entire scoped keyspace as a stamped envelope. */
export function buildEnvelope(profileId: string): Envelope {
  const prefix = scopePrefix(profileId);
  const ts = loadTs(profileId);
  const out: Envelope = {};
  for (const full of listKeys(prefix)) {
    const short = full.slice(prefix.length);
    if (short === TS_KEY) continue;
    out[short] = { v: loadJSON<unknown>(full, null), t: ts[short] ?? 0 };
  }
  return out;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export type SyncStatus = 'disabled' | 'signedOut' | 'syncing' | 'synced' | 'offline';

let status: SyncStatus = 'signedOut';
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus): void {
  status = s;
  statusListeners.forEach((fn) => fn(s));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

let active: {
  uid: string;
  profileId: string;
  profileMeta: { name: string; avatar: string };
} | null = null;
let pushTimer: number | null = null;
let dirty = false;
let applyingRemote = false;

async function pushNow(): Promise<void> {
  if (!active) return;
  const { uid, profileId, profileMeta } = active;
  dirty = false;
  try {
    setStatus('syncing');
    const supabase = await getSupabase();
    const { error } = await supabase.from('player_state').upsert({
      user_id: uid,
      profile: profileMeta,
      data: buildEnvelope(profileId),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setStatus(dirty ? 'syncing' : 'synced');
    if (dirty) schedulePush(); // writes landed while we were in flight
  } catch {
    dirty = true; // keep the flag so the next write retries
    setStatus('offline');
  }
}

function schedulePush(): void {
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

function handleWrite(key: string): void {
  if (!active || applyingRemote) return;
  const prefix = scopePrefix(active.profileId);
  if (!key.startsWith(prefix)) return; // bare keys (theme, profile list) stay local
  const short = key.slice(prefix.length);
  if (short === TS_KEY) return;
  const ts = loadTs(active.profileId);
  ts[short] = Date.now();
  applyingRemote = true; // the ts write itself must not re-enter
  saveJSON(prefix + TS_KEY, ts);
  applyingRemote = false;
  dirty = true;
  schedulePush();
}

/**
 * Start syncing one profile for one signed-in user. Pulls the remote row,
 * merges it in, pushes anything local that is newer, then mirrors every
 * subsequent write. Returns true when the merge changed local data (the
 * caller should remount so React re-reads storage).
 */
export async function startSync(
  uid: string,
  profileId: string,
  profileMeta: { name: string; avatar: string },
): Promise<boolean> {
  stopSync();
  active = { uid, profileId, profileMeta };
  setWriteListener(handleWrite);
  let changed = false;
  try {
    setStatus('syncing');
    const supabase = await getSupabase();
    const { data: row, error } = await supabase
      .from('player_state')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    const remote = (row?.data ?? {}) as Envelope;
    const local = buildEnvelope(profileId);
    const { merged, remoteWon, pushNeeded } = mergeStates(local, remote);
    if (remoteWon.length > 0) {
      const prefix = scopePrefix(profileId);
      const ts = loadTs(profileId);
      applyingRemote = true;
      try {
        for (const k of remoteWon) {
          saveJSON(prefix + k, merged[k].v);
          ts[k] = merged[k].t;
        }
        saveJSON(prefix + TS_KEY, ts);
      } finally {
        applyingRemote = false;
      }
      changed = true;
    }
    if (pushNeeded || !row) {
      await pushNow();
    } else {
      setStatus('synced');
    }
  } catch {
    setStatus('offline');
  }
  return changed;
}

export function stopSync(): void {
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = null;
  active = null;
  dirty = false;
  setWriteListener(null);
  setStatus('signedOut');
}

/** Retry hook: call when the tab regains focus or the browser comes online. */
export function nudgeSync(): void {
  if (active && (dirty || status === 'offline')) schedulePush();
}

/** The remote profile identity, for restoring an account on a fresh device. */
export async function fetchRemoteProfile(
  uid: string,
): Promise<{ name: string; avatar: string } | null> {
  try {
    const supabase = await getSupabase();
    const { data: row } = await supabase
      .from('player_state')
      .select('profile')
      .eq('user_id', uid)
      .maybeSingle();
    const p = row?.profile as { name?: string; avatar?: string } | null;
    if (!p || typeof p.name !== 'string') return null;
    return { name: p.name, avatar: typeof p.avatar === 'string' ? p.avatar : '♠' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Account <-> profile link (bare key, browser-wide)
// ---------------------------------------------------------------------------

export interface CloudLink {
  uid: string;
  profileId: string;
}

const LINK_KEY = 'cloudLink';

export function getCloudLink(): CloudLink | null {
  return loadJSON<CloudLink | null>(LINK_KEY, null);
}

export function setCloudLink(link: CloudLink | null): void {
  saveJSON(LINK_KEY, link);
}
