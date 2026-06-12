// Unified building catalog + economy formulas over the generated data.
import { BUILDINGS, BRANCHES, RESOURCES } from './catalog.data'
import type { BuildingDef, ResourceInfo } from './catalog.data'
import { RESIDENTIAL } from './civic'

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
}

const productionMetas: BuildingMeta[] = BUILDINGS.map((b: BuildingDef) => ({
  ...b,
  isResidential: false,
  capacityPerLevel: 0,
}))

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

export function formatRecipe(def: BuildingMeta): string {
  if (def.isResidential) return `+${def.capacityPerLevel} capacity`
  const ins = Object.keys(def.inputs)
  const outs = Object.keys(def.outputs)
  const left = [...(def.needsWorkers ? ['Workers'] : []), ...ins].join(' + ') || '—'
  return `${left} → ${outs.join(' + ')}`
}
