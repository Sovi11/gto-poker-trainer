import { useState } from 'react';
import { AVATARS, Profile, activateProfile, createProfile, deleteProfile, listProfiles } from '../lib/profiles';

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

        <p className="gate-note muted small">
          Profiles are stored in this browser only — no account, no password, nothing sent anywhere. Anyone using this
          computer can switch between them.
        </p>
      </div>
    </div>
  );
}
