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
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastCityId = useRef(city.id)

  // Fetch contributors on city change, debounce on click updates
  useEffect(() => {
    let cancelled = false
    const cityChanged = city.id !== lastCityId.current
    lastCityId.current = city.id

    const doFetch = () => {
      fetchCityDetail(city.id).then(detail => {
        if (!cancelled) setContributors(detail.topContributors)
      }).catch(() => {})
    }

    if (cityChanged) {
      // Immediate fetch when switching cities
      clearTimeout(refreshTimer.current)
      doFetch()
    } else {
      // Debounced fetch on click updates
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

      {contributors.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Top Contributors
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
