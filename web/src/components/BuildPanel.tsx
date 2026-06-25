import type { City } from '../types'
import {
  getBuilding, buildCost, upgradeCost, constructionUnits, formatRecipe,
} from '../game/catalog'
import { isOperational } from '../game/economy'

interface Props {
  city: City
  activeBuildingId: string
  onSelectActive: (defId: string) => void
  onBuild: (defId: string) => void
  onUpgrade: (defId: string) => void
  onOpenTechTree: () => void
}

export default function BuildPanel({ city, activeBuildingId, onSelectActive, onBuild, onUpgrade, onOpenTechTree }: Props) {
  return (
    <div className="panel build-panel bracketed">
      <span className="panel-label panel-label--amber">Buildings</span>

      {/* operational + in-progress buildings — click to aim your clicks */}
      <div className="build-list scroll-y" style={{ maxHeight: '46vh', marginTop: 6 }}>
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
      {/* The full construct catalog lives in a roomy overlay (the tech tree). */}
      <button className="tech-open-btn" onClick={onOpenTechTree}>＋ Construct · Tech Tree</button>
    </div>
  )
}
