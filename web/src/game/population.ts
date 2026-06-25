// Population and housing are both derived from the buildings a city has put up
// (design CORE_LOOP §1–§2). Population is the workforce — the sum of every
// building's worker amount — and housing is the sum of residential capacity.
import type { City } from '../types'
import { getBuilding } from './catalog'

/** Residential capacity — how many people the city can house. */
export function capacityOf(city: City): number {
  let cap = 0
  for (const b of city.buildings) {
    const def = getBuilding(b.defId)
    // Count completed blocks by `level`: a new block stacking on top carries
    // constructionRemaining > 0 but must not evict residents already housed.
    if (def?.isResidential && b.level >= 1) cap += b.level * def.capacityPerLevel
  }
  return cap
}

/** Population = the workforce = Σ worker amounts of every built level. Counted
 *  by `level` (completed work), so an in-progress upgrade doesn't dip the count.
 *  Buildings are never removed, so this only ever rises — population is
 *  monotonic by construction (CORE_LOOP §1). */
export function workersOf(city: City): number {
  let workers = 0
  for (const b of city.buildings) {
    const def = getBuilding(b.defId)
    if (def && b.level >= 1) workers += b.level * def.workersPerLevel
  }
  return workers
}

/** Recompute a city's derived stats from its buildings. Call after anything that
 *  can change buildings (a click that completes construction, a bot build). */
export function syncCity(city: City): number {
  city.populationCapacity = capacityOf(city)
  city.population = workersOf(city)
  if (city.population > city.peakPopulation) city.peakPopulation = city.population
  return city.population
}
