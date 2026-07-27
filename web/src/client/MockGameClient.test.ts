import { describe, it, expect, afterEach } from 'vitest'
import { MockGameClient } from './MockGameClient'
import { isBuildingUnlocked } from '../game/economy'
import { getBuilding } from '../game/catalog'
import { applyConfig, resetConfig } from '../game/config'
import type { GameEvent } from '../types'

const SAVE_KEY = 'gc.save.v1'

const TREE = [
  'Branch,Tier 1,Tier 2',
  'Widgets,Widget Pit (Workers->Widget),Widget Press (Widget + Workers->Pressed Widget)',
].join('\n')

afterEach(() => {
  localStorage.removeItem(SAVE_KEY)
  resetConfig()
})

describe('MockGameClient save migration', () => {
  it('boots from a pre-core-loop save (no peakPopulation) with unlocks working', async () => {
    // A city as an older build persisted it: no peakPopulation (tier unlocks
    // compare against it — `pop > undefined` never promotes it, so without
    // backfill the whole tech tree stays locked), no happinessBySection, and a
    // click-built construction still in flight.
    const legacyCity = {
      id: 'x', name: 'X', country: 'France', countryCode: 'FR', lat: 0, lng: 0,
      isBot: false, population: 12, populationCapacity: 400,
      cash: 5000, happiness: 50,
      inventory: { Grain: 10 },
      buildings: [
        { defId: 'housing-block', level: 1, constructionRemaining: 0, workAccumulated: 0 },
        { defId: 'crop-farm', level: 0, constructionRemaining: 80, workAccumulated: 0 },
      ],
      offers: [],
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cities: [legacyCity],
      operator: { id: 'op', name: 'P', homeCityId: 'x', totalUnits: 0 },
      savedAt: 0,
    }))

    const client = new MockGameClient()
    const city = (await client.getCity('x'))!

    expect(city.peakPopulation).toBeGreaterThan(0) // backfilled + re-derived
    expect(isBuildingUnlocked(city, getBuilding('crop-farm')!)).toBe(true)
    // in-flight construction finished by the instant-build migration
    expect(city.buildings.every(b => b.constructionRemaining === 0 && b.level >= 1)).toBe(true)
    expect(city.happinessBySection).toBeDefined()

    // the operator predates the shop — normalized with a starting balance
    const op = (await client.me())!
    expect(op.bucks).toBeGreaterThan(0)
    expect(op.items).toBeDefined()
  })
})

describe('resetting game data', () => {
  it('throws the world away: cities reseeded, operator and save gone', async () => {
    const client = new MockGameClient()
    const events: GameEvent[] = []
    client.on(e => events.push(e))
    const first = (await client.listCities())[0]
    await client.register('Paul', first.id)
    localStorage.setItem(SAVE_KEY, 'stale')

    await client.resetGame('test reset')

    expect(await client.me()).toBeNull()
    expect(localStorage.getItem(SAVE_KEY)).toBeNull() // the save is debounced, not written yet
    const cities = await client.listCities()
    expect(cities.length).toBeGreaterThan(100)
    expect(cities.every(c => c.isBot)).toBe(true)
    expect(events.some(e => e.type === 'world_reset')).toBe(true)
  })

  it('reseeds against an uploaded config, so no city holds a building that no longer exists', async () => {
    const client = new MockGameClient()
    const events: GameEvent[] = []
    client.on(e => events.push(e))

    applyConfig({ treeCsv: TREE })

    expect(events.some(e => e.type === 'world_reset')).toBe(true)
    const cities = await client.listCities()
    const built = new Set(cities.flatMap(c => c.buildings.map(b => b.defId)))
    expect(built.has('crop-farm')).toBe(false)
    expect(built.has('widget-pit')).toBe(true)
    for (const id of built) expect(getBuilding(id), id).toBeDefined()
  })
})
