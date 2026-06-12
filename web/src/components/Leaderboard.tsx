import { useState } from 'react'
import type { City } from '../types'

interface Props {
  cities: City[]
  homeCityId: string | null
  onSelect: (city: City) => void
}

export default function Leaderboard({ cities, homeCityId, onSelect }: Props) {
  const [open, setOpen] = useState(true)
  const top = [...cities].sort((a, b) => b.population - a.population).slice(0, 6)
  const max = Math.max(1, ...top.map(c => c.population))

  return (
    <div className="panel leaderboard-panel bracketed">
      <div className="panel-head" onClick={() => setOpen(o => !o)}>
        <span className="panel-label panel-label--amber">Most Populated</span>
        <span className="panel-toggle">{open ? '–' : '+'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {top.map((c, i) => (
            <div key={c.id} className="lb-row" onClick={() => onSelect(c)} style={{ cursor: 'pointer' }}>
              <div className="lb-line">
                <div className="lb-left">
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name" style={{ color: c.id === homeCityId ? 'var(--amber)' : undefined }}>{c.name}</span>
                  <span className="lb-cc">{c.countryCode}</span>
                </div>
                <span className="lb-val">{Math.round(c.population).toLocaleString()}</span>
              </div>
              <div className="lb-bar" style={{ width: `${(c.population / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
