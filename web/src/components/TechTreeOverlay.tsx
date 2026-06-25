// Full-screen "construct" catalog (the tech tree). Lifted out of the cramped
// BuildPanel so the 10-branch × 10-tier tree gets room to breathe and scroll,
// without fighting the current-buildings list or the inventory panel below it.
import { useEffect, useState } from 'react'
import type { City } from '../types'
import {
  ALL_BUILDINGS, ALL_BRANCHES, buildCost, formatRecipe, tierUnlockPopulation,
} from '../game/catalog'
import { isBuildingUnlocked } from '../game/economy'

interface Props {
  city: City
  onBuild: (defId: string) => void
  onClose: () => void
}

export default function TechTreeOverlay({ city, onBuild, onClose }: Props) {
  const [branch, setBranch] = useState<string>('Civic')

  // Esc closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const builtIds = new Set(city.buildings.map(b => b.defId))
  // Residential blocks stack (always buildable); production buildings are
  // one-per-city — once built they leave the catalog and you upgrade instead.
  const catalog = ALL_BUILDINGS.filter(b => b.branch === branch && (b.isResidential || !builtIds.has(b.id)))

  return (
    <div className="tech-overlay" onClick={onClose}>
      <div className="tech-modal bracketed" onClick={e => e.stopPropagation()}>
        <div className="tech-head">
          <span className="panel-label panel-label--amber">Tech Tree · Construct</span>
          <button className="tutorial-skip" onClick={onClose} title="close (Esc)">close ✕</button>
        </div>

        <div className="branch-tabs">
          {ALL_BRANCHES.map(b => (
            <button key={b} className={`branch-tab${b === branch ? ' sel' : ''}`} onClick={() => setBranch(b)}>
              {b}
            </button>
          ))}
        </div>

        <div className="tech-grid scroll-y">
          {catalog.length === 0 && <span className="muted tiny">all built in this branch</span>}
          {catalog.map(def => {
            const cost = buildCost(def)
            const afford = city.cash >= cost
            const unlocked = isBuildingUnlocked(city, def)
            return (
              <div key={def.id} className={`build-row${unlocked ? '' : ' locked'}`}>
                <div className="row">
                  <span className="build-name">{def.name}{def.tier > 0 ? ` · T${def.tier}` : ''}</span>
                  {unlocked ? (
                    <button className="mini-btn buy" disabled={!afford} onClick={() => onBuild(def.id)}>${cost}</button>
                  ) : (
                    <span className="mini-btn locked-tag" title={`unlocks at population ${tierUnlockPopulation(def.tier).toLocaleString()}`}>
                      🔒 {tierUnlockPopulation(def.tier).toLocaleString()}
                    </span>
                  )}
                </div>
                <span className="build-recipe">{formatRecipe(def)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
