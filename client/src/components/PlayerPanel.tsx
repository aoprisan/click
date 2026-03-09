import type { User, GameMode } from '../types'

interface PlayerPanelProps {
  user: User
  gameMode: GameMode
  personalClicks: number
  cityName?: string
}

export default function PlayerPanel({ user, gameMode, personalClicks, cityName }: PlayerPanelProps) {
  return (
    <div className="panel player-panel" style={{
      bottom: 210, right: 24, width: 220,
    }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--gold)' }}>{user.name}</span>
          {gameMode === 'warrior' && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>+2/click</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {gameMode === 'warrior' ? 'Warrior' : 'Builder'} {cityName && `· ${cityName}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <StatRow label="Population added" value={personalClicks.toLocaleString()} color="var(--gold)" />
        {user.totalKills > 0 && <StatRow label="Total kills" value={user.totalKills.toLocaleString()} color="#f87171" />}
        {user.best10s > 0 && <StatRow label="Best 10s" value={user.best10s.toLocaleString()} />}
        {(user.todayClicks !== undefined && user.todayClicks > 0) && <StatRow label="Today" value={user.todayClicks.toLocaleString()} />}
        {user.best1day > 0 && <StatRow label="Best 1 day" value={user.best1day.toLocaleString()} />}
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="mono" style={{ color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}
