// Building, upgrading, and production. Cash instantly builds and upgrades — a
// workplace stands up operational the moment you pay, so population is a spend,
// not a grind. CLICKS drive production only: activity units bank toward the
// active building's next batch, which consumes inputs from the city's own stock
// (no auto-buy) and yields outputs.
import type { City, CityBuilding } from '../types'
import {
  getBuilding, buildCost, upgradeCost, workPerBatch,
  tierUnlockPopulation, type BuildingMeta,
} from './catalog'
import { addInv } from './market'

export function findBuilding(city: City, defId: string): CityBuilding | undefined {
  return city.buildings.find(b => b.defId === defId)
}

export function isOperational(b: CityBuilding): boolean {
  return b.level >= 1 && b.constructionRemaining <= 0
}

/** Whether the city has grown enough to construct this building's tier (§10 Q#4).
 *  Keyed off peak population so an unlock is permanent — a dip never relocks. */
export function isBuildingUnlocked(city: City, def: BuildingMeta): boolean {
  return city.peakPopulation >= tierUnlockPopulation(def.tier)
}

export interface BuildResult { ok: boolean; reason?: string }

/** Buy a building — instant. New production buildings must not already exist;
 *  residential "builds" stack as extra blocks (each is +1 level/capacity). Cash
 *  is the whole gate: pay and the workplace/block is operational immediately. */
export function startBuild(city: City, defId: string): BuildResult {
  const def = getBuilding(defId)
  if (!def) return { ok: false, reason: 'unknown building' }
  const existing = findBuilding(city, defId)
  if (existing && !def.isResidential) {
    return { ok: false, reason: 'already built — upgrade instead' }
  }
  if (!existing && !isBuildingUnlocked(city, def)) {
    return { ok: false, reason: `unlocks at pop ${tierUnlockPopulation(def.tier).toLocaleString()}` }
  }
  const cost = buildCost(def)
  if (city.cash < cost) return { ok: false, reason: 'not enough cash' }
  city.cash -= cost
  if (existing) {
    existing.level += 1 // residential: another block, +1 capacity, right now
  } else {
    city.buildings.push({ defId, level: 1, constructionRemaining: 0, workAccumulated: 0 })
  }
  return { ok: true }
}

/** Upgrade an operational building — instant. +1 level raises the worker amount
 *  (population) and the output per batch immediately. */
export function startUpgrade(city: City, defId: string): BuildResult {
  const def = getBuilding(defId)
  if (!def) return { ok: false, reason: 'unknown building' }
  const b = findBuilding(city, defId)
  if (!b || !isOperational(b)) return { ok: false, reason: 'not operational' }
  const cost = upgradeCost(def, b.level)
  if (city.cash < cost) return { ok: false, reason: 'not enough cash' }
  city.cash -= cost
  b.level += 1
  return { ok: true }
}

/** Inputs the city is short on for one batch of this building (empty ⇒ can run).
 *  This is the supply-chain gate: a building only produces from goods already in
 *  the city — nothing is auto-bought. A missing input must be produced upstream,
 *  bought from the market by hand, or traded for. A building missing an input
 *  can't be worked at all: clicks on it aren't counted (see applyUnits). */
export function batchShortfall(city: City, def: BuildingMeta): string[] {
  const missing: string[] = []
  for (const [r, qty] of Object.entries(def.inputs)) {
    if ((city.inventory[r] || 0) < qty) missing.push(r)
  }
  return missing
}

interface BatchResult { ran: boolean; missing: string[] }

/** Run one production batch iff every input is already in stock (no auto-buy). */
function tryRunBatch(city: City, defId: string): BatchResult {
  const def = getBuilding(defId)!
  if (def.isResidential || Object.keys(def.outputs).length === 0) return { ran: false, missing: [] }
  const b = findBuilding(city, defId)!

  const missing = batchShortfall(city, def)
  if (missing.length > 0) return { ran: false, missing }

  // Consume inputs and emit outputs (scaled by level).
  for (const [r, qty] of Object.entries(def.inputs)) addInv(city, r, -qty)
  for (const [r, qty] of Object.entries(def.outputs)) addInv(city, r, qty * b.level)
  return { ran: true, missing: [] }
}

export interface ApplyResult {
  /** true when a construction just completed this call. */
  completedConstruction: boolean
  /** number of production batches produced this call. */
  batches: number
  /** inputs that stalled production this call (empty when nothing was blocked).
   *  No work is banked while blocked — a stalled building can't be worked — so a
   *  restock never dumps a hoarded burst; production just resumes cleanly. */
  blockedOn: string[]
}

/** Feed a click's activity units into a building. Builds and upgrades are instant
 *  now, so in practice this only runs PRODUCTION; the construction-drain branch
 *  survives solely to finish a build still in flight from a pre-instant save. */
export function applyUnits(city: City, defId: string, units: number): ApplyResult {
  const def = getBuilding(defId)
  const b = findBuilding(city, defId)
  const result: ApplyResult = { completedConstruction: false, batches: 0, blockedOn: [] }
  if (!def || !b || units <= 0) return result

  if (b.constructionRemaining > 0) {
    // legacy: drain any construction left over from an older, click-built save.
    const spent = Math.min(units, b.constructionRemaining)
    b.constructionRemaining -= spent
    units -= spent
    if (b.constructionRemaining <= 0) {
      b.level += 1
      result.completedConstruction = true
    }
    if (units <= 0) return result
  }

  if (!isOperational(b) || def.isResidential) return result

  // Supply-chain gate: a producer missing an input accepts NO work — the click's
  // units are dropped, not banked. This is what stops a stalled building from
  // hoarding clicks and then dumping a burst of output the moment an input lands.
  const short = batchShortfall(city, def)
  if (short.length > 0) {
    result.blockedOn = short
    return result
  }

  const batch = workPerBatch(def)
  b.workAccumulated += units
  while (b.workAccumulated >= batch) {
    const { ran, missing } = tryRunBatch(city, defId)
    if (!ran) {
      // Inputs ran out partway through a mega-click's units (only reachable with a
      // drink multiplier). Drop the unspendable remainder — keep at most a partial
      // batch — so we never bank a reservoir past what actually ran.
      result.blockedOn = missing
      b.workAccumulated = b.workAccumulated % batch
      break
    }
    b.workAccumulated -= batch
    result.batches += 1
  }
  return result
}
