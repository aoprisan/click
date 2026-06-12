// Hand-authored civic layer the supply-chain CSV doesn't cover: residential
// housing (which drives population), the goods that satisfy each happiness
// need, and the country→raw-resource lookup (with name normalization).
import { COUNTRY_RESOURCES } from './catalog.data'

// --- residential building: the engine of population growth (design §3) ---
// Population is a function of residential capacity, NOT player count. Each
// Housing Block built raises the city's capacity; population grows toward it.
export const RESIDENTIAL = {
  id: 'housing-block',
  name: 'Housing Block',
  branch: 'Civic',
  /** cash to start construction */
  cost: 250,
  /** activity units of work to finish construction */
  constructionUnits: 200,
  /** population capacity each completed block adds */
  capacityPerLevel: 400,
} as const

// --- which goods satisfy which happiness subsection (design §3) ---
// A subsection's score = stock of its goods vs the population's demand. Names
// must match keys in the generated RESOURCES registry.
export const FOOD_GOODS = ['Grain', 'Flour', 'High-Yield Food', 'Packaged Rations', 'Specialty Produce']
export const ENERGY_GOODS = ['Grid Energy', 'High-Voltage Power', 'Mega Power Grid', 'Renewable Clean Energy', 'Atomic Baseload Energy']
export const LUXURY_GOODS = ['Colored Textiles', 'Modern Clothes', 'Smart Fabric', 'Bio-Sensor Apparel']
export const FUN_GOODS = ['Global Food Network', 'Localized Internet', 'Global Cloud Platform']

// Per-capita demand, per tick, expressed in units of the cheapest satisfying
// good. Tuned so a clicking player can keep pace with a couple of food/energy
// buildings — raise these to make needs bite harder.
export const FOOD_PER_CAPITA = 0.001
export const ENERGY_PER_CAPITA = 0.0008

// --- country resources ---
// The seed city list and the resources CSV don't always spell countries the
// same way; bridge the gaps and fall back to a sensible default so every city
// can produce something from day one (design §4).
const COUNTRY_ALIASES: Record<string, string> = {
  'The Netherlands': 'Netherlands',
  'United States': 'United States',
  'United Kingdom': 'United Kingdom',
  'Czechia': 'Czech Republic',
  'Hong Kong': 'China',
  'Taiwan': 'China',
  'Turks and Caicos Islands': 'Bahamas',
}

const DEFAULT_RESOURCES = ['Grain', 'Timber', 'Iron Ore']

export function getCountryResources(country: string): string[] {
  const direct = COUNTRY_RESOURCES[country]
  if (direct) return direct
  const aliased = COUNTRY_ALIASES[country] && COUNTRY_RESOURCES[COUNTRY_ALIASES[country]]
  if (aliased) return aliased
  return DEFAULT_RESOURCES
}
