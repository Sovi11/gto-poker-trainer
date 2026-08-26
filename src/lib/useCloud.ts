import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthChange, signOut, supabaseEnabled } from './supabase';
import {
  SyncStatus,
  getCloudLink,
  getSyncStatus,
  nudgeSync,
  onSyncStatus,
  setCloudLink,
  startSync,
  stopSync,
} from './sync';
import { listProfiles } from './profiles';

// Glue between the session, the profile system, and the sync engine, for the
// signed-in half of the app. Whichever profile the account is linked to gets
// mirrored while it is active; everything else stays purely local.

export interface Cloud {
  enabled: boolean;
  status: SyncStatus;
  email: string | null;
  signOut: () => Promise<void>;
}

export function useCloud(profileId: string, onRemoteApplied: () => void): Cloud {
  const [status, setStatus] = useState<SyncStatus>(() =>
    supabaseEnabled() ? getSyncStatus() : 'disabled',
  );
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled()) return;
    const offStatus = onSyncStatus(setStatus);
    let stopped = false;
    let startedForUid: string | null = null;

    const begin = async (session: Session | null) => {
      if (stopped) return;
      if (!session) {
        startedForUid = null;
        setEmail(null);
        stopSync();
        return;
      }
      const uid = session.user.id;
      setEmail(session.user.email ?? null);
      if (startedForUid === uid) return; // INITIAL_SESSION + SIGNED_IN both fire
      startedForUid = uid;

      let link = getCloudLink();
      if (!link || link.uid !== uid) {
        // First sign-in in this browser: the profile you are using becomes
        // the synced one.
        link = { uid, profileId };
        setCloudLink(link);
      }
      if (link.profileId !== profileId) return; // a different profile owns the account
      const me = listProfiles().find((p) => p.id === profileId);
      const changed = await startSync(uid, profileId, {
        name: me?.name ?? 'Player',
        avatar: me?.avatar ?? '♠',
      });
      if (changed && !stopped) onRemoteApplied();
    };

    getSession()
      .then(begin)
      .catch(() => {
        /* not configured / network down — stay signed out */
      });
    const offAuth = onAuthChange((s) => void begin(s));
    const nudge = () => nudgeSync();
    window.addEventListener('online', nudge);
    window.addEventListener('focus', nudge);
    return () => {
      stopped = true;
      offStatus();
      offAuth();
      window.removeEventListener('online', nudge);
      window.removeEventListener('focus', nudge);
      stopSync();
    };
    // onRemoteApplied intentionally not a dep: it only bumps a remount counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const doSignOut = useCallback(async () => {
    stopSync();
    setEmail(null);
    try {
      await signOut();
    } catch {
      /* already signed out or offline — local state is cleared either way */
    }
  }, []);

  return { enabled: supabaseEnabled(), status, email, signOut: doSignOut };
}
