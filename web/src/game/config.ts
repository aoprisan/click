// The live config store: the single place the game reads its data from, and the
// seam that lets a designer swap that data at runtime.
//
// Four CSVs make up a config. The ones shipped with the build are the files in
// docs/ (bundled as text) plus the hand-authored defaults in recipes.ts/tuning.ts
// serialized back to CSV — so "download current" always gives you exactly what
// the running game is using, and re-uploading it changes nothing.
//
// Applying a config rebuilds the catalog in place and notifies subscribers;
// catalog.ts rebuilds its derived tables and MockGameClient reseeds the world
// (building ids and prices can change, so old cities would be nonsense).
// Whatever differs from the built-ins is persisted to localStorage, so an
// uploaded config survives a reload — and files you never touched keep tracking
// the shipped ones.
import treeCsvBuiltIn from '../../../docs/gamer_supply_chain_tech_tree.csv?raw'
import countriesCsvBuiltIn from '../../../docs/world_countries_game_resources.csv?raw'
import { buildCatalog, type CatalogData } from './catalogBuild'
import { RECIPE_AMOUNTS, type RecipeOverride } from './recipes'
import {
  DEFAULT_KNOBS, formatRecipesCsv, formatTuningCsv, parseRecipesCsv, parseTuningCsv, type Knobs,
} from './tuning'

export type ConfigFileKey = 'treeCsv' | 'countriesCsv' | 'recipesCsv' | 'tuningCsv'

export type ConfigSource = Record<ConfigFileKey, string>

export interface GameConfig {
  source: ConfigSource
  catalog: CatalogData
  recipes: Record<string, RecipeOverride>
  knobs: Knobs
  /** non-fatal problems from the CSVs, for the Config panel to show. */
  warnings: string[]
  /** which files differ from the ones shipped with this build. */
  custom: ConfigFileKey[]
}

/** Panel metadata: what each file is, and what it's called when downloaded. */
export const CONFIG_FILES: Array<{ key: ConfigFileKey; label: string; filename: string; blurb: string }> = [
  {
    key: 'treeCsv',
    label: 'Tech tree',
    filename: 'gamer_supply_chain_tech_tree.csv',
    blurb: 'one row per branch, one column per tier: Name (Input + Input->Output)',
  },
  {
    key: 'recipesCsv',
    label: 'Recipe amounts',
    filename: 'recipes.csv',
    blurb: 'building_id,kind,resource,amount — how many of each ingredient a batch uses',
  },
  {
    key: 'tuningCsv',
    label: 'Tuning numbers',
    filename: 'tuning.csv',
    blurb: 'key,value — costs, worker counts, prices, food values, tier unlocks',
  },
  {
    key: 'countriesCsv',
    label: 'Country resources',
    filename: 'world_countries_game_resources.csv',
    blurb: 'country,resource,resource,resource — the 3 raw goods a country digs up',
  },
]

export const BUILT_IN_SOURCE: ConfigSource = {
  treeCsv: treeCsvBuiltIn,
  countriesCsv: countriesCsvBuiltIn,
  recipesCsv: formatRecipesCsv(RECIPE_AMOUNTS),
  tuningCsv: formatTuningCsv(DEFAULT_KNOBS),
}

const STORAGE_KEY = 'gc.config.v1'

/** Build a full config from CSV text. Missing files fall back to the built-in
 *  ones, so uploading a single file is a valid config.
 *  @throws if the tech tree can't be read at all — the caller keeps the config
 *          it already had and surfaces the message. */
export function buildConfig(patch: Partial<ConfigSource>): GameConfig {
  const source: ConfigSource = { ...BUILT_IN_SOURCE, ...stripBlanks(patch) }

  // Tuning first: the price curve feeds the catalog's resource registry.
  const tuning = parseTuningCsv(source.tuningCsv)
  const catalog = buildCatalog(source.treeCsv, source.countriesCsv, tuning.knobs)
  const recipes = parseRecipesCsv(source.recipesCsv)

  const custom = (Object.keys(source) as ConfigFileKey[]).filter(k => source[k] !== BUILT_IN_SOURCE[k])
  return {
    source,
    catalog: catalog.data,
    recipes: recipes.recipes,
    knobs: tuning.knobs,
    warnings: [...catalog.warnings, ...recipes.warnings, ...tuning.warnings],
    custom,
  }
}

function stripBlanks(patch: Partial<ConfigSource>): Partial<ConfigSource> {
  const out: Partial<ConfigSource> = {}
  for (const [k, v] of Object.entries(patch) as Array<[ConfigFileKey, string | undefined]>) {
    if (typeof v === 'string' && v.trim() !== '') out[k] = v
  }
  return out
}

// --- active config ----------------------------------------------------------

const listeners = new Set<(config: GameConfig) => void>()
let active: GameConfig = bootConfig()

/** Restore a persisted config at startup; a broken one is dropped rather than
 *  bricking the game (it would otherwise fail on every reload with no way back
 *  to the panel). */
function bootConfig(): GameConfig {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ConfigSource>
      const config = buildConfig(stored)
      if (config.custom.length > 0) {
        config.warnings.unshift(`using an uploaded config (${config.custom.length} file(s)) — revert in the Config panel`)
      }
      return config
    }
  } catch (err) {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage disabled */ }
    const config = buildConfig({})
    config.warnings.unshift(`stored config could not be loaded (${message(err)}) — reverted to the built-in one`)
    return config
  }
  return buildConfig({})
}

export function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function activeConfig(): GameConfig { return active }
export function knobs(): Knobs { return active.knobs }
export function catalogData(): CatalogData { return active.catalog }
export function recipeAmounts(): Record<string, RecipeOverride> { return active.recipes }
export function isCustomConfig(): boolean { return active.custom.length > 0 }

/** Subscribe to config swaps. Called after `active` is updated, so a listener
 *  can read the new config straight off `activeConfig()`. */
export function onConfigChange(fn: (config: GameConfig) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Swap in new CSV text. Throws (leaving the running config untouched) if the
 *  tech tree can't be parsed. */
export function applyConfig(patch: Partial<ConfigSource>, opts: { persist?: boolean } = {}): GameConfig {
  const next = buildConfig({ ...active.source, ...patch })
  active = next
  if (opts.persist !== false) persist(next)
  notify(next)
  return next
}

/** Drop every uploaded file and go back to the config shipped with this build. */
export function resetConfig(): GameConfig {
  const next = buildConfig({})
  active = next
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage disabled */ }
  notify(next)
  return next
}

function persist(config: GameConfig): void {
  try {
    if (config.custom.length === 0) { localStorage.removeItem(STORAGE_KEY); return }
    const stored: Partial<ConfigSource> = {}
    for (const key of config.custom) stored[key] = config.source[key]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch { /* quota or disabled storage — the config still applies for this session */ }
}

function notify(config: GameConfig): void {
  for (const fn of listeners) {
    try { fn(config) } catch { /* never let one subscriber break a config swap */ }
  }
}

/** Counts for the Config panel header. */
export function configSummary(config: GameConfig = active) {
  return {
    buildings: config.catalog.buildings.length,
    branches: config.catalog.branches.length,
    tiers: config.catalog.buildings.reduce((max, b) => Math.max(max, b.tier), 0),
    resources: Object.keys(config.catalog.resources).length,
    countries: Object.keys(config.catalog.countryResources).length,
    recipes: Object.keys(config.recipes).length,
  }
}
