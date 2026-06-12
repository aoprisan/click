import { useState } from 'react'
import type { City } from '../types'
import { resourceInfo } from '../game/catalog'

interface Props {
  home: City
  cities: City[]
  onBuyOffer: (offerId: string, qty: number) => void
  onPostOffer: (resource: string, qty: number, price: number) => void
  onCancelOffer: (offerId: string) => void
  onGift: (toCityId: string, resource: string, qty: number) => void
}

export default function TradePanel({ home, cities, onBuyOffer, onPostOffer, onCancelOffer, onGift }: Props) {
  const [open, setOpen] = useState(false)
  const [resource, setResource] = useState('')
  const [qty, setQty] = useState('10')
  const [price, setPrice] = useState('')
  const [giftTo, setGiftTo] = useState('')
  const [giftResrc, setGiftResrc] = useState('')
  const [giftQty, setGiftQty] = useState('10')

  const otherOffers = cities
    .filter(c => c.id !== home.id)
    .flatMap(c => c.offers)
    .sort((a, b) => a.price - b.price)
    .slice(0, 8)

  const sellable = Object.entries(home.inventory).filter(([, q]) => q >= 1).map(([r]) => r)
  const giftTargets = cities
    .filter(c => c.id !== home.id)
    .sort((a, b) => b.population - a.population)
    .slice(0, 60)

  return (
    <div className="panel bracketed">
      <div className="panel-head" onClick={() => setOpen(o => !o)}>
        <span className="panel-label panel-label--amber">City Trade</span>
        <span className="panel-toggle">{open ? '–' : '+'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          <span className="panel-label">Offers from other cities</span>
          <div className="trade-list scroll-y" style={{ maxHeight: '20vh', marginTop: 4 }}>
            {otherOffers.length === 0 && <span className="muted tiny">no open offers</span>}
            {otherOffers.map(o => (
              <div key={o.id} className="trade-row">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${o.resource} from ${o.cityName}`}>
                  {o.resource} <span className="muted">×{o.qty}</span>
                </span>
                <span className="muted tiny">@{o.price} · {o.cityName}</span>
                <button className="mini-btn buy" disabled={home.cash < o.price} onClick={() => onBuyOffer(o.id, o.qty)}>buy</button>
              </div>
            ))}
          </div>

          <hr className="rule" />
          <span className="panel-label">Your offers</span>
          <div className="trade-list" style={{ marginTop: 4 }}>
            {home.offers.length === 0 && <span className="muted tiny">none listed</span>}
            {home.offers.map(o => (
              <div key={o.id} className="trade-row">
                <span>{o.resource} <span className="muted">×{o.qty}</span></span>
                <span className="muted tiny">@{o.price}</span>
                <button className="mini-btn" onClick={() => onCancelOffer(o.id)}>cancel</button>
              </div>
            ))}
          </div>

          <hr className="rule" />
          <span className="panel-label">List a good</span>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            <select className="field" style={{ flex: 1, minWidth: 100, padding: '4px 6px', fontSize: 11 }} value={resource} onChange={e => { setResource(e.target.value); const i = resourceInfo(e.target.value); setPrice(String(i.buy)) }}>
              <option value="">resource…</option>
              {sellable.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="field" style={{ width: 50, padding: '4px 6px', fontSize: 11 }} value={qty} onChange={e => setQty(e.target.value)} placeholder="qty" />
            <input className="field" style={{ width: 50, padding: '4px 6px', fontSize: 11 }} value={price} onChange={e => setPrice(e.target.value)} placeholder="$" />
            <button
              className="mini-btn"
              disabled={!resource}
              onClick={() => { onPostOffer(resource, Number(qty) || 0, Number(price) || 0); setResource('') }}
            >
              list
            </button>
          </div>
          {resource && (
            <div className="tiny muted" style={{ marginTop: 3 }}>
              price clamps to {resourceInfo(resource).sell}–{resourceInfo(resource).buy}
            </div>
          )}

          <hr className="rule" />
          <span className="panel-label">Gift a good <span className="muted tiny">(no cash — help an ally)</span></span>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            <select className="field" style={{ flex: 1, minWidth: 90, padding: '4px 6px', fontSize: 11 }} value={giftResrc} onChange={e => setGiftResrc(e.target.value)}>
              <option value="">good…</option>
              {sellable.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="field" style={{ width: 44, padding: '4px 6px', fontSize: 11 }} value={giftQty} onChange={e => setGiftQty(e.target.value)} placeholder="qty" />
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            <select className="field" style={{ flex: 1, minWidth: 90, padding: '4px 6px', fontSize: 11 }} value={giftTo} onChange={e => setGiftTo(e.target.value)}>
              <option value="">to city…</option>
              {giftTargets.map(c => <option key={c.id} value={c.id}>{c.name} · {c.countryCode}</option>)}
            </select>
            <button
              className="mini-btn"
              disabled={!giftResrc || !giftTo}
              onClick={() => { onGift(giftTo, giftResrc, Number(giftQty) || 0); setGiftResrc('') }}
            >
              gift
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
