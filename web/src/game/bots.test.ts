import { describe, it, expect } from 'vitest'
import { stepBot, seedStartingInventory, growWorkforce } from './bots'
import { getBuilding } from './catalog'
import type { GameEvent } from '../types'
import { makeCity, makeBuilding } from './testUtils'

describe('bots', () => {
  it('steps a bot city without throwing and emits a city update', () => {
    const city = makeCity({
      buildings: [makeBuilding('housing-block', 1), makeBuilding('crop-farm', 1)],
      countryResources: ['Grain', 'Timber', 'Iron Ore'],
    })
    seedStartingInventory(city)
    const events: GameEvent[] = []
    let seed = 1
    const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }

    for (let i = 0; i < 10; i++) {
      stepBot(city, { cities: [city], emit: e => events.push(e), rand })
    }

    expect(events.some(e => e.type === 'city_update')).toBe(true)
    expect(city.happiness).toBeGreaterThanOrEqual(0)
    expect(city.happiness).toBeLessThanOrEqual(100)
    expect(city.population).toBeGreaterThan(0)
  })

  it('growWorkforce upgrades once every buildable workplace exists (tier ceiling)', () => {
    // All tier ≤2 workplaces together employ <1,000 — the tier-3 unlock — so a
    // city that only ever builds new can never climb. Upgrades must kick in.
    const city = makeCity({
      cash: 1_000_000,
      buildings: [makeBuilding('housing-block', 1), makeBuilding('crop-farm', 1)],
    })
    let seed = 7
    const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }

    for (let i = 0; i < 60; i++) growWorkforce(city, rand)

    const upgraded = city.buildings.some(b => {
      const def = getBuilding(b.defId)
      return def && !def.isResidential && b.level > 1
    })
    expect(upgraded).toBe(true)
  })
})
