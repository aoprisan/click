// Construction, upgrades, and production — the "clicking is the work, money is
// the gate" loop (design §4). Activity units are fed into a city's buildings;
// money buys input shortfalls from the global market.
import type { City, CityBuilding } from '../types'
import {
  getBuilding, buildCost, upgradeCost, constructionUnits, workPerBatch, resourceInfo,
  tierUnlockPopulation, type BuildingMeta,
} from './catalog'
import { marketBuy, addInv } from './market'

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

/** Start a building. New production buildings must not already exist; residential
 *  "builds" stack as extra blocks (each completes into +1 level/capacity). */
export function startBuild(city: City, defId: string): BuildResult {
  const def = getBuilding(defId)
  if (!def) return { ok: false, reason: 'unknown building' }
  const existing = findBuilding(city, defId)
  if (existing && !def.isResidential) {
    return { ok: false, reason: 'already built — upgrade instead' }
  }
  if (existing && existing.constructionRemaining > 0) {
    return { ok: false, reason: 'construction already in progress' }
  }
  if (!existing && !isBuildingUnlocked(city, def)) {
    return { ok: false, reason: `unlocks at pop ${tierUnlockPopulation(def.tier).toLocaleString()}` }
  }
  const cost = buildCost(def)
  if (city.cash < cost) return { ok: false, reason: 'not enough cash' }
  city.cash -= cost
  if (existing) {
    // residential: queue another block on top of the current level
    existing.constructionRemaining = constructionUnits(def)
  } else {
    city.buildings.push({ defId, level: 0, constructionRemaining: constructionUnits(def), workAccumulated: 0 })
  }
  return { ok: true }
}

/** Begin upgrading an operational building (raises output per batch). */
export function startUpgrade(city: City, defId: string): BuildResult {
  const def = getBuilding(defId)
  if (!def) return { ok: false, reason: 'unknown building' }
  const b = findBuilding(city, defId)
  if (!b || !isOperational(b)) return { ok: false, reason: 'not operational' }
  const cost = upgradeCost(def, b.level)
  if (city.cash < cost) return { ok: false, reason: 'not enough cash' }
  city.cash -= cost
  b.constructionRemaining = constructionUnits(def)
  return { ok: true }
}

/** Run one production batch if the inputs can be sourced (stock + market). */
function tryRunBatch(city: City, defId: string): boolean {
  const def = getBuilding(defId)!
  if (def.isResidential || Object.keys(def.outputs).length === 0) return false
  const b = findBuilding(city, defId)!

  // Price out every input shortfall up front; abort if unaffordable.
  const shortfalls: Array<{ r: string; need: number }> = []
  let shortfallCost = 0
  for (const [r, qty] of Object.entries(def.inputs)) {
    const have = city.inventory[r] || 0
    if (have < qty) {
      const need = qty - have
      shortfalls.push({ r, need })
      shortfallCost += need * resourceInfo(r).buy
    }
  }
  if (city.cash < shortfallCost) return false

  // Acquire shortfalls, then consume inputs and emit outputs (scaled by level).
  for (const s of shortfalls) marketBuy(city, s.r, s.need)
  for (const [r, qty] of Object.entries(def.inputs)) addInv(city, r, -qty)
  for (const [r, qty] of Object.entries(def.outputs)) addInv(city, r, qty * b.level)
  return true
}

export interface ApplyResult {
  /** true when a construction just completed this call. */
  completedConstruction: boolean
  /** number of production batches produced this call. */
  batches: number
}

/** Feed activity units into a building: construction first, then production. */
export function applyUnits(city: City, defId: string, units: number): ApplyResult {
  const def = getBuilding(defId)
  const b = findBuilding(city, defId)
  const result: ApplyResult = { completedConstruction: false, batches: 0 }
  if (!def || !b || units <= 0) return result

  if (b.constructionRemaining > 0) {
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

  const batch = workPerBatch(def)
  b.workAccumulated += units
  while (b.workAccumulated >= batch) {
    if (!tryRunBatch(city, defId)) break
    b.workAccumulated -= batch
    result.batches += 1
  }
  return result
}
