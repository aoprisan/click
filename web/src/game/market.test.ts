import { describe, it, expect } from 'vitest'
import { marketBuy, marketSell, clampOfferPrice, postOffer, takeOffer } from './market'
import { resourceInfo } from './catalog'
import { makeCity } from './testUtils'

describe('market', () => {
  it('buys from the global market, clamped to affordable qty', () => {
    const price = resourceInfo('Grain').buy
    const city = makeCity({ cash: price * 3 + 1 })
    const got = marketBuy(city, 'Grain', 100)
    expect(got).toBe(3)
    expect(city.inventory['Grain']).toBe(3)
  })

  it('sells to the global market, clamped to stock', () => {
    const city = makeCity({ cash: 0, inventory: { Grain: 5 } })
    const sold = marketSell(city, 'Grain', 100)
    expect(sold).toBe(5)
    expect(city.cash).toBe(5 * resourceInfo('Grain').sell)
    expect(city.inventory['Grain']).toBe(0)
  })

  it('clamps offer prices into the global spread', () => {
    const { sell, buy } = resourceInfo('Grain')
    expect(clampOfferPrice('Grain', 0)).toBe(sell)
    expect(clampOfferPrice('Grain', 999999)).toBe(buy)
  })

  it('posts an offer reserving goods, then a buyer takes it', () => {
    const seller = makeCity({ id: 's', name: 'Seller', inventory: { Grain: 20 } })
    const offer = postOffer(seller, 'Grain', 10, resourceInfo('Grain').buy)!
    expect(offer.qty).toBe(10)
    expect(seller.inventory['Grain']).toBe(10) // reserved out

    const buyer = makeCity({ id: 'b', name: 'Buyer', cash: 100000 })
    const bought = takeOffer(buyer, seller, offer, 4)
    expect(bought).toBe(4)
    expect(buyer.inventory['Grain']).toBe(4)
    expect(seller.cash).toBeGreaterThan(1000)
    expect(offer.qty).toBe(6)
  })
})
