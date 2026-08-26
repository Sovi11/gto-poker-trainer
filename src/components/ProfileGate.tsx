import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AVATARS, Profile, activateProfile, createProfile, deleteProfile, listProfiles } from '../lib/profiles';
import { getSession, onAuthChange, signInWithEmail, signOut, supabaseEnabled } from '../lib/supabase';
import { fetchRemoteProfile, getCloudLink, setCloudLink } from '../lib/sync';

// The sign-in screen. Deliberately not a password form: everything is stored in
// this browser, so a password would protect nothing. Profiles keep separate
// stats per person, which is the part that actually matters.
export function ProfileGate({ onPick }: { onPick: (id: string) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>(() => listProfiles());
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [creating, setCreating] = useState(() => listProfiles().length === 0);

  const choose = (id: string) => {
    activateProfile(id);
    onPick(id);
  };

  const create = () => {
    const p = createProfile(name, avatar);
    setProfiles(listProfiles());
    choose(p.id);
  };

  const remove = (p: Profile) => {
    if (!confirm(`Delete "${p.name}" and all of their stats and saved hands? This cannot be undone.`)) return;
    deleteProfile(p.id);
    const rest = listProfiles();
    setProfiles(rest);
    if (rest.length === 0) setCreating(true);
  };

  return (
    <div className="gate">
      <div className="gate-card panel">
        <div className="gate-brand">
          <span className="gate-spade">♠</span>
          <div>
            <h1>Fold Call or Jam</h1>
            <p className="muted">Who’s playing?</p>
          </div>
        </div>

        {profiles.length > 0 && (
          <div className="gate-list">
            {profiles.map((p) => (
              <div key={p.id} className="gate-row">
                <button className="gate-profile" onClick={() => choose(p.id)}>
                  <span className="gate-avatar">{p.avatar}</span>
                  <span className="gate-name">{p.name}</span>
                </button>
                <button className="gate-del" onClick={() => remove(p)} title={`Delete ${p.name}`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {creating ? (
          <div className="gate-create">
            <label>
              Name
              <input
                value={name}
                autoFocus
                maxLength={24}
                placeholder="e.g. Pravar"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </label>
            <div className="gate-avatars">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className={`gate-avatar-pick ${avatar === a ? 'on' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button className="primary big" onClick={create}>
                Start playing
              </button>
              {profiles.length > 0 && (
                <button className="link-btn" onClick={() => setCreating(false)}>
                  cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <button className="gate-add" onClick={() => setCreating(true)}>
            + New player
          </button>
        )}

        {supabaseEnabled() && <CloudSection onRestored={choose} />}

        <p className="gate-note muted small">
          {supabaseEnabled()
            ? 'Profiles live in this browser. Add your email to sync one across devices — otherwise nothing leaves this machine.'
            : 'Profiles are stored in this browser only — no account, no password, nothing sent anywhere. Anyone using this computer can switch between them.'}
        </p>
      </div>
    </div>
  );
}


// Optional account: a magic-link email that syncs one profile across devices.
// On a fresh device the profile is rebuilt from the cloud row automatically.
function CloudSection({ onRestored }: { onRestored: (id: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let live = true;
    getSession()
      .then((s) => {
        if (!live) return;
        setSession(s);
        setChecked(true);
      })
      .catch(() => live && setChecked(true));
    const off = onAuthChange((s) => {
      if (live) setSession(s);
    });
    return () => {
      live = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    const link = getCloudLink();
    const linkedExists = link && link.uid === uid && listProfiles().some((p) => p.id === link.profileId);
    if (linkedExists) return;
    let live = true;
    setRestoring(true);
    void fetchRemoteProfile(uid).then((meta) => {
      if (!live) return;
      setRestoring(false);
      if (!meta) return; // brand-new account — it links to the first profile played
      const p = createProfile(meta.name, meta.avatar);
      setCloudLink({ uid, profileId: p.id });
      onRestored(p.id);
    });
    return () => {
      live = false;
    };
  }, [session, onRestored]);

  const send = async () => {
    const clean = email.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(clean);
      setSent(true);
    } catch {
      setError('Could not send the link. Check the address and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!checked) return null;

  if (session) {
    const link = getCloudLink();
    const synced = link && link.uid === session.user.id ? listProfiles().find((p) => p.id === link.profileId) : null;
    return (
      <div className="gate-cloud">
        <p className="muted small">
          ☁ Signed in as <strong>{session.user.email}</strong>
          {synced ? ` — syncing “${synced.name}”` : restoring ? ' — restoring your profile…' : ''}
        </p>
        <button
          className="link-btn"
          onClick={() => {
            setCloudLink(null);
            void signOut();
          }}
        >
          sign out
        </button>
      </div>
    );
  }

  return (
    <div className="gate-cloud">
      {sent ? (
        <p className="muted small">☁ Link sent — open the email on this device to finish signing in.</p>
      ) : (
        <>
          <p className="muted small">Play on more than one device? Sync a profile with just your email:</p>
          <div className="gate-cloud-row">
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void send()}
            />
            <button className="primary" disabled={busy} onClick={() => void send()}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </div>
          {error && <p className="gate-error small">{error}</p>}
        </>
      )}
    </div>
  );
}
