// Turns the two design CSVs into the catalog the game runs on. This used to be
// a build-time node script (scripts/gen-catalog.mjs) that emitted a generated
// catalog.data.ts; it now runs in the browser so the CSVs can be swapped live
// from the Config panel without a rebuild (see game/config.ts).
//
// - gamer_supply_chain_tech_tree.csv → buildings (branch, tier, name, recipe)
// - world_countries_game_resources.csv → country → 3 raw resources
// - the union of every referenced resource → the resource price registry
//
// Every recipe comes out of the CSV as 1-in / 1-out; real per-batch quantities
// are the recipe-amounts overlay (game/tuning.ts), merged in catalog.ts.
//
// Production is gated on the city's own stock (economy.ts): a building STALLS on
// a missing input rather than auto-buying it, so a dangling input is a real
// supply-chain constraint, not a freebie — hence the dangling-input warning.
import { parseCSV } from './csv'

export interface BuildingDef {
  id: string
  branch: string
  tier: number
  name: string
  inputs: Record<string, number>
  outputs: Record<string, number>
  needsWorkers: boolean
}

export interface ResourceInfo {
  /** lowest tier of a building that produces it; 0 = raw/unproduced */
  depth: number
  /** price to buy ONE unit from the global market */
  buy: number
  /** price the global market pays for ONE unit */
  sell: number
}

export interface CatalogData {
  branches: string[]
  buildings: BuildingDef[]
  countryResources: Record<string, string[]>
  resources: Record<string, ResourceInfo>
}

/** Price-curve inputs (from the tuning knobs) — a resource's price climbs with
 *  how deep in the tech tree it is first produced. */
export interface PricingKnobs {
  priceBase: number
  priceGrowth: number
  /** what the market pays as a fraction of its asking price (the spread). */
  marketSpread: number
}

export interface BuiltCatalog {
  data: CatalogData
  /** non-fatal problems worth showing whoever uploaded the CSV. */
  warnings: string[]
}

// Near-duplicate / generic resource names collapsed to one canonical good, so
// the same good isn't priced twice under two spellings.
export const ALIASES: Record<string, string> = {
  'Gas': 'Natural Gas',
  'Energy': 'Grid Energy',
  'Rare Earths': 'Rare Earth Elements',
  'Plastic': 'Raw Industrial Plastics',
  'Basic Circuits': 'Logic Circuits',
  'Vacuum Tube Workshop': 'Basic Analog Processors',
  'Surface Ore': 'Surface Ore & Coal',
  'Timber Planks': 'Timber',
  'High-Pressure Fields': 'High-Pressure Oil & Gas Fields',
  'Livestock/Plants': 'Livestock',
  'Mega-Battery Farm': 'Stabilized Battery Bank',
  'Automated Sorting Hub': 'Next-Day Delivery Center',
}

export function canon(name: string): string {
  const n = name.trim()
  return ALIASES[n] || n
}

/** Building id from its name — 'Blast Furnace' → 'blast-furnace'. Ids are what
 *  saves and the recipe overlay key off, so this must stay stable. */
export function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function splitSide(s: string): string[] {
  return s.split('+').map(x => x.trim()).filter(Boolean)
}

/**
 * Build the catalog from raw CSV text.
 * @throws if the tech-tree CSV yields no buildings at all (a broken upload —
 *         the caller keeps the previous config and shows the message).
 */
export function buildCatalog(treeCsv: string, countriesCsv: string, pricing: PricingKnobs): BuiltCatalog {
  const warnings: string[] = []

  // --- tech tree → buildings ---
  const treeRows = parseCSV(treeCsv)
  if (treeRows.length < 2) {
    throw new Error('tech tree CSV is empty — expected a header row plus one row per branch')
  }
  const treeHeader = treeRows[0]
  const buildings: BuildingDef[] = []
  const usedIds = new Set<string>()

  for (const [r, row] of treeRows.slice(1).entries()) {
    const branch = row[0]
    for (let col = 1; col < treeHeader.length; col++) {
      const raw = (row[col] || '').trim()
      if (!raw || raw.startsWith('N/A')) continue
      const m = raw.match(/^(.*?)\s*\((.*?)->(.*)\)\s*$/)
      if (!m) {
        // Loud, not silent: a typo'd cell would otherwise just vanish from the tree.
        warnings.push(`row ${r + 2} "${branch}", tier ${col}: cannot read "${raw}" — expected Name (Input + Input->Output)`)
        continue
      }
      const name = m[1].trim()
      const tier = col // 1..N, one column per tier

      let needsWorkers = false
      const inputs: Record<string, number> = {}
      for (const part of splitSide(m[2])) {
        if (/^workers$/i.test(part)) { needsWorkers = true; continue }
        const res = canon(part)
        inputs[res] = (inputs[res] || 0) + 1
      }
      const outputs: Record<string, number> = {}
      for (const part of splitSide(m[3])) {
        const res = canon(part)
        outputs[res] = (outputs[res] || 0) + 1
      }
      if (Object.keys(outputs).length === 0) {
        warnings.push(`"${name}" (${branch} tier ${tier}) produces nothing — clicks on it will do nothing`)
      }

      let id = slug(name)
      if (usedIds.has(id)) {
        warnings.push(`duplicate building name "${name}" — the second one is id "${id}-x"`)
        while (usedIds.has(id)) id += '-x'
      }
      usedIds.add(id)
      buildings.push({ id, branch, tier, name, inputs, outputs, needsWorkers })
    }
  }
  if (buildings.length === 0) {
    throw new Error('tech tree CSV has no readable buildings — cells must look like: Crop Farm (Workers->Grain)')
  }

  // --- country resources ---
  const countryRows = parseCSV(countriesCsv)
  const countryResources: Record<string, string[]> = {}
  for (const row of countryRows.slice(1)) {
    const [country, r1, r2, r3] = row
    if (!country) continue
    countryResources[country] = [r1, r2, r3].filter(Boolean).map(canon)
  }
  if (Object.keys(countryResources).length === 0) {
    warnings.push('country resources CSV has no rows — every city falls back to the default raw goods')
  }

  // --- resource registry + prices ---
  // depth = lowest tier of a building that PRODUCES the resource (raw goods that
  // nothing produces get depth 0 and the cheapest price). Price climbs with depth.
  const producedAtTier: Record<string, number> = {}
  for (const b of buildings) {
    for (const res of Object.keys(b.outputs)) {
      producedAtTier[res] = producedAtTier[res] === undefined ? b.tier : Math.min(producedAtTier[res], b.tier)
    }
  }
  const allResources = new Set<string>()
  for (const b of buildings) {
    Object.keys(b.inputs).forEach(res => allResources.add(res))
    Object.keys(b.outputs).forEach(res => allResources.add(res))
  }
  for (const list of Object.values(countryResources)) list.forEach(res => allResources.add(res))

  const resources: Record<string, ResourceInfo> = {}
  for (const res of [...allResources].sort()) {
    const depth = producedAtTier[res] ?? 0
    const buy = Math.max(1, Math.round(pricing.priceBase * Math.pow(pricing.priceGrowth, depth)))
    const sell = Math.max(1, Math.round(buy * pricing.marketSpread))
    resources[res] = { depth, buy, sell }
  }

  // An input nothing produces and no country digs up can never be stocked, so
  // every building downstream of it is dead weight.
  const countryRaws = new Set(Object.values(countryResources).flat())
  const dangling = new Set<string>()
  for (const b of buildings) {
    for (const res of Object.keys(b.inputs)) {
      if (producedAtTier[res] === undefined && !countryRaws.has(res)) dangling.add(`${res} (needed by ${b.name})`)
    }
  }
  for (const d of [...dangling].slice(0, 12)) warnings.push(`unobtainable input: ${d}`)
  if (dangling.size > 12) warnings.push(`…and ${dangling.size - 12} more unobtainable inputs`)

  const data: CatalogData = {
    branches: treeRows.slice(1).map(r => r[0]).filter(Boolean),
    buildings,
    countryResources,
    resources,
  }
  return { data, warnings }
}
