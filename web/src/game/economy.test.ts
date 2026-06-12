import { describe, it, expect } from 'vitest'
import { startBuild, applyUnits, findBuilding, isOperational, isBuildingUnlocked } from './economy'
import { capacityOf } from './population'
import { constructionUnits, getBuilding, tierUnlockPopulation } from './catalog'
import { makeCity, makeBuilding } from './testUtils'

describe('economy', () => {
  it('starts a building: cash is the gate, units are the work', () => {
    const city = makeCity({ cash: 1000 })
    const r = startBuild(city, 'housing-block')
    expect(r.ok).toBe(true)
    expect(city.cash).toBe(750) // 250 cost
    const b = findBuilding(city, 'housing-block')!
    expect(isOperational(b)).toBe(false)

    const need = constructionUnits(getBuilding('housing-block')!)
    const res = applyUnits(city, 'housing-block', need)
    expect(res.completedConstruction).toBe(true)
    expect(b.level).toBe(1)
    expect(capacityOf(city)).toBe(400)
  })

  it('produces outputs from a batch with no inputs (crop farm)', () => {
    const city = makeCity({ buildings: [makeBuilding('crop-farm', 1)] })
    const res = applyUnits(city, 'crop-farm', 40) // workPerBatch(tier1)=40
    expect(res.batches).toBe(1)
    expect(city.inventory['Grain']).toBe(1)
  })

  it('buys input shortfalls from the market to run a batch', () => {
    const city = makeCity({ cash: 1000, buildings: [makeBuilding('blast-furnace', 1)] })
    const before = city.cash
    const res = applyUnits(city, 'blast-furnace', 60) // tier3 batch
    expect(res.batches).toBe(1)
    expect(city.inventory['Steel Alloys']).toBeGreaterThanOrEqual(1)
    expect(city.cash).toBeLessThan(before) // paid for Iron Ore + Coal
  })

  it('refuses a batch it cannot afford inputs for', () => {
    const city = makeCity({ cash: 0, buildings: [makeBuilding('blast-furnace', 1)] })
    const res = applyUnits(city, 'blast-furnace', 60)
    expect(res.batches).toBe(0)
  })

  it('output scales with building level', () => {
    const city = makeCity({ buildings: [makeBuilding('crop-farm', 3)] })
    applyUnits(city, 'crop-farm', 40)
    expect(city.inventory['Grain']).toBe(3)
  })

  it('stacking another residential block keeps the existing capacity', () => {
    // Regression: queuing a second Housing Block used to set constructionRemaining
    // on the standing block, dropping capacity to 0 and evicting the whole city.
    const city = makeCity({ cash: 1000, buildings: [makeBuilding('housing-block', 2)] })
    expect(capacityOf(city)).toBe(800) // 2 blocks × 400

    const r = startBuild(city, 'housing-block') // stack a third
    expect(r.ok).toBe(true)
    const b = findBuilding(city, 'housing-block')!
    expect(b.constructionRemaining).toBeGreaterThan(0) // new block underway…
    expect(capacityOf(city)).toBe(800) // …but the standing blocks still house people

    applyUnits(city, 'housing-block', constructionUnits(getBuilding('housing-block')!))
    expect(b.level).toBe(3)
    expect(capacityOf(city)).toBe(1200)
  })

  it('gates higher tiers behind population (tech-tier unlocks §10 Q#4)', () => {
    expect(tierUnlockPopulation(2)).toBe(0)
    expect(tierUnlockPopulation(3)).toBe(1_000)
    expect(tierUnlockPopulation(7)).toBe(20_000)

    // A small city can build low tiers but not a tier-3 power station yet.
    const small = makeCity({ cash: 100_000, population: 200, peakPopulation: 200 })
    expect(isBuildingUnlocked(small, getBuilding('crop-farm')!)).toBe(true)
    expect(isBuildingUnlocked(small, getBuilding('coal-power-station')!)).toBe(false)
    const blocked = startBuild(small, 'coal-power-station')
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toContain('unlocks at pop')

    // Once it has peaked past the threshold, the tier opens — and stays open.
    const grown = makeCity({ cash: 100_000, population: 800, peakPopulation: 1_500 })
    expect(isBuildingUnlocked(grown, getBuilding('coal-power-station')!)).toBe(true)
    expect(startBuild(grown, 'coal-power-station').ok).toBe(true)
  })
})
