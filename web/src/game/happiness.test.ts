import { describe, it, expect } from 'vitest'
import { clickEffectiveness, computeHappiness, refreshHappiness, consumeNeeds, activeWeights } from './happiness'
import { makeCity } from './testUtils'

describe('happiness', () => {
  it('click effectiveness steps down with happiness thresholds', () => {
    expect(clickEffectiveness(100)).toBe(10)
    expect(clickEffectiveness(95)).toBe(10)
    expect(clickEffectiveness(85)).toBe(9)
    expect(clickEffectiveness(50)).toBe(6)
    expect(clickEffectiveness(5)).toBe(1)
    expect(clickEffectiveness(0)).toBe(1)
  })

  it('only housing + food count at low population', () => {
    const w = activeWeights(100)
    expect(Object.keys(w).sort()).toEqual(['food', 'housing'])
  })

  it('energy joins the weighting at 1,000 population', () => {
    expect(activeWeights(1500)).toHaveProperty('energy')
  })

  it('a fed, housed city is happy; a starving one is not', () => {
    const fed = makeCity({ population: 100, populationCapacity: 400, inventory: { Grain: 50 } })
    const starving = makeCity({ population: 100, populationCapacity: 400, inventory: {} })
    expect(computeHappiness(fed)).toBeGreaterThan(80)
    expect(computeHappiness(starving)).toBeLessThan(computeHappiness(fed))
  })

  it('population eats food each tick', () => {
    const city = makeCity({ population: 1000, inventory: { Grain: 10 } })
    consumeNeeds(city)
    expect(city.inventory['Grain']).toBeLessThan(10)
  })

  it('refreshHappiness fills the per-section breakdown', () => {
    const city = makeCity({ inventory: { Grain: 50 } })
    refreshHappiness(city)
    expect(city.happinessBySection).toHaveProperty('housing')
    expect(city.happinessBySection).toHaveProperty('food')
    expect(city.happiness).toBeGreaterThan(0)
  })
})
