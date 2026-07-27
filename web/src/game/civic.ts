// Hand-authored civic layer the supply-chain CSV doesn't cover: residential
// housing (which houses the workforce), the goods that satisfy each happiness
// need, and the country→raw-resource lookup (with name normalization).
import { catalogData, knobs, onConfigChange } from './config'

// --- residential building: housing for the workforce (CORE_LOOP §2) ---
// Residential blocks add housing *capacity*, not population. Population is the
// sum of building worker amounts (CORE_LOOP §1); housing that lags it leaves
// workers homeless, which pulls happiness down. Its cost/capacity numbers are
// tuning knobs (residential.*) — catalog.ts reads them through buildCost() etc.
export const RESIDENTIAL_DEF = {
  id: 'housing-block',
  name: 'Housing Block',
  branch: 'Civic',
} as const

// --- which goods satisfy which happiness subsection (design §3) ---
// A subsection's score = stock of its goods vs the population's demand. Names
// must match resources in the tech tree. Fun & luxuries draw on the deep end of
// the tree on purpose: they only weigh on happiness once a city is large
// (happiness STAGES), so they are the late-game problems a 50k city has to solve.

/** How many "food units" one of each food good is worth (CORE_LOOP §3), from
 *  the tuning CSV. A city's food = Σ count(good) × value(good). */
export function foodValues(): Record<string, number> {
  return knobs().foodValues
}

let foodGoodsCache: string[] = []
function rebuildFoodGoods(): void {
  // Cheapest-first: a click drains the least valuable food good first, so the
  // chain rewards refining raw grain into denser food.
  const values = foodValues()
  foodGoodsCache = Object.keys(values).sort((a, b) => values[a] - values[b])
}
rebuildFoodGoods()
onConfigChange(rebuildFoodGoods)

/** The food goods, cheapest → dearest (that ordering is what drainFood eats in). */
export function foodGoods(): string[] { return foodGoodsCache }

export const ENERGY_GOODS = ['Grid Energy', 'High-Voltage Power', 'Mega Power Grid', 'Renewable Clean Energy', 'Atomic Baseload Energy']
export const LUXURY_GOODS = [
  // Apparel — the original luxury chain…
  'Colored Textiles', 'Modern Clothes', 'Smart Fabric', 'Bio-Sensor Apparel',
  // …plus consumer wellness/pharma, so big cities have more than clothes to chase.
  'Mass Antibiotics', 'Global Pharma Matrix', 'Advanced Medical Biologics',
]
export const FUN_GOODS = [
  // Connectivity & cloud — digital life keeps a metropolis entertained…
  'Global Food Network', 'Localized Internet', 'Global Cloud Platform',
  // …and the compute/AI chain extends the late-game ladder.
  'Enterprise Databases', 'Business Server Networks', 'Neural Network Model',
  '2026 Autonomous AI Copilots',
]

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

const PREFERRED_DEFAULTS = ['Grain', 'Timber', 'Iron Ore']

/** Raw goods for a country the resources CSV doesn't cover. Falls back to raw
 *  (depth 0) goods from the active config when the usual three aren't in it —
 *  an uploaded tech tree needn't have heard of Grain. */
function defaultResources(): string[] {
  const resources = catalogData().resources
  const known = PREFERRED_DEFAULTS.filter(r => r in resources)
  if (known.length > 0) return known
  return Object.keys(resources).filter(r => resources[r].depth === 0).slice(0, 3)
}

export function getCountryResources(country: string): string[] {
  const table = catalogData().countryResources
  const direct = table[country]
  if (direct) return direct
  const aliased = COUNTRY_ALIASES[country] && table[COUNTRY_ALIASES[country]]
  if (aliased) return aliased
  return defaultResources()
}
