// Population is a function of residential capacity, gated by it and nudged by
// happiness (design §3). Build housing → capacity rises → population grows.
import type { City } from '../types'
import { getBuilding } from './catalog'

export function capacityOf(city: City): number {
  let cap = 0
  for (const b of city.buildings) {
    const def = getBuilding(b.defId)
    // Capacity is the *completed* blocks (`level`). A new block stacking on top
    // carries constructionRemaining > 0, but it must NOT evict the residents of
    // the blocks already standing — so count by level, not operational state.
    if (def?.isResidential && b.level >= 1) cap += b.level * def.capacityPerLevel
  }
  return cap
}

/** Advance population one tick toward capacity. Happy cities grow; miserable
 *  ones stagnate or shed people. Returns the new population. */
export function growPopulation(city: City): number {
  const cap = capacityOf(city)
  city.populationCapacity = cap
  const headroom = cap - city.population
  const h = city.happiness / 100
  let next = city.population
  if (headroom > 0) {
    next += Math.max(0, headroom * 0.04 * h)
  }
  // Below ~30% happiness the city starts losing people.
  if (h < 0.3) next -= city.population * (0.3 - h) * 0.04
  next = Math.max(0, Math.min(cap, Math.round(next)))
  city.population = next
  if (next > city.peakPopulation) city.peakPopulation = next
  return next
}
