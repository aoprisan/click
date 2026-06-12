import { describe, it, expect } from 'vitest'
import { stepBot, seedStartingInventory } from './bots'
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
})
