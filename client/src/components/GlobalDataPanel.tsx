import type { GlobalStats } from '../types'

interface GlobalDataPanelProps {
  stats: GlobalStats | null
  totalPopulation: number
}

export default function GlobalDataPanel({ stats, totalPopulation }: GlobalDataPanelProps) {
  return (
    <div className="global-counter">
      <div className="gc-label">World Population</div>
      <div className="gc-value">{totalPopulation.toLocaleString()}</div>
      {stats && (
        <>
          <div className="gc-meta">
            {stats.dailyChangePercent !== 0 && (
              <span className={stats.dailyChangePercent > 0 ? 'green' : 'red'}>
                {stats.dailyChangePercent > 0 ? '+' : ''}{stats.dailyChangePercent.toFixed(1)}% avg today
              </span>
            )}
            {stats.worldMissileStockpile > 0 && (
              <span className="red">
                ▲ {stats.worldMissileStockpile} missiles
              </span>
            )}
          </div>
          <div className="gc-meta">
            <span>{stats.cityCount} cities</span>
            <span>avg {Math.round(stats.avgPopulation).toLocaleString()}</span>
            {stats.highestEverPop > 0 && (
              <span className="amber">
                peak {stats.highestEverCity} ({stats.highestEverPop.toLocaleString()})
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
