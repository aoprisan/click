import { useState } from 'react'
import type { City } from '../types'
import {
  ALL_BUILDINGS, ALL_BRANCHES, getBuilding, buildCost, upgradeCost,
  constructionUnits, formatRecipe,
} from '../game/catalog'
import { isOperational } from '../game/economy'

interface Props {
  city: City
  activeBuildingId: string
  onSelectActive: (defId: string) => void
  onBuild: (defId: string) => void
  onUpgrade: (defId: string) => void
}

export default function BuildPanel({ city, activeBuildingId, onSelectActive, onBuild, onUpgrade }: Props) {
  const [branch, setBranch] = useState<string>('Civic')

  const builtIds = new Set(city.buildings.map(b => b.defId))
  // Production buildings are one-per-city (upgrade to grow); residential blocks
  // stack, so housing always stays buildable — it's the population lever (§3).
  const catalog = ALL_BUILDINGS.filter(b => b.branch === branch && (b.isResidential || !builtIds.has(b.id)))

  return (
    <div className="panel build-panel bracketed">
      <span className="panel-label panel-label--amber">Buildings</span>

      {/* operational + in-progress buildings — click to aim your clicks */}
      <div className="build-list scroll-y" style={{ maxHeight: '24vh', marginTop: 6 }}>
        {city.buildings.map(b => {
          const def = getBuilding(b.defId)!
          const op = isOperational(b)
          const constructing = b.constructionRemaining > 0
          const total = constructionUnits(def)
          const pct = constructing ? (1 - b.constructionRemaining / total) * 100 : 0
          return (
            <div
              key={b.defId}
              className={`build-row${b.defId === activeBuildingId ? ' active' : ''}${constructing ? ' constructing' : ''}`}
              onClick={() => onSelectActive(b.defId)}
            >
              <div className="row">
                <span className="build-name">{def.name}{op ? ` L${b.level}` : ''}</span>
                {op && !def.isResidential && (
                  <button className="mini-btn" onClick={e => { e.stopPropagation(); onUpgrade(b.defId) }}>
                    ↑ ${upgradeCost(def, b.level)}
                  </button>
                )}
                {op && def.isResidential && (
                  <button className="mini-btn buy" disabled={city.cash < buildCost(def)} onClick={e => { e.stopPropagation(); onBuild(b.defId) }}>
                    +block ${buildCost(def)}
                  </button>
                )}
              </div>
              <span className="build-recipe">{formatRecipe(def)}</span>
              {constructing && <div className="progress"><span style={{ width: `${pct}%` }} /></div>}
            </div>
          )
        })}
      </div>

      <hr className="rule" />
      <span className="panel-label">Construct</span>
      <div className="branch-tabs">
        {ALL_BRANCHES.map(b => (
          <button key={b} className={`branch-tab${b === branch ? ' sel' : ''}`} onClick={() => setBranch(b)}>
            {b.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="build-list scroll-y" style={{ maxHeight: '22vh' }}>
        {catalog.length === 0 && <span className="muted tiny">all built in this branch</span>}
        {catalog.map(def => {
          const cost = buildCost(def)
          const afford = city.cash >= cost
          return (
            <div key={def.id} className="build-row">
              <div className="row">
                <span className="build-name">{def.name}{def.tier > 0 ? ` · T${def.tier}` : ''}</span>
                <button className="mini-btn buy" disabled={!afford} onClick={() => onBuild(def.id)}>${cost}</button>
              </div>
              <span className="build-recipe">{formatRecipe(def)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
