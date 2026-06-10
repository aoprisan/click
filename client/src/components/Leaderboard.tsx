import { useState } from 'react'
import type { City } from '../types'

interface LeaderboardProps {
  cities: City[]
}

export default function Leaderboard({ cities }: LeaderboardProps) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768)

  const maxClicks = Math.max(1, ...cities.map(c => c.totalClicks))

  return (
    <div className="panel bracketed leaderboard-panel">
      <div
        className="panel-head"
        onClick={() => setCollapsed(!collapsed)}
        style={{ marginBottom: collapsed ? 0 : 10 }}
      >
        <span className="panel-label">Most Populated</span>
        <span className="panel-toggle">{collapsed ? '+' : '−'}</span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {cities.length === 0 && (
            <span className="lb-empty">No population yet</span>
          )}
          {cities.map((city, i) => (
            <div key={city.id} className="lb-row">
              <div className="lb-line">
                <div className="lb-left">
                  <span className="lb-rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="lb-name">{city.name}</span>
                  <span className="lb-cc">{city.countryCode}</span>
                </div>
                <span className="lb-val">{city.totalClicks.toLocaleString()}</span>
              </div>
              <div
                className="lb-bar"
                style={{ width: `${Math.max(2, (city.totalClicks / maxClicks) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
