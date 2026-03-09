import type { GlobalStats } from '../types'

interface GlobalDataPanelProps {
  stats: GlobalStats | null
  totalPopulation: number
}

export default function GlobalDataPanel({ stats, totalPopulation }: GlobalDataPanelProps) {
  return (
    <div className="global-counter" style={{
      position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
        World Population
      </div>
      <div className="mono" style={{ fontSize: 20, color: 'var(--gold)', fontWeight: 700 }}>
        {totalPopulation.toLocaleString()}
      </div>
      {stats && (
        <>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6 }}>
            {stats.dailyChangePercent !== 0 && (
              <span style={{ fontSize: 10, color: stats.dailyChangePercent > 0 ? '#4ade80' : '#f87171' }}>
                {stats.dailyChangePercent > 0 ? '+' : ''}{stats.dailyChangePercent.toFixed(1)}% avg today
              </span>
            )}
            {stats.worldMissileStockpile > 0 && (
              <span style={{ fontSize: 10, color: '#f87171' }}>
                {stats.worldMissileStockpile} missiles
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {stats.cityCount} cities
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              avg {Math.round(stats.avgPopulation).toLocaleString()}
            </span>
            {stats.highestEverPop > 0 && (
              <span style={{ fontSize: 10, color: 'var(--gold)' }}>
                peak {stats.highestEverCity} ({stats.highestEverPop.toLocaleString()})
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
