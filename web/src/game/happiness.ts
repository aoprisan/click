// Happiness: a weighted score across subsections that switch on as the city
// grows (design §3). Happiness scales click effectiveness on thresholds, which
// is the valve forcing a rounded city rather than one giant factory.
import type { City, SubsectionKey } from '../types'
import { getBuilding } from './catalog'
import { isOperational } from './economy'
import {
  FOOD_GOODS, ENERGY_GOODS, LUXURY_GOODS, FUN_GOODS,
  FOOD_PER_CAPITA, ENERGY_PER_CAPITA,
} from './civic'

// Subsection weights unlock at population triggers. Each stage's weights sum 1.
interface Stage { pop: number; weights: Partial<Record<SubsectionKey, number>> }
export const STAGES: Stage[] = [
  { pop: 0, weights: { housing: 0.5, food: 0.5 } },
  { pop: 1_000, weights: { housing: 0.4, food: 0.4, energy: 0.2 } },
  { pop: 5_000, weights: { housing: 0.3, food: 0.3, energy: 0.2, employment: 0.2 } },
  { pop: 20_000, weights: { housing: 0.25, food: 0.25, energy: 0.2, employment: 0.15, fun: 0.15 } },
  { pop: 50_000, weights: { housing: 0.2, food: 0.2, energy: 0.2, employment: 0.1, fun: 0.15, luxuries: 0.15 } },
]

export function activeWeights(pop: number): Partial<Record<SubsectionKey, number>> {
  let chosen = STAGES[0].weights
  for (const s of STAGES) if (pop >= s.pop) chosen = s.weights
  return chosen
}

const STOCK_PER_CAP = { food: 0.05, energy: 0.04, fun: 0.012, luxuries: 0.02 }

function stockOf(city: City, goods: string[]): number {
  let n = 0
  for (const g of goods) n += city.inventory[g] || 0
  return n
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }

/** Per-subsection score in 0..1. */
export function sectionScores(city: City): Record<SubsectionKey, number> {
  const pop = Math.max(1, city.population)
  const cap = city.populationCapacity

  const housing = cap > 0 ? clamp01(1.2 - city.population / cap) : 0
  const food = clamp01(stockOf(city, FOOD_GOODS) / (pop * STOCK_PER_CAP.food))
  const energy = clamp01(stockOf(city, ENERGY_GOODS) / (pop * STOCK_PER_CAP.energy))

  const jobs = city.buildings.filter(b => {
    const def = getBuilding(b.defId)
    return def && !def.isResidential && isOperational(b)
  }).length
  const jobTarget = Math.max(1, pop / 2_000)
  const employment = clamp01(jobs / jobTarget)

  const fun = clamp01(stockOf(city, FUN_GOODS) / (pop * STOCK_PER_CAP.fun))
  const luxuries = clamp01(stockOf(city, LUXURY_GOODS) / (pop * STOCK_PER_CAP.luxuries))

  return { housing, food, energy, employment, fun, luxuries }
}

/** Overall happiness 0..100 from the active weights. */
export function computeHappiness(city: City): number {
  const scores = sectionScores(city)
  const weights = activeWeights(city.population)
  let total = 0
  for (const [k, w] of Object.entries(weights) as [SubsectionKey, number][]) {
    total += w * scores[k]
  }
  return Math.round(total * 100)
}

/** Recompute and store happiness + the active per-section breakdown. */
export function refreshHappiness(city: City): void {
  const scores = sectionScores(city)
  const weights = activeWeights(city.population)
  const breakdown: Partial<Record<SubsectionKey, number>> = {}
  for (const k of Object.keys(weights) as SubsectionKey[]) {
    breakdown[k] = Math.round(scores[k] * 100)
  }
  city.happinessBySection = breakdown
  city.happiness = computeHappiness(city)
}

/** Units a single base click is worth, on happiness thresholds: 10 at 90-100%,
 *  9 at 80-90%, … down to 1 (design §3). */
export function clickEffectiveness(happiness: number): number {
  return Math.max(1, Math.min(10, Math.floor(happiness / 10) + 1))
}

/** Population eats food and burns energy each tick; drains the cheapest goods
 *  first. Empty larders pull the food/energy scores (and happiness) down. */
export function consumeNeeds(city: City): void {
  drain(city, FOOD_GOODS, city.population * FOOD_PER_CAPITA)
  if (city.population >= 1_000) drain(city, ENERGY_GOODS, city.population * ENERGY_PER_CAPITA)
}

function drain(city: City, goods: string[], amount: number): void {
  let need = amount
  for (const g of goods) {
    if (need <= 0) break
    const have = city.inventory[g] || 0
    const take = Math.min(have, need)
    if (take > 0) {
      city.inventory[g] = have - take
      need -= take
    }
  }
}
