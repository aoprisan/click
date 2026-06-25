import { describe, it, expect } from 'vitest'
import {
  clickEffectiveness, computeHappiness, refreshHappiness, foodUnits,
  drainFood, consumeClickFood,
} from './happiness'
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

  it('happiness = 50% housing + 50% food', () => {
    // Fully housed (cap 400 ≥ pop 100) and well-fed (50 Grain = 500 food ≥ pop).
    const happy = makeCity({ population: 100, populationCapacity: 400, inventory: { Grain: 50 } })
    expect(computeHappiness(happy)).toBe(100)

    // Starving (no food) but housed → only the housing half → ~50%.
    const starving = makeCity({ population: 100, populationCapacity: 400, inventory: {} })
    expect(computeHappiness(starving)).toBe(50)

    // Homeless (pop 800 over cap 400) but fed → only the food half → ~50%.
    const homeless = makeCity({ population: 800, populationCapacity: 400, inventory: { Grain: 200 } })
    expect(computeHappiness(homeless)).toBeLessThan(80)
    expect(computeHappiness(homeless)).toBeGreaterThan(40)
  })

  it('food is measured in units: Σ count × per-good value', () => {
    const city = makeCity({ inventory: { Grain: 3, 'Specialty Produce': 2 } })
    expect(foodUnits(city)).toBe(3 * 10 + 2 * 300) // 630
  })

  it('a click eats one food unit, cheapest good first', () => {
    const city = makeCity({ inventory: { Grain: 1, Flour: 1 } }) // 10 + 30 = 40 units
    consumeClickFood(city)
    expect(foodUnits(city)).toBeCloseTo(39)
    expect(city.inventory['Grain']).toBeCloseTo(0.9) // drained from the cheapest
    expect(city.inventory['Flour']).toBe(1)          // dearer good untouched
  })

  it('drainFood spills into the next-cheapest good when the first runs out', () => {
    const city = makeCity({ inventory: { Grain: 1, Flour: 1 } }) // 10 + 30
    drainFood(city, 15) // eats all 10 of Grain, then 5 from Flour
    expect(city.inventory['Grain']).toBeCloseTo(0)
    expect(foodUnits(city)).toBeCloseTo(25)
  })

  it('refreshHappiness fills the housing + food breakdown', () => {
    const city = makeCity({ inventory: { Grain: 50 } })
    refreshHappiness(city)
    expect(Object.keys(city.happinessBySection).sort()).toEqual(['food', 'housing'])
    expect(city.happiness).toBeGreaterThan(0)
  })
})
