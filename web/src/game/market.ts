// Global market (game-run, infinite source/sink at fixed prices) and the
// player-priced city-to-city offer book (design §5).
import type { City, TradeOffer } from '../types'
import { resourceInfo } from './catalog'

export function addInv(city: City, r: string, qty: number): void {
  city.inventory[r] = Math.max(0, (city.inventory[r] || 0) + qty)
}

/** Buy from the global market. Clamps qty to what the city can afford.
 *  Returns the quantity actually bought. */
export function marketBuy(city: City, r: string, qty: number): number {
  const price = resourceInfo(r).buy
  const affordable = Math.floor(city.cash / price)
  const n = Math.max(0, Math.min(Math.floor(qty), affordable))
  if (n <= 0) return 0
  city.cash -= n * price
  addInv(city, r, n)
  return n
}

/** Sell to the global market. Clamps qty to stock. Returns quantity sold. */
export function marketSell(city: City, r: string, qty: number): number {
  const have = Math.floor(city.inventory[r] || 0)
  const n = Math.max(0, Math.min(Math.floor(qty), have))
  if (n <= 0) return 0
  city.cash += n * resourceInfo(r).sell
  addInv(city, r, -n)
  return n
}

/** Player-set offer prices are de-facto bounded by the global spread: undercut
 *  the game's buy price or beat its sell price and you have a deal (design §5). */
export function clampOfferPrice(r: string, price: number): number {
  const { sell, buy } = resourceInfo(r)
  return Math.max(sell, Math.min(buy, Math.round(price)))
}

let offerSeq = 0
export function makeOfferId(): string {
  offerSeq += 1
  return `offer-${offerSeq}-${Math.floor(performance.now())}`
}

/** Post a sell offer; reserves the goods out of the seller's inventory. */
export function postOffer(city: City, r: string, qty: number, price: number): TradeOffer | null {
  const n = Math.min(Math.floor(qty), Math.floor(city.inventory[r] || 0))
  if (n <= 0) return null
  addInv(city, r, -n)
  const offer: TradeOffer = {
    id: makeOfferId(),
    cityId: city.id,
    cityName: city.name,
    resource: r,
    qty: n,
    price: clampOfferPrice(r, price),
  }
  city.offers.push(offer)
  return offer
}

export function cancelOffer(city: City, offerId: string): void {
  const i = city.offers.findIndex(o => o.id === offerId)
  if (i < 0) return
  const [o] = city.offers.splice(i, 1)
  addInv(city, o.resource, o.qty) // return reserved goods
}

/** Gift goods from one city to another — no cash changes hands (design §8).
 *  Clamps to the giver's stock; returns the quantity actually gifted. */
export function giftResource(from: City, to: City, r: string, qty: number): number {
  if (from.id === to.id) return 0
  const n = Math.max(0, Math.min(Math.floor(qty), Math.floor(from.inventory[r] || 0)))
  if (n <= 0) return 0
  addInv(from, r, -n)
  addInv(to, r, n)
  return n
}

/** Buyer takes (part of) a seller's offer. Moves goods + cash between cities. */
export function takeOffer(buyer: City, seller: City, offer: TradeOffer, qty: number): number {
  const affordable = Math.floor(buyer.cash / offer.price)
  const n = Math.max(0, Math.min(Math.floor(qty), offer.qty, affordable))
  if (n <= 0) return 0
  buyer.cash -= n * offer.price
  seller.cash += n * offer.price
  addInv(buyer, offer.resource, n)
  offer.qty -= n
  if (offer.qty <= 0) {
    const i = seller.offers.findIndex(o => o.id === offer.id)
    if (i >= 0) seller.offers.splice(i, 1)
  }
  return n
}
