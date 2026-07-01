import type { City } from '../types'
import {
  getBuilding, buildCost, upgradeCost, constructionUnits, workPerBatch, formatRecipe,
} from '../game/catalog'
import { isOperational, batchShortfall } from '../game/economy'

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
          const constructing = b.constructionRemaining > 0 // legacy pre-instant save
          const constructPct = constructing ? (1 - b.constructionRemaining / constructionUnits(def)) * 100 : 0
          // Every operational producer shows its progress toward the next product
          // (capped when banked work is stalled). Only the active building — the
          // one your clicks feed — actually fills; the rest sit ready at 0.
          const producing = op && !def.isResidential
          const prodPct = producing ? Math.min(1, b.workAccumulated / workPerBatch(def)) * 100 : 0
          // Operational producers that can't run for want of an input: name the
          // missing goods so the player knows what to build/buy/trade for. A
          // blocked building can't be aimed at — clicks wouldn't count anyway.
          const missing = op && !def.isResidential ? batchShortfall(city, def) : []
          const blocked = missing.length > 0
          return (
            <div
              key={b.defId}
              className={`build-row${b.defId === activeBuildingId ? ' active' : ''}${constructing ? ' constructing' : ''}${blocked ? ' blocked' : ''}`}
              onClick={() => { if (!blocked) onSelectActive(b.defId) }}
              title={blocked ? `Needs ${missing.join(', ')} to produce` : undefined}
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
              {missing.length > 0 && (
                <span className="build-needs">⛔ needs {missing.join(', ')}</span>
              )}
              {constructing
                ? <div className="progress"><span style={{ width: `${constructPct}%` }} /></div>
                : producing && <div className="progress producing"><span style={{ width: `${prodPct}%` }} /></div>}
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
