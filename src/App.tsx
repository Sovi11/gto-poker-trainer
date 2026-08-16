import { useState } from 'react';
import { SolverView } from './components/SolverView';
import { PlayView } from './components/PlayView';
import { LearnView } from './components/LearnView';
import { BotsView } from './components/BotsView';
import { DrillsView } from './components/DrillsView';
import { DailyView } from './components/DailyView';
import { useTheme } from './lib/useTheme';
import { InstallButton } from './components/InstallButton';

type Tab = 'daily' | 'learn' | 'drills' | 'solver' | 'bots' | 'play';

const TABS: { id: Tab; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'learn', label: 'Learn' },
  { id: 'drills', label: 'Drills' },
  { id: 'solver', label: 'Solver' },
  { id: 'bots', label: 'Bots' },
  { id: 'play', label: 'Play' },
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
  const [tab, setTab] = useState<Tab>('daily');
  const { theme, toggle } = useTheme();
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
        {tab === 'drills' && <DrillsView />}
        {tab === 'solver' && <SolverView />}
        {tab === 'bots' && <BotsView onPlay={goPlay} />}
        {tab === 'play' && <PlayView initialBotId={playBot} />}
      </main>

      <footer className="footer">
        <span>Built for study. Ranges are solver-derived references, not a live solver.</span>
      </footer>
    </div>
  );
}
