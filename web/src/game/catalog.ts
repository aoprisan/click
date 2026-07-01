// Unified building catalog + economy formulas over the generated data.
import { BUILDINGS, BRANCHES, RESOURCES } from './catalog.data'
import type { BuildingDef, ResourceInfo } from './catalog.data'
import { RESIDENTIAL } from './civic'
import { RECIPE_AMOUNTS } from './recipes'

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
 *  so climbing the tech tree grows population. First-draft curve — tunable. */
function workersForTier(tier: number): number {
  return 40 + tier * 10
}

/** Overlay hand-authored amounts (recipes.ts) onto a generated 1-in/1-out side.
 *  Only re-weights resources the CSV already lists; anything unlisted keeps its
 *  generated amount. Returns a fresh object — never mutates catalog.data. */
function mergeAmounts(base: Record<string, number>, over?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [r, qty] of Object.entries(base)) out[r] = over?.[r] ?? qty
  return out
}

const productionMetas: BuildingMeta[] = BUILDINGS.map((b: BuildingDef) => {
  const ov = RECIPE_AMOUNTS[b.id]
  return {
    ...b,
    inputs: mergeAmounts(b.inputs, ov?.inputs),
    outputs: mergeAmounts(b.outputs, ov?.outputs),
    isResidential: false,
    capacityPerLevel: 0,
    workersPerLevel: workersForTier(b.tier),
  }
})

/** Dev sanity check on recipes.ts: every override must name a real building and
 *  only re-weight ingredients that building's CSV recipe actually has (you can't
 *  invent a new ingredient in the overlay). Surfaced as a console.warn below and
 *  asserted empty in recipes.test.ts. */
export function recipeOverrideProblems(): string[] {
  const problems: string[] = []
  const byGenId = new Map(BUILDINGS.map(b => [b.id, b]))
  for (const [id, ov] of Object.entries(RECIPE_AMOUNTS)) {
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

{
  const overlayProblems = recipeOverrideProblems()
  if (overlayProblems.length && typeof console !== 'undefined') {
    console.warn('[recipes] overlay problems:\n  ' + overlayProblems.join('\n  '))
  }
}

export const RESIDENTIAL_META: BuildingMeta = {
  id: RESIDENTIAL.id,
  name: RESIDENTIAL.name,
  branch: RESIDENTIAL.branch,
  tier: 0,
  inputs: {},
  outputs: {},
  needsWorkers: false,
  isResidential: true,
  capacityPerLevel: RESIDENTIAL.capacityPerLevel,
  workersPerLevel: 0,
}

export const ALL_BUILDINGS: BuildingMeta[] = [RESIDENTIAL_META, ...productionMetas]
export const ALL_BRANCHES: string[] = ['Civic', ...BRANCHES]

const byId = new Map<string, BuildingMeta>(ALL_BUILDINGS.map(b => [b.id, b]))
export function getBuilding(id: string): BuildingMeta | undefined {
  return byId.get(id)
}

export function resourceInfo(r: string): ResourceInfo {
  return RESOURCES[r] ?? { depth: 0, buy: 4, sell: 3 }
}

// --- economy curves (tier-scaled) ---

/** cash required to start a building's construction. */
export function buildCost(def: BuildingMeta): number {
  if (def.isResidential) return RESIDENTIAL.cost
  return Math.round(100 * Math.pow(1.5, def.tier - 1))
}

/** activity units of work to finish a construction or an upgrade. */
export function constructionUnits(def: BuildingMeta): number {
  if (def.isResidential) return RESIDENTIAL.constructionUnits
  return 150 + def.tier * 120
}

/** activity units banked per production batch. */
export function workPerBatch(def: BuildingMeta): number {
  return 30 + def.tier * 10
}

/** cost to start an upgrade to the next level (scales with current level). */
export function upgradeCost(def: BuildingMeta, level: number): number {
  return Math.round(buildCost(def) * (1 + level * 0.6))
}

// --- tech-tier gating (design §10 open Q#4) ---
// Higher tiers unlock as the city grows, so the tree opens over a session
// rather than everything being buildable from tick one. Thresholds mirror the
// happiness STAGES (1k / 5k / 20k / 50k) so new tiers arrive roughly when the
// matching happiness subsection switches on and the city needs them.

/** Lowest peak population at which a building of this tier can be constructed. */
export function tierUnlockPopulation(tier: number): number {
  if (tier <= 2) return 0
  if (tier <= 4) return 1_000
  if (tier <= 6) return 5_000
  if (tier <= 8) return 20_000
  return 50_000
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
