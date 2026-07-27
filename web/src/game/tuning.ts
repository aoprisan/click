// The "numbers for the tech tree" — everything the economy is balanced on that
// isn't the tree's shape. Two spreadsheet-shaped files, both round-trippable from
// the Config panel (download → edit in Excel → upload → play):
//
//   recipes.csv  building_id,kind,resource,amount   per-batch input/output amounts
//   tuning.csv   key,value,note                     the curve + civic knobs
//
// The built-in values live here (and in recipes.ts) and are what the downloads
// are generated from, so the shipped game and an uploaded file are the same data.
import { parseCSV, formatCSV, num } from './csv'
import type { RecipeOverride } from './recipes'

export interface Knobs {
  // --- workforce: what a workplace level employs (population, CORE_LOOP §1) ---
  workersBase: number
  workersPerTier: number
  // --- build economy ---
  buildCostBase: number
  buildCostGrowth: number
  /** upgrade cost = build cost × (1 + level × this). */
  upgradeCostPerLevel: number
  constructionBase: number
  constructionPerTier: number
  /** activity units banked per production batch. */
  workBatchBase: number
  workBatchPerTier: number
  // --- market prices (resource price climbs with tech-tree depth) ---
  priceBase: number
  priceGrowth: number
  /** what the market pays as a fraction of its asking price. */
  marketSpread: number
  // --- civic ---
  residentialCost: number
  residentialConstructionUnits: number
  residentialCapacity: number
  /** food units one worker eats per click that does work (CORE_LOOP §3). */
  foodPerClick: number
  // --- click throttle (design §8) ---
  clickCapacity: number
  clickRefillPerSec: number
  /** food good → food units one of it is worth. Drained cheapest-good-first, so
   *  the values also decide the eating order. Editing this list IS the food list. */
  foodValues: Record<string, number>
  /** tier → peak population needed to construct it. A tier with no entry
   *  inherits the nearest lower tier that has one. */
  tierUnlock: Record<number, number>
}

export const DEFAULT_KNOBS: Knobs = {
  workersBase: 40,
  workersPerTier: 10,
  buildCostBase: 100,
  buildCostGrowth: 1.5,
  upgradeCostPerLevel: 0.6,
  constructionBase: 150,
  constructionPerTier: 120,
  workBatchBase: 30,
  workBatchPerTier: 10,
  priceBase: 4,
  priceGrowth: 1.7,
  marketSpread: 0.7,
  residentialCost: 250,
  residentialConstructionUnits: 200,
  residentialCapacity: 400,
  foodPerClick: 1,
  clickCapacity: 100,
  clickRefillPerSec: 100 / 6,
  foodValues: {
    'Grain': 10,
    'Flour': 30,
    'High-Yield Food': 80,
    'Packaged Rations': 160,
    'Specialty Produce': 300,
  },
  tierUnlock: { 1: 0, 3: 1_000, 5: 5_000, 7: 20_000, 9: 50_000 },
}

/** Peak population a city needs before it can construct this tier. */
export function tierUnlockFor(tier: number, knobs: Knobs): number {
  for (let t = tier; t >= 1; t--) {
    const v = knobs.tierUnlock[t]
    if (v !== undefined) return v
  }
  return 0
}

// --- tuning.csv -------------------------------------------------------------
// One row per knob. `note` is documentation only — it round-trips for the
// designer's benefit and is ignored on the way back in.

type ScalarKey = {
  [K in keyof Knobs]: Knobs[K] extends number ? K : never
}[keyof Knobs]

const SCALARS: Array<[key: string, field: ScalarKey, note: string]> = [
  ['workers.base', 'workersBase', 'workers a tier-0 workplace level employs'],
  ['workers.per_tier', 'workersPerTier', 'extra workers per tier (workers = base + tier x per_tier)'],
  ['build_cost.base', 'buildCostBase', 'cash for a tier-1 building'],
  ['build_cost.growth', 'buildCostGrowth', 'cost multiplier per tier'],
  ['upgrade_cost.per_level', 'upgradeCostPerLevel', 'upgrade = build cost x (1 + level x this)'],
  ['construction.base', 'constructionBase', 'construction units, tier 0 (legacy saves only - building is instant)'],
  ['construction.per_tier', 'constructionPerTier', 'extra construction units per tier'],
  ['work_batch.base', 'workBatchBase', 'activity units per production batch, tier 0'],
  ['work_batch.per_tier', 'workBatchPerTier', 'extra units per batch per tier'],
  ['price.base', 'priceBase', 'market buy price of a raw (depth 0) good'],
  ['price.growth', 'priceGrowth', 'price multiplier per tech-tree depth'],
  ['market.spread', 'marketSpread', 'market sell price = buy price x this'],
  ['residential.cost', 'residentialCost', 'cash for one housing block'],
  ['residential.construction_units', 'residentialConstructionUnits', 'construction units for a block (legacy saves only)'],
  ['residential.capacity', 'residentialCapacity', 'people one housing block houses'],
  ['food.per_click', 'foodPerClick', 'food units eaten per click that does work'],
  ['click.capacity', 'clickCapacity', 'click throttle: burst size'],
  ['click.refill_per_sec', 'clickRefillPerSec', 'click throttle: clicks refilled per second'],
]

const FOOD_PREFIX = 'food_value.'
const TIER_PREFIX = 'tier_unlock.'

export interface ParsedTuning {
  knobs: Knobs
  warnings: string[]
}

/** Read a tuning CSV over the built-in defaults. Anything the file omits keeps
 *  its default — except food values and tier unlocks, where naming even one row
 *  replaces the whole set (that's how you delete a food good or a tier gate). */
export function parseTuningCsv(text: string, base: Knobs = DEFAULT_KNOBS): ParsedTuning {
  const warnings: string[] = []
  const knobs: Knobs = { ...base, foodValues: { ...base.foodValues }, tierUnlock: { ...base.tierUnlock } }
  const byKey = new Map(SCALARS.map(([key, field]) => [key, field]))
  const foods: Record<string, number> = {}
  const tiers: Record<number, number> = {}
  let sawFood = false, sawTier = false

  for (const [i, row] of parseCSV(text).entries()) {
    const key = (row[0] || '').trim()
    if (!key || key.toLowerCase() === 'key') continue // header (or a blank key)
    const rawValue = (row[1] || '').trim()
    const line = i + 1

    if (key.startsWith(FOOD_PREFIX)) {
      const good = key.slice(FOOD_PREFIX.length).trim()
      const value = Number(rawValue)
      if (!good) { warnings.push(`line ${line}: "${key}" names no food good`); continue }
      if (!Number.isFinite(value) || value <= 0) { warnings.push(`line ${line}: food value for "${good}" must be a positive number`); continue }
      foods[good] = value
      sawFood = true
      continue
    }
    if (key.startsWith(TIER_PREFIX)) {
      const tier = Number(key.slice(TIER_PREFIX.length))
      const value = Number(rawValue)
      if (!Number.isInteger(tier) || tier < 1) { warnings.push(`line ${line}: "${key}" is not a tier number`); continue }
      if (!Number.isFinite(value) || value < 0) { warnings.push(`line ${line}: unlock population for tier ${tier} must be a number`); continue }
      tiers[tier] = value
      sawTier = true
      continue
    }

    const field = byKey.get(key)
    if (!field) { warnings.push(`line ${line}: unknown key "${key}" — ignored`); continue }
    const value = Number(rawValue)
    if (!Number.isFinite(value)) { warnings.push(`line ${line}: "${key}" is not a number — kept ${base[field]}`); continue }
    knobs[field] = value
  }

  if (sawFood) knobs.foodValues = foods
  if (sawTier) knobs.tierUnlock = tiers
  if (knobs.clickCapacity < 1) { warnings.push('click.capacity below 1 — clamped to 1'); knobs.clickCapacity = 1 }
  if (knobs.marketSpread > 1) warnings.push('market.spread above 1 means the market pays more than it charges — infinite money')
  if (Object.keys(knobs.foodValues).length === 0) warnings.push('no food values — cities can never eat, so happiness will sit at 50%')

  return { knobs, warnings }
}

export function formatTuningCsv(knobs: Knobs): string {
  const rows: (string | number)[][] = [['key', 'value', 'note']]
  for (const [key, field, note] of SCALARS) rows.push([key, knobs[field], note])
  for (const [good, value] of Object.entries(knobs.foodValues)) {
    rows.push([`${FOOD_PREFIX}${good}`, value, 'food units one of this good is worth (cheapest is eaten first)'])
  }
  for (const [tier, pop] of Object.entries(knobs.tierUnlock)) {
    rows.push([`${TIER_PREFIX}${tier}`, pop, `population needed to build tier ${tier}+`])
  }
  return formatCSV(rows)
}

// --- recipes.csv ------------------------------------------------------------
// The per-batch amounts overlay: the tech-tree CSV only names a building's
// ingredients, this says how many of each. Only ingredients the tree already
// lists can be re-weighted (catalog.ts validates that and warns).

export interface ParsedRecipes {
  recipes: Record<string, RecipeOverride>
  warnings: string[]
}

export function parseRecipesCsv(text: string): ParsedRecipes {
  const warnings: string[] = []
  const recipes: Record<string, RecipeOverride> = {}

  for (const [i, row] of parseCSV(text).entries()) {
    const id = (row[0] || '').trim()
    if (!id || id.toLowerCase() === 'building_id') continue
    const line = i + 1
    const kind = (row[1] || '').trim().toLowerCase()
    const resource = (row[2] || '').trim()
    const amount = num(row[3], NaN)

    if (kind !== 'input' && kind !== 'output') {
      warnings.push(`line ${line}: kind must be "input" or "output", got "${row[1] ?? ''}"`)
      continue
    }
    if (!resource) { warnings.push(`line ${line}: missing resource name`); continue }
    if (!Number.isFinite(amount) || amount <= 0) {
      warnings.push(`line ${line}: ${id} ${kind} "${resource}" needs a positive amount`)
      continue
    }
    const entry = recipes[id] ??= {}
    const side = kind === 'input' ? (entry.inputs ??= {}) : (entry.outputs ??= {})
    side[resource] = amount
  }
  return { recipes, warnings }
}

export function formatRecipesCsv(recipes: Record<string, RecipeOverride>): string {
  const rows: (string | number)[][] = [['building_id', 'kind', 'resource', 'amount']]
  for (const [id, over] of Object.entries(recipes)) {
    for (const [resource, amount] of Object.entries(over.inputs ?? {})) rows.push([id, 'input', resource, amount])
    for (const [resource, amount] of Object.entries(over.outputs ?? {})) rows.push([id, 'output', resource, amount])
  }
  return formatCSV(rows)
}
