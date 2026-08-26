import { useMemo, useState } from 'react';
import { SolverView } from './components/SolverView';
import { PlayView } from './components/PlayView';
import { LearnView } from './components/LearnView';
import { BotsView } from './components/BotsView';
import { DrillsView } from './components/DrillsView';
import { DailyView } from './components/DailyView';
import { useTheme } from './lib/useTheme';
import { InstallButton } from './components/InstallButton';
import { StatsView } from './components/StatsView';
import { StudyView } from './components/StudyView';
import { ProfileGate } from './components/ProfileGate';
import { activateProfile, getActiveProfileId, initProfileScope, listProfiles } from './lib/profiles';
import { Cloud, useCloud } from './lib/useCloud';

type Tab = 'daily' | 'learn' | 'study' | 'drills' | 'solver' | 'bots' | 'play' | 'stats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'learn', label: 'Learn' },
  { id: 'study', label: 'Study' },
  { id: 'drills', label: 'Drills' },
  { id: 'solver', label: 'Solver' },
  { id: 'bots', label: 'Bots' },
  { id: 'play', label: 'Play' },
  { id: 'stats', label: 'Stats' },
];

function ThemeIcon({ theme }: { theme: 'dark' | 'light' }) {
  return theme === 'dark' ? (
    // sun
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  ) : (
    // moon
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export default function App() {
  // Resolve the stored profile before any child reads scoped storage.
  const [profileId, setProfileId] = useState<string | null>(() => initProfileScope());
  // Bumped when a cloud pull changes local data, so everything re-reads it.
  const [cloudEpoch, setCloudEpoch] = useState(0);

  if (!profileId) return <ProfileGate onPick={setProfileId} />;
  // Remount everything on profile switch so all persisted state re-reads.
  return (
    <Trainer
      key={`${profileId}:${cloudEpoch}`}
      profileId={profileId}
      onRemoteApplied={() => setCloudEpoch((e) => e + 1)}
      onSwitch={() => {
        activateProfile(null);
        setProfileId(null);
      }}
    />
  );
}

function CloudChip({ cloud, onSignIn }: { cloud: Cloud; onSignIn: () => void }) {
  if (!cloud.enabled) return null;
  if (cloud.status === 'signedOut' || cloud.status === 'disabled') {
    return (
      <button className="cloud-chip" onClick={onSignIn} title="Sign in to sync your progress across devices">
        ☁ Sign in
      </button>
    );
  }
  const label = cloud.status === 'syncing' ? 'syncing…' : cloud.status === 'offline' ? 'offline' : 'synced';
  return (
    <button
      className={`cloud-chip on ${cloud.status}`}
      title={`${cloud.email ?? 'Signed in'} — click to sign out`}
      onClick={() => {
        if (confirm('Sign out? Your progress stays on this device and in the cloud.')) void cloud.signOut();
      }}
    >
      ☁ {label}
    </button>
  );
}

function Trainer({
  profileId,
  onSwitch,
  onRemoteApplied,
}: {
  profileId: string;
  onSwitch: () => void;
  onRemoteApplied: () => void;
}) {
  const [tab, setTab] = useState<Tab>('daily');
  const me = useMemo(() => listProfiles().find((p) => p.id === getActiveProfileId()), []);
  const { theme, toggle } = useTheme();
  const cloud = useCloud(profileId, onRemoteApplied);
  const [playBot, setPlayBot] = useState<string | null>(null);

  const goPlay = (botId: string) => {
    setPlayBot(botId);
    setTab('play');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">♠</span>
          <div>
            <h1>
              Fold<span className="pip">♦</span>Call<span className="pip">♥</span>Jam
            </h1>
            <span className="tagline">Learn GTO poker properly.</span>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <CloudChip cloud={cloud} onSignIn={onSwitch} />
          {me && (
            <button className="who" onClick={onSwitch} title="Switch player">
              <span className="who-avatar">{me.avatar}</span>
              <span className="who-name">{me.name}</span>
            </button>
          )}
          <InstallButton />
          <button
            className="theme-toggle"
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
          >
            <ThemeIcon theme={theme} />
          </button>
        </nav>
      </header>

      <main>
        {tab === 'daily' && <DailyView onGoDrills={() => setTab('drills')} />}
        {tab === 'learn' && <LearnView />}
        {tab === 'study' && <StudyView />}
        {tab === 'drills' && <DrillsView />}
        {tab === 'solver' && <SolverView />}
        {tab === 'bots' && <BotsView onPlay={goPlay} />}
        {tab === 'play' && <PlayView initialBotId={playBot} />}
        {tab === 'stats' && <StatsView />}
      </main>

      <footer className="footer">
        <span>Built for study. Ranges are solver-derived references, not a live solver.</span>
      </footer>
    </div>
  );
}
