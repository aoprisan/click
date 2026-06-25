import { Fragment, useMemo, useState } from 'react'
import type { City } from '../types'

interface Props {
  cities: City[]
  homeCityId: string | null
  onSelect: (city: City) => void
}

// The panel cycles through these on each header click:
//  collapsed → standings (leaders + your neighborhood) → bracket (just around you).
const MODES = ['collapsed', 'standings', 'bracket'] as const
type Mode = (typeof MODES)[number]

const MODE_LABEL: Record<Mode, string> = {
  collapsed: 'Most Populated',
  standings: 'Standings',
  bracket: 'Your Bracket',
}

function range(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let i = lo; i <= hi; i++) out.push(i)
  return out
}

export default function Leaderboard({ cities, homeCityId, onSelect }: Props) {
  const [modeIdx, setModeIdx] = useState(0)
  const mode = MODES[modeIdx]

  const sorted = useMemo(
    () => [...cities].sort((a, b) => b.population - a.population),
    [cities],
  )
  const myIdx = useMemo(
    () => (homeCityId ? sorted.findIndex(c => c.id === homeCityId) : -1),
    [sorted, homeCityId],
  )

  // Which indices (into `sorted`) the current open mode shows. Standings merges
  // the top 3 with your ±2 neighborhood into a single block when they touch
  // (e.g. you're near the top), otherwise leaves a gap marker between them.
  const shown = useMemo(() => {
    const n = sorted.length
    if (n === 0) return []
    // No home city yet → both open modes fall back to a plain top list.
    if (myIdx < 0) return range(0, Math.min(6, n) - 1)

    const winStart = Math.max(0, myIdx - 2)
    const winEnd = Math.min(n - 1, myIdx + 2)
    if (mode === 'bracket') return range(winStart, winEnd)

    // standings: leaders (top 3) + your window.
    if (winStart <= 3) {
      // Contiguous with the leaders — one block, padded to ~top 6 when you're
      // high up so the view doesn't feel thin.
      return range(0, Math.min(n - 1, Math.max(winEnd, 5)))
    }
    return [...range(0, 2), ...range(winStart, winEnd)]
  }, [sorted, myIdx, mode])

  // Scale bars to the largest population on screen so neighbors stay comparable
  // even deep down the board (where everyone is tiny next to the world leader).
  const shownMax = useMemo(
    () => Math.max(1, ...shown.map(i => sorted[i].population)),
    [shown, sorted],
  )

  return (
    <div className="panel leaderboard-panel bracketed">
      <div className="panel-head" onClick={() => setModeIdx(i => (i + 1) % MODES.length)}>
        <span className="panel-label panel-label--amber">{MODE_LABEL[mode]}</span>
        <span className="lb-head-right">
          {myIdx >= 0 && <span className="lb-myrank">#{myIdx + 1}</span>}
          <span className="lb-modes" aria-hidden="true">
            {MODES.map((m, i) => <i key={m} className={i === modeIdx ? 'on' : ''} />)}
          </span>
        </span>
      </div>
      {mode !== 'collapsed' && (
        <div style={{ marginTop: 8 }}>
          {shown.length === 0 && <div className="lb-empty">No cities yet</div>}
          {shown.map((idx, k) => {
            const c = sorted[idx]
            const prev = shown[k - 1]
            const gap = prev !== undefined ? idx - prev - 1 : 0
            const isHome = c.id === homeCityId
            return (
              <Fragment key={c.id}>
                {gap > 0 && (
                  <div className="lb-gap"><span>⋯ {gap} more</span></div>
                )}
                <div
                  className={`lb-row${isHome ? ' is-home' : ''}`}
                  onClick={() => onSelect(c)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="lb-line">
                    <div className="lb-left">
                      <span className="lb-rank">{idx + 1}</span>
                      <span className="lb-name" style={{ color: isHome ? 'var(--amber)' : undefined }}>{c.name}</span>
                      <span className="lb-cc">{c.countryCode}</span>
                    </div>
                    <span className="lb-val">{Math.round(c.population).toLocaleString()}</span>
                  </div>
                  <div className="lb-bar" style={{ width: `${(c.population / shownMax) * 100}%` }} />
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
