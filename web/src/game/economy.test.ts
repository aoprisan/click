import { describe, it, expect } from 'vitest'
import { startBuild, startUpgrade, applyUnits, findBuilding, isOperational, isBuildingUnlocked } from './economy'
import { capacityOf } from './population'
import { getBuilding, tierUnlockPopulation, workPerBatch } from './catalog'
import { addInv } from './market'
import { makeCity, makeBuilding } from './testUtils'

describe('economy', () => {
  it('buys a building instantly — cash is the whole gate, no click-build', () => {
    const city = makeCity({ cash: 1000 })
    const r = startBuild(city, 'housing-block')
    expect(r.ok).toBe(true)
    expect(city.cash).toBe(750) // 250 cost
    const b = findBuilding(city, 'housing-block')!
    expect(isOperational(b)).toBe(true) // operational the moment you pay
    expect(b.level).toBe(1)
    expect(capacityOf(city)).toBe(400)
  })

  it('upgrades a workplace instantly — more output per batch right away', () => {
    const city = makeCity({ cash: 10_000, buildings: [makeBuilding('crop-farm', 1)] })
    const r = startUpgrade(city, 'crop-farm')
    expect(r.ok).toBe(true)
    expect(findBuilding(city, 'crop-farm')!.level).toBe(2)
    applyUnits(city, 'crop-farm', 40) // one tier-1 batch
    expect(city.inventory['Grain']).toBe(2) // output scales with the new level
  })

  it('produces outputs from a batch with no inputs (crop farm)', () => {
    const city = makeCity({ buildings: [makeBuilding('crop-farm', 1)] })
    const res = applyUnits(city, 'crop-farm', 40) // workPerBatch(tier1)=40
    expect(res.batches).toBe(1)
    expect(city.inventory['Grain']).toBe(1)
  })

  it('runs a batch only from goods in stock — no auto-buy from the market', () => {
    // Blast Furnace recipe (overlay): Iron Bricks×2 + Coal -> Steel Alloys.
    const city = makeCity({ cash: 1000, buildings: [makeBuilding('blast-furnace', 1)], inventory: { 'Iron Bricks': 2, 'Coal': 1 } })
    const before = city.cash
    const res = applyUnits(city, 'blast-furnace', 60) // tier3 batch
    expect(res.batches).toBe(1)
    expect(city.inventory['Steel Alloys']).toBe(1)
    expect(city.inventory['Iron Bricks']).toBe(0) // consumed from stock, not bought
    expect(city.inventory['Coal']).toBe(0)
    expect(city.cash).toBe(before) // nothing purchased — cash is untouched
  })

  it('blocks a batch when an input is missing, however much cash it has', () => {
    const city = makeCity({ cash: 1_000_000, buildings: [makeBuilding('blast-furnace', 1)] })
    const res = applyUnits(city, 'blast-furnace', 60)
    expect(res.batches).toBe(0)
    expect(res.blockedOn).toContain('Iron Bricks')
    expect(res.blockedOn).toContain('Coal')
    expect(city.inventory['Steel Alloys']).toBeUndefined()
    expect(city.cash).toBe(1_000_000) // cash no longer papers over a missing input
  })

  it('does not bank work while blocked, so a restock never dumps a burst', () => {
    const city = makeCity({ cash: 0, buildings: [makeBuilding('blast-furnace', 1)] })
    const batch = workPerBatch(getBuilding('blast-furnace')!)
    // Hammer the starved furnace with ten batches' worth of clicks.
    for (let i = 0; i < 10; i++) expect(applyUnits(city, 'blast-furnace', batch).batches).toBe(0)
    const b = findBuilding(city, 'blast-furnace')!
    expect(b.workAccumulated).toBe(0) // clicks weren't counted — nothing hoarded

    // Supply exactly one batch of inputs, then one batch of work → exactly ONE batch.
    addInv(city, 'Iron Bricks', 2)
    addInv(city, 'Coal', 1)
    const res = applyUnits(city, 'blast-furnace', batch)
    expect(res.batches).toBe(1) // not 10 — there's no reservoir to drain
    expect(city.inventory['Steel Alloys']).toBe(1)
  })

  it('caps a mega-click to the inputs on hand — no reservoir past what runs', () => {
    const city = makeCity({ buildings: [makeBuilding('blast-furnace', 1)], inventory: { 'Iron Bricks': 2, 'Coal': 1 } })
    const batch = workPerBatch(getBuilding('blast-furnace')!)
    const res = applyUnits(city, 'blast-furnace', batch * 5) // 5 batches of work, inputs for 1
    expect(res.batches).toBe(1)
    expect(res.blockedOn.length).toBeGreaterThan(0)
    expect(findBuilding(city, 'blast-furnace')!.workAccumulated).toBeLessThan(batch) // remainder dropped
  })

  it('output scales with building level', () => {
    const city = makeCity({ buildings: [makeBuilding('crop-farm', 3)] })
    applyUnits(city, 'crop-farm', 40)
    expect(city.inventory['Grain']).toBe(3)
  })

  it('stacks another residential block instantly, +capacity right away', () => {
    const city = makeCity({ cash: 1000, buildings: [makeBuilding('housing-block', 2)] })
    expect(capacityOf(city)).toBe(800) // 2 blocks × 400

    const r = startBuild(city, 'housing-block') // stack a third — instant
    expect(r.ok).toBe(true)
    const b = findBuilding(city, 'housing-block')!
    expect(b.constructionRemaining).toBe(0)
    expect(b.level).toBe(3)
    expect(capacityOf(city)).toBe(1200) // +400 immediately, no click needed
  })

  it('legacy: finishes an in-flight construction from a pre-instant save', () => {
    // Old saves may hold a building mid-build (level 0, work remaining). The
    // construction-drain branch still completes it when the building is clicked.
    const city = makeCity({ buildings: [{ defId: 'crop-farm', level: 0, constructionRemaining: 50, workAccumulated: 0 }] })
    const res = applyUnits(city, 'crop-farm', 50)
    expect(res.completedConstruction).toBe(true)
    expect(findBuilding(city, 'crop-farm')!.level).toBe(1)
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
