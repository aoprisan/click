import { useMemo, useState } from 'react'
import type { City, Operator } from '../types'
import { SHOP_ITEMS } from '../game/shop'

interface Props {
  operator: Operator
  cities: City[]
  now: number
  onBuy: (itemId: string) => void
  onUse: (itemId: string) => void
  onMove: (cityId: string) => void
}

const drinks = SHOP_ITEMS.filter(i => i.kind === 'energy_drink')
const autos = SHOP_ITEMS.filter(i => i.kind === 'autoclicker')
const airTicket = SHOP_ITEMS.find(i => i.kind === 'air_ticket')!

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${s}s`
}

export default function ShopPanel({ operator, cities, now, onBuy, onUse, onMove }: Props) {
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [query, setQuery] = useState('')

  const mult = operator.activeMultiplier && now < operator.activeMultiplier.expiresAt ? operator.activeMultiplier : null
  const autoLeft = operator.autoclickerUntil && now < operator.autoclickerUntil ? operator.autoclickerUntil - now : 0
  const tickets = operator.items['air-ticket'] || 0

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...cities].filter(c => c.id !== operator.homeCityId).sort((a, b) => b.population - a.population)
    return (q ? list.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)) : list).slice(0, 20)
  }, [query, cities, operator.homeCityId])

  return (
    <div className="panel bracketed">
      <div className="panel-head" onClick={() => setOpen(o => !o)}>
        <span className="panel-label panel-label--amber">Shop · <span className="cash-chip">ᗸ{operator.bucks}</span></span>
        <span className="panel-toggle">{open ? '–' : '+'}</span>
      </div>

      {/* active boosts always visible as a status line */}
      {(mult || autoLeft > 0) && (
        <div className="tiny" style={{ marginTop: 4 }}>
          {mult && <span className="orange">⚡{mult.factor}× {countdown(mult.expiresAt - now)} </span>}
          {autoLeft > 0 && <span className="green">⚙ employee {countdown(autoLeft)}</span>}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 8 }}>
          <span className="panel-label">Energy Drinks (click ×)</span>
          <div className="market-list" style={{ marginTop: 4 }}>
            {drinks.map(it => {
              const owned = operator.items[it.id] || 0
              return (
                <div key={it.id} className="market-row">
                  <span>{it.label}{owned ? <span className="muted"> ×{owned}</span> : null}</span>
                  <button className="mini-btn buy" disabled={operator.bucks < it.bucks} onClick={() => onBuy(it.id)}>ᗸ{it.bucks}</button>
                  <button className="mini-btn" disabled={owned <= 0} onClick={() => onUse(it.id)}>use</button>
                </div>
              )
            })}
          </div>

          <hr className="rule" />
          <span className="panel-label">Autoclickers</span>
          <div className="market-list" style={{ marginTop: 4 }}>
            {autos.map(it => {
              const owned = operator.items[it.id] || 0
              return (
                <div key={it.id} className="market-row">
                  <span>{it.label}{owned ? <span className="muted"> ×{owned}</span> : null}</span>
                  <button className="mini-btn buy" disabled={operator.bucks < it.bucks} onClick={() => onBuy(it.id)}>ᗸ{it.bucks}</button>
                  <button className="mini-btn" disabled={owned <= 0} onClick={() => onUse(it.id)}>hire</button>
                </div>
              )
            })}
          </div>

          <hr className="rule" />
          <div className="row">
            <span className="panel-label">Air Tickets <span className="muted">×{tickets}</span></span>
            <button className="mini-btn buy" disabled={operator.bucks < airTicket.bucks} onClick={() => onBuy(airTicket.id)}>ᗸ{airTicket.bucks}</button>
          </div>
          <button className="btn-ghost" style={{ marginTop: 6, width: '100%' }} disabled={tickets <= 0} onClick={() => setMoving(m => !m)}>
            {moving ? 'cancel move' : 'Move home city →'}
          </button>
          {moving && (
            <>
              <input className="field" style={{ marginTop: 6, padding: '6px 10px', fontSize: 12 }} autoFocus placeholder="Search city…" value={query} onChange={e => setQuery(e.target.value)} />
              <div className="city-list" style={{ maxHeight: 160 }}>
                {matches.map(c => (
                  <button key={c.id} className="city-option" onClick={() => { onMove(c.id); setMoving(false); setQuery('') }}>
                    {c.name} <span className="dim">· {c.country}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
