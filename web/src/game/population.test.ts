import { describe, it, expect } from 'vitest'
import { normalizeCity, syncCity } from './population'
import { isBuildingUnlocked } from './economy'
import { getBuilding } from './catalog'
import type { City } from '../types'
import { makeCity, makeBuilding } from './testUtils'

describe('normalizeCity (save migration)', () => {
  it('backfills peakPopulation on a save that predates it, so tier unlocks work', () => {
    const city = makeCity({ buildings: [makeBuilding('crop-farm', 1)] })
    // Simulate a save written before the click-driven core loop: the field
    // simply isn't in the persisted JSON.
    delete (city as Partial<City>).peakPopulation

    // Without normalization the unlock check compares against undefined and
    // locks everything, tier 1 included.
    expect(isBuildingUnlocked(city, getBuilding('crop-farm')!)).toBe(false)

    normalizeCity(city)
    expect(city.peakPopulation).toBeGreaterThan(0) // re-derived from buildings
    expect(isBuildingUnlocked(city, getBuilding('crop-farm')!)).toBe(true)
    expect(isBuildingUnlocked(city, getBuilding('windmill')!)).toBe(true)
  })

  it('backfills other post-save fields and leaves present ones alone', () => {
    const city = makeCity({
      buildings: [makeBuilding('crop-farm', 1)],
      inventory: { Grain: 5 },
      countryResources: ['Cotton'],
    })
    delete (city as Partial<City>).happinessBySection
    delete (city as Partial<City>).offers

    normalizeCity(city)
    expect(city.happinessBySection).toEqual({})
    expect(city.offers).toEqual([])
    expect(city.inventory).toEqual({ Grain: 5 })
    expect(city.countryResources).toEqual(['Cotton'])
  })
})

describe('syncCity', () => {
  it('keeps population monotonic via peakPopulation', () => {
    const city = makeCity({ buildings: [makeBuilding('crop-farm', 2)], peakPopulation: 0 })
    syncCity(city)
    const peak = city.peakPopulation
    expect(peak).toBe(city.population)
    city.buildings = [makeBuilding('crop-farm', 1)]
    syncCity(city)
    expect(city.peakPopulation).toBe(peak) // never dips
  })
})
