// Happiness (design CORE_LOOP §2–§4) = 50% housing + 50% food.
//   housing score = fraction of the workforce that has a home (capacity / pop)
//   food score    = stored food units vs population (food / pop)
// Click effectiveness scales with happiness (§5), so an unhappy city — homeless
// or starving — builds and produces slowly. That feedback is the only thing
// pulling happiness; food and housing never hard-block a click.
//
// The deeper subsections (energy/employment/fun/luxuries) are PARKED behind
// DEEP_HAPPINESS until the tech tree is checked and balanced. The staged model
// is kept at the bottom so re-enabling it is a one-line flip.
import type { City, SubsectionKey } from '../types'
import { getBuilding } from './catalog'
import { isOperational } from './economy'
import { FOOD_GOODS, FOOD_UNIT_VALUE, ENERGY_GOODS, LUXURY_GOODS, FUN_GOODS } from './civic'

const DEEP_HAPPINESS = false

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }

// --- food as units (CORE_LOOP §3) -------------------------------------------

/** Total food the city holds, in food units: Σ count(good) × per-good value. */
export function foodUnits(city: City): number {
  let n = 0
  for (const g of FOOD_GOODS) n += (city.inventory[g] || 0) * (FOOD_UNIT_VALUE[g] || 0)
  return n
}

/** Drain `units` of food, cheapest good first (FOOD_GOODS is cheapest→dearest);
 *  food floors at 0. A click eats a fraction of a good worth ≥1 unit, so good
 *  counts may go fractional. */
export function drainFood(city: City, units: number): void {
  let need = units
  for (const g of FOOD_GOODS) {
    if (need <= 0) break
    const value = FOOD_UNIT_VALUE[g] || 0
    const have = city.inventory[g] || 0
    if (value <= 0 || have <= 0) continue
    const takeUnits = Math.min(need, have * value)
    city.inventory[g] = have - takeUnits / value
    need -= takeUnits
  }
}

/** One worker eats 1 food unit per click that does work (CORE_LOOP §3). */
export const FOOD_PER_CLICK = 1
export function consumeClickFood(city: City): void {
  drainFood(city, FOOD_PER_CLICK)
}

// --- happiness ---------------------------------------------------------------

function housingScore(city: City): number {
  if (city.population <= 0) return 1
  return clamp01(city.populationCapacity / city.population)
}

function foodScore(city: City): number {
  if (city.population <= 0) return 1
  return clamp01(foodUnits(city) / city.population)
}

/** Active per-subsection scores (0..1). 50/50 housing+food today; the full
 *  staged set when DEEP_HAPPINESS is on. */
export function sectionScores(city: City): Partial<Record<SubsectionKey, number>> {
  if (DEEP_HAPPINESS) return deepSectionScores(city)
  return { housing: housingScore(city), food: foodScore(city) }
}

/** Overall happiness 0..100. */
export function computeHappiness(city: City): number {
  if (DEEP_HAPPINESS) return deepComputeHappiness(city)
  return Math.round(100 * (0.5 * housingScore(city) + 0.5 * foodScore(city)))
}

/** Recompute and store happiness + the active per-section breakdown. */
export function refreshHappiness(city: City): void {
  const scores = sectionScores(city)
  const breakdown: Partial<Record<SubsectionKey, number>> = {}
  for (const k of Object.keys(scores) as SubsectionKey[]) {
    breakdown[k] = Math.round((scores[k] ?? 0) * 100)
  }
  city.happinessBySection = breakdown
  city.happiness = computeHappiness(city)
}

/** Units a single base click is worth, on happiness thresholds: 10 at 90-100%,
 *  9 at 80-90%, … down to 1 (design CORE_LOOP §5). */
export function clickEffectiveness(happiness: number): number {
  return Math.max(1, Math.min(10, Math.floor(happiness / 10) + 1))
}

// --- DORMANT: staged multi-section happiness --------------------------------
// Re-enabled by flipping DEEP_HAPPINESS once the tech tree is balanced. Energy/
// employment/fun/luxuries switch on at population triggers (docs/CORE_LOOP.md §4).

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

function deepSectionScores(city: City): Record<SubsectionKey, number> {
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

function deepComputeHappiness(city: City): number {
  const scores = deepSectionScores(city)
  const weights = activeWeights(city.population)
  let total = 0
  for (const [k, w] of Object.entries(weights) as [SubsectionKey, number][]) {
    total += w * scores[k]
  }
  return Math.round(total * 100)
}
