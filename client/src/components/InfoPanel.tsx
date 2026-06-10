import { useEffect, useRef, useState } from 'react'
import type { City, Contributor } from '../types'
import { fetchCityDetail } from '../api'
import BuildingViz from './BuildingViz'

const CONTRIBUTOR_REFRESH_MS = 5000

interface InfoPanelProps {
  city: City
  isHome: boolean
  userClicks?: number
  rank?: number
}

export default function InfoPanel({ city, isHome, userClicks, rank }: InfoPanelProps) {
  const [contributors, setContributors] = useState<Contributor[]>([])
  const [dailyChangePercent, setDailyChangePercent] = useState<number>(0)
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastCityId = useRef(city.id)

  // Fetch contributors on city change, debounce on click updates
  useEffect(() => {
    let cancelled = false
    const cityChanged = city.id !== lastCityId.current
    lastCityId.current = city.id

    const doFetch = () => {
      fetchCityDetail(city.id).then(detail => {
        if (!cancelled) {
          setContributors(detail.topContributors)
          setDailyChangePercent(detail.dailyChangePercent)
        }
      }).catch(() => {})
    }

    if (cityChanged) {
      clearTimeout(refreshTimer.current)
      doFetch()
    } else {
      if (!refreshTimer.current) {
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = undefined
          doFetch()
        }, CONTRIBUTOR_REFRESH_MS)
      }
    }

    return () => {
      cancelled = true
      clearTimeout(refreshTimer.current)
      refreshTimer.current = undefined
    }
  }, [city.id, city.totalClicks])

  return (
    <div className="panel bracketed info-panel">
      <div className="panel-label" style={{ marginBottom: 10 }}>City Dossier</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{city.name}</span>
          {isHome && <span className="home-badge">HOME</span>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{city.country}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rank !== undefined && rank > 0 && (
          <div className="stat-row">
            <span className="stat-key">Rank</span>
            <span className="stat-val stat-val--amber">#{rank}</span>
          </div>
        )}

        <div className="stat-row">
          <span className="stat-key">Population</span>
          <span className="stat-val stat-val--amber">{city.totalClicks.toLocaleString()}</span>
        </div>

        {dailyChangePercent !== 0 && (
          <div className="stat-row">
            <span className="stat-key">Daily change</span>
            <span className={`stat-val ${dailyChangePercent > 0 ? 'stat-val--green' : 'stat-val--red'}`}>
              {dailyChangePercent > 0 ? '+' : ''}{dailyChangePercent.toFixed(1)}%
            </span>
          </div>
        )}

        {city.highestEverPopulation > 0 && city.highestEverPopulation !== city.totalClicks && (
          <div className="stat-row">
            <span className="stat-key">Highest ever</span>
            <span className="stat-val">{city.highestEverPopulation.toLocaleString()}</span>
          </div>
        )}

        <div className="stat-row">
          <span className="stat-key">Citizens</span>
          <span className="stat-val">{city.contributorCount.toLocaleString()}</span>
        </div>

        {city.missileStockpile > 0 && (
          <div className="stat-row">
            <span className="stat-key">Missile stockpile</span>
            <span className="stat-val stat-val--red">{city.missileStockpile}</span>
          </div>
        )}

        {city.totalDead > 0 && (
          <div className="stat-row">
            <span className="stat-key">Total dead</span>
            <span className="stat-val stat-val--red">{city.totalDead.toLocaleString()}</span>
          </div>
        )}

        {userClicks !== undefined && (
          <div className="stat-row">
            <span className="stat-key">Your contribution</span>
            <span className="stat-val stat-val--amber">{userClicks.toLocaleString()}</span>
          </div>
        )}
      </div>

      {contributors.length > 0 && (
        <>
          <hr className="rule" />
          <span className="panel-label">Top Citizens</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {contributors.map((c, i) => (
              <div key={i} className="stat-row">
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                  {c.name}
                </span>
                <span className="stat-val" style={{ color: 'var(--dim)', fontSize: 12 }}>
                  {c.totalClicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {city.totalClicks > 0 && (
        <>
          <hr className="rule" />
          <BuildingViz totalClicks={city.totalClicks} />
        </>
      )}
    </div>
  )
}
