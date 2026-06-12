import { describe, it, expect } from 'vitest'
import {
  SHOP_ITEMS, getShopItem, buyItem, useItem, currentMultiplier, isAutoclicking,
  expireBoosts, normalizeOperator, STOCKPILE_MAX, TOP_ITEM_ID,
} from './shop'
import type { Operator } from '../types'

function makeOp(over: Partial<Operator> = {}): Operator {
  return {
    id: 'op', name: 'Test', homeCityId: 'c', totalUnits: 0,
    bucks: 5000, items: {}, activeMultiplier: null, autoclickerUntil: null, ...over,
  }
}

describe('shop', () => {
  it('has energy drinks, autoclickers, and an air ticket', () => {
    expect(SHOP_ITEMS.some(i => i.kind === 'energy_drink')).toBe(true)
    expect(SHOP_ITEMS.some(i => i.kind === 'autoclicker')).toBe(true)
    expect(getShopItem('air-ticket')?.kind).toBe('air_ticket')
    expect(getShopItem(TOP_ITEM_ID)?.kind).toBe('energy_drink')
  })

  it('buys items for Bucks, capped by stockpile', () => {
    const op = makeOp({ bucks: 100000 })
    const drink = SHOP_ITEMS.find(i => i.kind === 'energy_drink')!
    const r = buyItem(op, drink.id)
    expect(r.ok).toBe(true)
    expect(op.items[drink.id]).toBe(1)
    expect(op.bucks).toBe(100000 - drink.bucks)

    op.items[drink.id] = STOCKPILE_MAX
    expect(buyItem(op, drink.id).ok).toBe(false) // full
  })

  it('refuses a purchase you cannot afford', () => {
    const op = makeOp({ bucks: 0 })
    expect(buyItem(op, 'air-ticket').ok).toBe(false)
  })

  it('activates an energy drink multiplier that expires', () => {
    const drink = SHOP_ITEMS.find(i => i.factor === 5)!
    const op = makeOp({ items: { [drink.id]: 1 } })
    useItem(op, drink.id, 1000)
    expect(currentMultiplier(op, 1000)).toBe(5)
    expect(op.items[drink.id]).toBe(0)
    const after = 1000 + drink.durationMs! + 1
    expect(currentMultiplier(op, after)).toBe(1)
    expect(expireBoosts(op, after)).toBe(true)
    expect(op.activeMultiplier).toBeNull()
  })

  it('hires an autoclicker for a duration', () => {
    const auto = SHOP_ITEMS.find(i => i.kind === 'autoclicker')!
    const op = makeOp({ items: { [auto.id]: 1 } })
    useItem(op, auto.id, 0)
    expect(isAutoclicking(op, 1000)).toBe(true)
    expect(isAutoclicking(op, auto.durationMs! + 1)).toBe(false)
  })

  it('normalizes an older operator missing the new fields', () => {
    const legacy = { id: 'o', name: 'n', homeCityId: 'c', totalUnits: 5 } as unknown as Operator
    const op = normalizeOperator(legacy)
    expect(op.bucks).toBeGreaterThan(0)
    expect(op.items['air-ticket']).toBe(1)
    expect(op.activeMultiplier).toBeNull()
  })
})
