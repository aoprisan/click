// Unified building catalog + economy formulas over the active config.
//
// Everything here is DERIVED from game/config.ts — the tech-tree CSV, the recipe
// amounts overlay and the tuning knobs. A config swap (a designer uploading new
// CSVs) rebuilds these tables in place, so nothing may cache a building list
// across that boundary: read through allBuildings()/getBuilding() at call time.
import { activeConfig, knobs, onConfigChange } from './config'
import type { BuildingDef, ResourceInfo } from './catalogBuild'
import { tierUnlockFor } from './tuning'
import { RESIDENTIAL_DEF } from './civic'

export type { BuildingDef, ResourceInfo }

export interface BuildingMeta {
  id: string
  name: string
  branch: string
  tier: number
  inputs: Record<string, number>
  outputs: Record<string, number>
  needsWorkers: boolean
  isResidential: boolean
  capacityPerLevel: number
  /** workers each completed level employs; this is what makes up population
   *  (design CORE_LOOP §1). Residential = 0 (housing, not jobs). */
  workersPerLevel: number
}

/** Workers a workplace of this tier employs per level. Higher tiers staff more,
 *  so climbing the tech tree grows population. */
function workersForTier(tier: number): number {
  const k = knobs()
  return k.workersBase + tier * k.workersPerTier
}

/** Overlay hand-authored amounts (the recipes CSV) onto a generated 1-in/1-out
 *  side. Only re-weights resources the tech tree already lists; anything
 *  unlisted keeps its generated amount. Returns a fresh object. */
function mergeAmounts(base: Record<string, number>, over?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [r, qty] of Object.entries(base)) out[r] = over?.[r] ?? qty
  return out
}

let residentialMetaCache: BuildingMeta
let allBuildingsCache: BuildingMeta[]
let allBranchesCache: string[]
let byId: Map<string, BuildingMeta>

function rebuild(): void {
  const config = activeConfig()

  residentialMetaCache = {
    ...RESIDENTIAL_DEF,
    tier: 0,
    inputs: {},
    outputs: {},
    needsWorkers: false,
    isResidential: true,
    capacityPerLevel: config.knobs.residentialCapacity,
    workersPerLevel: 0,
  }

  const productionMetas: BuildingMeta[] = config.catalog.buildings.map((b: BuildingDef) => {
    const ov = config.recipes[b.id]
    return {
      ...b,
      inputs: mergeAmounts(b.inputs, ov?.inputs),
      outputs: mergeAmounts(b.outputs, ov?.outputs),
      isResidential: false,
      capacityPerLevel: 0,
      workersPerLevel: workersForTier(b.tier),
    }
  })

  allBuildingsCache = [residentialMetaCache, ...productionMetas]
  allBranchesCache = [RESIDENTIAL_DEF.branch, ...config.catalog.branches]
  byId = new Map(allBuildingsCache.map(b => [b.id, b]))

  const problems = recipeOverrideProblems()
  if (problems.length && typeof console !== 'undefined') {
    console.warn('[recipes] overlay problems:\n  ' + problems.join('\n  '))
  }
}

/** Dev sanity check on the recipe amounts: every override must name a real
 *  building and only re-weight ingredients that building's tech-tree recipe
 *  actually has (you can't invent a new ingredient in the overlay). Surfaced in
 *  the Config panel, console.warned on load, and asserted empty in tests. */
export function recipeOverrideProblems(): string[] {
  const config = activeConfig()
  const problems: string[] = []
  const byGenId = new Map(config.catalog.buildings.map(b => [b.id, b]))
  for (const [id, ov] of Object.entries(config.recipes)) {
    const def = byGenId.get(id)
    if (!def) { problems.push(`unknown building id "${id}"`); continue }
    for (const r of Object.keys(ov.inputs ?? {})) {
      if (!(r in def.inputs)) problems.push(`${id}: input "${r}" is not in its recipe`)
    }
    for (const r of Object.keys(ov.outputs ?? {})) {
      if (!(r in def.outputs)) problems.push(`${id}: output "${r}" is not in its recipe`)
    }
  }
  return problems
}

rebuild()
onConfigChange(rebuild)

/** Every building the current config offers — housing first, then the tree. */
export function allBuildings(): BuildingMeta[] { return allBuildingsCache }
export function allBranches(): string[] { return allBranchesCache }
export function residentialMeta(): BuildingMeta { return residentialMetaCache }

export function getBuilding(id: string): BuildingMeta | undefined {
  return byId.get(id)
}

/** The building a fresh city aims its clicks at: the classic starter farm when
 *  the config has one, else the cheapest thing that produces from nothing. */
export function defaultWorkBuildingId(): string {
  if (byId.has('crop-farm')) return 'crop-farm'
  const producers = allBuildingsCache.filter(b => !b.isResidential && Object.keys(b.outputs).length > 0)
  const raw = producers.filter(b => Object.keys(b.inputs).length === 0)
  const pool = raw.length > 0 ? raw : producers
  return pool.reduce((best, b) => (b.tier < best.tier ? b : best), pool[0])?.id ?? RESIDENTIAL_DEF.id
}

export function allResources(): Record<string, ResourceInfo> {
  return activeConfig().catalog.resources
}

export function resourceInfo(r: string): ResourceInfo {
  return allResources()[r] ?? { depth: 0, buy: knobs().priceBase, sell: Math.max(1, Math.round(knobs().priceBase * knobs().marketSpread)) }
}

// --- economy curves (tier-scaled, all knob-driven) ---

/** cash required to build. */
export function buildCost(def: BuildingMeta): number {
  const k = knobs()
  if (def.isResidential) return k.residentialCost
  return Math.round(k.buildCostBase * Math.pow(k.buildCostGrowth, def.tier - 1))
}

/** activity units of work to finish a construction or an upgrade. Only legacy
 *  saves still drain this — building and upgrading are instant cash buys. */
export function constructionUnits(def: BuildingMeta): number {
  const k = knobs()
  if (def.isResidential) return k.residentialConstructionUnits
  return k.constructionBase + def.tier * k.constructionPerTier
}

/** activity units banked per production batch. */
export function workPerBatch(def: BuildingMeta): number {
  const k = knobs()
  return k.workBatchBase + def.tier * k.workBatchPerTier
}

/** cost to start an upgrade to the next level (scales with current level). */
export function upgradeCost(def: BuildingMeta, level: number): number {
  return Math.round(buildCost(def) * (1 + level * knobs().upgradeCostPerLevel))
}

// --- tech-tier gating (design §10 open Q#4) ---
// Higher tiers unlock as the city grows, so the tree opens over a session rather
// than everything being buildable from tick one. Thresholds are tuning knobs
// (tier_unlock.N) and default to the happiness STAGES: 1k / 5k / 20k / 50k.

/** Lowest peak population at which a building of this tier can be constructed. */
export function tierUnlockPopulation(tier: number): number {
  return tierUnlockFor(tier, knobs())
}

/** "Iron Bricks×2 + Coal" — amounts shown only when >1, so a plain 1-in recipe
 *  stays uncluttered. */
function fmtSide(map: Record<string, number>): string {
  return Object.entries(map).map(([r, q]) => (q > 1 ? `${r}×${q}` : r)).join(' + ')
}

export function formatRecipe(def: BuildingMeta): string {
  if (def.isResidential) return `+${def.capacityPerLevel} housing`
  const recipe = `${fmtSide(def.inputs) || '—'} → ${fmtSide(def.outputs)}`
  // Lead with the population each level employs — building/upgrading a workplace
  // is how population grows (CORE_LOOP §1).
  return `+${def.workersPerLevel} pop · ${recipe}`
}
