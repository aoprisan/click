import type { City } from '../types'
import BuildingViz from './BuildingViz'

interface InfoPanelProps {
  city: City
  isHome: boolean
  userClicks?: number
  rank?: number
}

export default function InfoPanel({ city, isHome, userClicks, rank }: InfoPanelProps) {
  return (
    <div className="panel" style={{
      bottom: 32, left: 24, width: 280,
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{city.name}</span>
          {isHome && (
            <span style={{
              fontSize: 10, background: 'var(--gold)', color: '#000',
              padding: '2px 6px', borderRadius: 4, fontWeight: 600,
            }}>
              HOME
            </span>
          )}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{city.country}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rank !== undefined && rank > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Rank</span>
            <span className="mono" style={{ fontSize: 14, color: 'var(--gold)' }}>
              #{rank}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Total clicks</span>
          <span className="mono" style={{ fontSize: 14, color: 'var(--gold)' }}>
            {city.totalClicks.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Contributors</span>
          <span className="mono" style={{ fontSize: 14 }}>
            {city.contributorCount.toLocaleString()}
          </span>
        </div>

        {userClicks !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Your clicks</span>
            <span className="mono" style={{ fontSize: 14, color: 'var(--gold)' }}>
              {userClicks.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {city.totalClicks > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <BuildingViz totalClicks={city.totalClicks} />
        </div>
      )}
    </div>
  )
}
