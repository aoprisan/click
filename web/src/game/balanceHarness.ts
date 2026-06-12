// Headless balance harness (roadmap "Next — gameplay & balance" #1). Runs the
// whole world — ~169 bot cities, optionally a diligent clicking player — for N
// ticks with no DOM, no localStorage, no timers, and a seeded PRNG so a run is
// fully deterministic. It exists to answer one question the prototype's first-
// draft numbers keep raising: do population / cash / happiness settle in sane
// bands, or does the economy wander into starvation or runaway?
//
// The tick logic mirrors MockGameClient.tick + bots.stepBot so the harness
// measures the *same* economy the UI drives, not a parallel toy.
import type { City } from '../types'
import { SEED_CITIES } from './seedCities'
import { getCountryResources, FOOD_GOODS, ENERGY_GOODS } from './civic'
import { getBuilding, buildCost } from './catalog'
import { stepBot, seedStartingInventory } from './bots'
import { applyUnits, startBuild, findBuilding } from './economy'
import { refreshHappiness, clickEffectiveness, consumeNeeds } from './happiness'
import { growPopulation, capacityOf } from './population'
import { marketSell, addInv } from './market'
import { RateMeter } from './throttle'

const TICK_MS = 1500 // must match MockGameClient so the throttle refills at game pace

// --- deterministic PRNG (mulberry32) -----------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// FNV-1a, copied from MockGameClient so seeded cities start identically to a
// fresh in-browser world (same population/cash/buildings).
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const EXTRA_SEED_BUILDINGS = [
  'weaving-loom', 'primitive-forge', 'surface-dig-trench', 'potash-pit',
  'cargo-wagon-depot', 'apothecary-lab', 'windmill', 'metal-works-shop',
]

function newBuilding(defId: string, level: number) {
  return { defId, level, constructionRemaining: 0, workAccumulated: 0 }
}

/** Build one city exactly as MockGameClient.seed() does. */
function seedCity(s: (typeof SEED_CITIES)[number]): City {
  const h = hashStr(s.id)
  const city: City = {
    id: s.id, name: s.name, country: s.country, countryCode: s.countryCode,
    lat: s.lat, lng: s.lng, isBot: true,
    population: 80 + (h % 320),
    populationCapacity: 0, peakPopulation: 0,
    cash: 300 + (h % 700), happiness: 50, happinessBySection: {},
    inventory: {}, buildings: [newBuilding('housing-block', 1), newBuilding('crop-farm', 1)],
    offers: [], countryResources: getCountryResources(s.country),
  }
  const extra = EXTRA_SEED_BUILDINGS[h % EXTRA_SEED_BUILDINGS.length]
  if (getBuilding(extra)) city.buildings.push(newBuilding(extra, 1))
  seedStartingInventory(city)
  addInv(city, 'Grain', 60)
  city.peakPopulation = city.population
  growPopulation(city)
  refreshHappiness(city)
  return city
}

// --- player strategy ---------------------------------------------------------
// A competent-but-not-superhuman clicker: feed the city first, then pour the
// surplus clicks into Housing Blocks, selling food beyond the larder to fund
// them. Once the city crosses pop 1,000 — where the energy happiness section
// switches on — it also stands up a Coal Power Station and keeps it fed, so the
// harness measures a *rounded* player, not one that plateaus for lack of an
// energy path. Clicks are throttle-gated at the real game rate, so this is the
// upper bound of an *engaged* human, not a bot with godlike APM. Feeding before
// building is the key discipline: pouring every click into construction starves
// the city mid-build.

// Stock targets that keep a happiness section near full. Mirror happiness
// STOCK_PER_CAP (food 0.05, energy 0.04); the small headroom leaves a buffer.
const PLAYER_FOOD_TARGET_PER_CAP = 0.055
const PLAYER_ENERGY_TARGET_PER_CAP = 0.045
const ENERGY_BUILDING = 'coal-power-station' // tier 3, unlocks at pop 1,000

function stockOf(city: City, goods: string[]): number {
  let n = 0
  for (const g of goods) n += city.inventory[g] || 0
  return n
}

// Cash to keep in reserve before spending clicks on the power plant. Energy is
// a pure sink (Coal+Water bought in, Grid Energy consumed), so a broke city must
// bank and sell food for income before it can afford to keep the lights on.
const PLAYER_CASH_RESERVE = 300

// Where the next click should go: feed the city first; keep the power on only
// while solvent; then finish construction; otherwise bank food surplus to sell.
function playerTarget(city: City, foodTarget: number, energyTarget: number, hasPower: boolean): string {
  if (stockOf(city, FOOD_GOODS) < foodTarget) return 'crop-farm'
  if (hasPower && city.cash > PLAYER_CASH_RESERVE && stockOf(city, ENERGY_GOODS) < energyTarget) {
    return ENERGY_BUILDING
  }
  const underway = city.buildings.find(b => b.constructionRemaining > 0)
  if (underway) return underway.defId
  return 'crop-farm' // bank surplus → sold below for cash
}

function stepPlayer(city: City, meter: RateMeter): void {
  const cap = capacityOf(city)
  const crowded = cap === 0 || city.population > cap * 0.7
  if (crowded && city.cash >= buildCost(getBuilding('housing-block')!)) {
    startBuild(city, 'housing-block')
  }
  // Past the energy stage, round the city out with a power plant.
  if (city.population >= 1_000 && !findBuilding(city, ENERGY_BUILDING)) {
    startBuild(city, ENERGY_BUILDING) // no-op if unaffordable / locked
  }

  const foodTarget = Math.max(20, city.population * PLAYER_FOOD_TARGET_PER_CAP)
  const energyTarget = city.population >= 1_000 ? city.population * PLAYER_ENERGY_TARGET_PER_CAP : 0
  const hasPower = !!findBuilding(city, ENERGY_BUILDING)
  let clicks = 0
  while (meter.tryConsume() && clicks < 200) {
    const target = playerTarget(city, foodTarget, energyTarget, hasPower)
    applyUnits(city, target, clickEffectiveness(city.happiness)) // mult = 1 (no shop boosts)
    clicks++
  }

  // Sell food above the larder to raise cash for housing + energy inputs.
  const surplus = stockOf(city, FOOD_GOODS) - foodTarget * 1.2
  if (surplus > 40) marketSell(city, 'Grain', Math.floor(surplus * 0.6))

  consumeNeeds(city)
  refreshHappiness(city)
  growPopulation(city)
  refreshHappiness(city)
}

// --- simulation --------------------------------------------------------------
export interface HarnessOptions {
  seed?: number
  /** number of cities to simulate (capped at the seed list length). */
  cityCount?: number
  /** how many ticks to run. */
  ticks?: number
  /** simulate a clicking player on the first city. */
  withPlayer?: boolean
  /** 'all' steps every bot each tick (fast, clean equilibrium signal); 'sample'
   *  mirrors the client's ~6–11 bots/tick cadence (realistic pacing). */
  botActivity?: 'all' | 'sample'
  /** called after each tick — for tracing or collecting custom metrics. */
  onTick?: (tick: number, cities: City[], player: City | null) => void
}

export interface HarnessResult {
  ticks: number
  cities: City[]
  player: City | null
  history: WorldSample[]
}

/** Aggregate world metrics at a point in time — the "bands" we watch. */
export interface WorldSample {
  tick: number
  worldPopulation: number
  population: Band
  cash: Band
  happiness: Band
}

export interface Band { min: number; max: number; mean: number; median: number }

function band(values: number[]): Band {
  if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return { min: sorted[0], max: sorted[sorted.length - 1], mean: sum / sorted.length, median }
}

function sample(tick: number, cities: City[]): WorldSample {
  return {
    tick,
    worldPopulation: cities.reduce((a, c) => a + c.population, 0),
    population: band(cities.map(c => c.population)),
    cash: band(cities.map(c => c.cash)),
    happiness: band(cities.map(c => c.happiness)),
  }
}

export function simulate(opts: HarnessOptions = {}): HarnessResult {
  const seed = opts.seed ?? 1
  const ticks = opts.ticks ?? 60
  const botActivity = opts.botActivity ?? 'all'
  const rand = mulberry32(seed)

  const count = Math.min(opts.cityCount ?? SEED_CITIES.length, SEED_CITIES.length)
  const cities = SEED_CITIES.slice(0, count).map(seedCity)

  let player: City | null = null
  if (opts.withPlayer && cities.length > 0) {
    player = cities[0]
    player.isBot = false
  }

  // Virtual clock so the throttle refills at the real game cadence headlessly.
  let now = 0
  const meter = new RateMeter(undefined, undefined, () => now)

  const history: WorldSample[] = [sample(0, cities)]
  const bots = cities.filter(c => c !== player)

  for (let t = 1; t <= ticks; t++) {
    now += TICK_MS
    const ctx = { cities, emit: () => {}, rand }

    if (botActivity === 'all') {
      for (const c of bots) stepBot(c, ctx)
    } else {
      const n = 6 + Math.floor(rand() * 6)
      for (let i = 0; i < n; i++) {
        const c = bots[Math.floor(rand() * bots.length)]
        if (c) stepBot(c, ctx)
      }
    }

    if (player) stepPlayer(player, meter)

    history.push(sample(t, cities))
    opts.onTick?.(t, cities, player)
  }

  return { ticks, cities, player, history }
}

// --- invariants & reporting --------------------------------------------------
/** Structural invariants that must hold for any city at any time, regardless of
 *  tuning. A violation is a bug, not a balance opinion. */
export function findInvariantViolations(cities: City[]): string[] {
  const problems: string[] = []
  for (const c of cities) {
    const cap = capacityOf(c)
    if (!Number.isFinite(c.population)) problems.push(`${c.id}: population not finite`)
    if (c.population < 0) problems.push(`${c.id}: negative population ${c.population}`)
    if (c.population > cap) problems.push(`${c.id}: population ${c.population} over capacity ${cap}`)
    if (!Number.isFinite(c.cash)) problems.push(`${c.id}: cash not finite`)
    if (c.cash < 0) problems.push(`${c.id}: negative cash ${c.cash}`)
    if (!Number.isFinite(c.happiness)) problems.push(`${c.id}: happiness not finite`)
    if (c.happiness < 0 || c.happiness > 100) problems.push(`${c.id}: happiness out of range ${c.happiness}`)
    for (const [r, q] of Object.entries(c.inventory)) {
      if (!Number.isFinite(q) || q < 0) problems.push(`${c.id}: bad inventory ${r}=${q}`)
    }
  }
  return problems
}

/** A human-readable band report for `npx vitest run balanceHarness` or a future
 *  `npm run balance`. */
export function report(result: HarnessResult): string {
  const first = result.history[0]
  const last = result.history[result.history.length - 1]
  const f = (n: number) => Math.round(n).toLocaleString()
  const line = (label: string, b: Band) =>
    `  ${label.padEnd(10)} min ${f(b.min).padStart(8)}  median ${f(b.median).padStart(8)}  mean ${f(b.mean).padStart(8)}  max ${f(b.max).padStart(8)}`
  const lines = [
    `Balance harness — ${result.cities.length} cities, ${result.ticks} ticks`,
    `World population: ${f(first.worldPopulation)} → ${f(last.worldPopulation)} (${last.worldPopulation >= first.worldPopulation ? '+' : ''}${f(last.worldPopulation - first.worldPopulation)})`,
    'Final bands:',
    line('population', last.population),
    line('cash', last.cash),
    line('happiness', last.happiness),
  ]
  if (result.player) {
    lines.push(
      `Player (${result.player.name}): pop ${f(result.player.population)}, cash ${f(result.player.cash)}, happiness ${result.player.happiness}, cap ${f(capacityOf(result.player))}`,
    )
  }
  return lines.join('\n')
}
