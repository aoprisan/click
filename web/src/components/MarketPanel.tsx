import { useState } from 'react'
import type { City } from '../types'
import { resourceInfo, getBuilding } from '../game/catalog'
import { FOOD_GOODS, ENERGY_GOODS } from '../game/civic'

interface Props {
  city: City
  onSell: (resource: string, qty: number) => void
  onBuy: (resource: string, qty: number) => void
}

export default function MarketPanel({ city, onSell, onBuy }: Props) {
  const [open, setOpen] = useState(true)
  const holdings = Object.entries(city.inventory)
    .filter(([, q]) => q >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="panel bracketed">
      <div className="panel-head" onClick={() => setOpen(o => !o)}>
        <span className="panel-label panel-label--amber">Global Market</span>
        <span className="panel-toggle">{open ? '–' : '+'}</span>
      </div>
      {open && (
        <div className="market-list" style={{ marginTop: 8 }}>
          <div className="tiny muted">Sell surplus at the game's price (infinite buyer).</div>
          {holdings.length === 0 && <span className="muted tiny">nothing to sell yet</span>}
          {holdings.map(([r, q]) => {
            const info = resourceInfo(r)
            return (
              <div key={r} className="market-row">
                <span title={r} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r} <span className="muted">×{Math.round(q)}</span>
                </span>
                <span className="muted tiny">@{info.sell}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="mini-btn sell" onClick={() => onSell(r, 10)}>−10</button>
                  <button className="mini-btn sell" onClick={() => onSell(r, q)}>all</button>
                </div>
              </div>
            )
          })}
          <hr className="rule" />
          <div className="tiny muted">Buy inputs you're short on.</div>
          {neededInputs(city).map(r => {
            const info = resourceInfo(r)
            return (
              <div key={r} className="market-row">
                <span title={r} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</span>
                <span className="muted tiny">@{info.buy}</span>
                <button className="mini-btn buy" disabled={city.cash < info.buy * 10} onClick={() => onBuy(r, 10)}>+10</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function neededInputs(city: City): string[] {
  const wants = new Set<string>()
  // Building input shortfalls.
  for (const b of city.buildings) {
    const def = getBuilding(b.defId)
    if (!def) continue
    for (const r of Object.keys(def.inputs)) {
      if ((city.inventory[r] || 0) < 10) wants.add(r)
    }
  }
  // Food/energy when running low — so a starving city has a recovery path.
  const pop = Math.max(1, city.population)
  const foodStock = FOOD_GOODS.reduce((a, g) => a + (city.inventory[g] || 0), 0)
  if (foodStock < pop * 0.05) wants.add('Grain')
  const energyStock = ENERGY_GOODS.reduce((a, g) => a + (city.inventory[g] || 0), 0)
  if (pop >= 1000 && energyStock < pop * 0.04) wants.add('Grid Energy')
  return [...wants].slice(0, 6)
}
