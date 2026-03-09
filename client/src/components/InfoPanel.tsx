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
    <div className="panel info-panel" style={{
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
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Population</span>
          <span className="mono" style={{ fontSize: 14, color: 'var(--gold)' }}>
            {city.totalClicks.toLocaleString()}
          </span>
        </div>

        {dailyChangePercent !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Daily change</span>
            <span className="mono" style={{
              fontSize: 14,
              color: dailyChangePercent > 0 ? '#4ade80' : '#f87171',
            }}>
              {dailyChangePercent > 0 ? '+' : ''}{dailyChangePercent.toFixed(1)}%
            </span>
          </div>
        )}

        {city.highestEverPopulation > 0 && city.highestEverPopulation !== city.totalClicks && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Highest ever</span>
            <span className="mono" style={{ fontSize: 14 }}>
              {city.highestEverPopulation.toLocaleString()}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Citizens</span>
          <span className="mono" style={{ fontSize: 14 }}>
            {city.contributorCount.toLocaleString()}
          </span>
        </div>

        {city.missileStockpile > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Missile stockpile</span>
            <span className="mono" style={{ fontSize: 14, color: '#f87171' }}>
              {city.missileStockpile}
            </span>
          </div>
        )}

        {city.totalDead > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Total dead</span>
            <span className="mono" style={{ fontSize: 14, color: '#f87171' }}>
              {city.totalDead.toLocaleString()}
            </span>
          </div>
        )}

        {userClicks !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Your contribution</span>
            <span className="mono" style={{ fontSize: 14, color: 'var(--gold)' }}>
              {userClicks.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {contributors.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Top Citizens
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {contributors.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {c.name}
                </span>
                <span className="mono" style={{ color: 'var(--text-dim)', flexShrink: 0, marginLeft: 8 }}>
                  {c.totalClicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {city.totalClicks > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <BuildingViz totalClicks={city.totalClicks} />
        </div>
      )}
    </div>
  )
}
