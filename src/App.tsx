import { useState } from 'react';
import { SolverView } from './components/SolverView';
import { PlayView } from './components/PlayView';
import { LearnView } from './components/LearnView';
import { BotsView } from './components/BotsView';
import { DrillsView } from './components/DrillsView';
import { DailyView } from './components/DailyView';

type Tab = 'daily' | 'learn' | 'drills' | 'solver' | 'bots' | 'play';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'daily', label: 'Daily', icon: '📅' },
  { id: 'learn', label: 'Learn', icon: '📚' },
  { id: 'drills', label: 'Drills', icon: '🎯' },
  { id: 'solver', label: 'Solver', icon: '🧮' },
  { id: 'bots', label: 'Bots', icon: '🤖' },
  { id: 'play', label: 'Play', icon: '🃏' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('daily');
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
            <h1>GTO Poker Trainer</h1>
            <span className="tagline">Learn the math. Grind the bots. Print.</span>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
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
