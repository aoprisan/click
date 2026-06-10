import type { User, GameMode } from '../types'

interface PlayerPanelProps {
  user: User
  gameMode: GameMode
  personalClicks: number
  cityName?: string
}

export default function PlayerPanel({ user, gameMode, personalClicks, cityName }: PlayerPanelProps) {
  return (
    <div className="panel bracketed player-panel">
      <div className="panel-label" style={{ marginBottom: 8 }}>Operator</div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--amber)' }}>{user.name}</span>
          {gameMode === 'warrior' && (
            <span style={{ fontSize: 10, color: 'var(--orange)' }}>+2/click</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 2 }}>
          {gameMode === 'warrior' ? 'Warrior' : 'Builder'} {cityName && `· ${cityName}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <StatRow label="Population added" value={personalClicks.toLocaleString()} mod="amber" />
        {user.totalKills > 0 && <StatRow label="Total kills" value={user.totalKills.toLocaleString()} mod="red" />}
        {user.best10s > 0 && <StatRow label="Best 10s" value={user.best10s.toLocaleString()} />}
        {(user.todayClicks !== undefined && user.todayClicks > 0) && <StatRow label="Today" value={user.todayClicks.toLocaleString()} />}
        {user.best1day > 0 && <StatRow label="Best 1 day" value={user.best1day.toLocaleString()} />}
      </div>
    </div>
  )
}

function StatRow({ label, value, mod }: { label: string; value: string; mod?: 'amber' | 'red' | 'green' }) {
  return (
    <div className="stat-row">
      <span className="stat-key">{label}</span>
      <span className={`stat-val${mod ? ` stat-val--${mod}` : ''}`}>{value}</span>
    </div>
  )
}
