import { BOTS, BotProfile } from '../bots/personalities';

const STAT_LABELS: { key: keyof BotProfile; label: string }[] = [
  { key: 'tightness', label: 'Tightness' },
  { key: 'aggression', label: 'Aggression' },
  { key: 'bluffFreq', label: 'Bluffing' },
  { key: 'station', label: 'Call-happy' },
  { key: 'tilt', label: 'Tilt' },
];

export function BotsView({ onPlay }: { onPlay?: (botId: string) => void }) {
  return (
    <div className="view">
      <div className="panel">
        <h2>The Bots</h2>
        <p className="muted">
          Six opponents, each with a distinct personality and an exploitable leak. Study the archetype, then grind them
          in the Play tab until the adjustment is automatic.
        </p>
      </div>
      <div className="bot-grid">
        {BOTS.map((bot) => (
          <div key={bot.id} className="bot-card">
            <div className="bot-head">
              <span className="bot-avatar">{bot.avatar}</span>
              <div>
                <h3>{bot.name}</h3>
                <span className="bot-arch">{bot.archetype}</span>
              </div>
            </div>
            <p className="bot-blurb">{bot.blurb}</p>
            <div className="bot-stats">
              {STAT_LABELS.map(({ key, label }) => (
                <div className="bot-stat" key={key}>
                  <span className="bot-stat-label">{label}</span>
                  <div className="bot-stat-track">
                    <div className="bot-stat-fill" style={{ width: `${(bot[key] as number) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {onPlay && (
              <button className="primary" onClick={() => onPlay(bot.id)}>
                Play heads-up vs {bot.name.split(' ')[0]}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
