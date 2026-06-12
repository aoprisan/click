// The entire game, in the browser. Holds every city, runs a tick loop that
// simulates rival cities as bots, and serves the GameClient interface the UI
// talks to. No server. Persisted to localStorage; deterministic seeding means a
// reload restores the same world. A LiveGameClient can replace this later.
import type { GameClient, ConnectionState } from './GameClient'
import { EventBus } from './GameClient'
import type { City, Operator, WorldStats, GameEvent, CityBuilding } from '../types'
import { SEED_CITIES } from '../game/seedCities'
import { getCountryResources } from '../game/civic'
import { getBuilding } from '../game/catalog'
import {
  applyUnits, startBuild as ecoStartBuild, startUpgrade as ecoStartUpgrade,
} from '../game/economy'
import { refreshHappiness, clickEffectiveness, consumeNeeds } from '../game/happiness'
import { growPopulation } from '../game/population'
import { stepBot, seedStartingInventory } from '../game/bots'
import {
  marketBuy, marketSell, postOffer, cancelOffer, takeOffer, addInv, giftResource,
} from '../game/market'
import { RateMeter } from '../game/throttle'
import {
  buyItem as shopBuy, useItem as shopUse, currentMultiplier, isAutoclicking,
  expireBoosts, normalizeOperator, getShopItem, STARTING_BUCKS, TOP_ITEM_ID,
} from '../game/shop'

const SAVE_KEY = 'gc.save.v1'
const TICK_MS = 1500
const SAVE_DEBOUNCE_MS = 600

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function building(defId: string, level: number): CityBuilding {
  return { defId, level, constructionRemaining: 0, workAccumulated: 0 }
}

interface SaveState {
  cities: City[]
  operator: Operator | null
  savedAt: number
}

export class MockGameClient implements GameClient {
  private bus = new EventBus()
  private cities = new Map<string, City>()
  private operator: Operator | null = null
  private meter = new RateMeter()
  private timer: ReturnType<typeof setInterval> | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  /** the building the player's clicks (and the autoclicker) currently target. */
  private activeBuildingId = 'crop-farm'

  constructor() {
    const loaded = this.load()
    if (loaded) {
      for (const c of loaded.cities) this.cities.set(c.id, c)
      this.operator = loaded.operator ? normalizeOperator(loaded.operator) : null
    } else {
      this.seed()
    }
    this.startTicking()
  }

  // --- seeding ---
  private seed(): void {
    for (const s of SEED_CITIES) {
      const h = hashStr(s.id)
      const countryResources = getCountryResources(s.country)
      const city: City = {
        id: s.id,
        name: s.name,
        country: s.country,
        countryCode: s.countryCode,
        lat: s.lat,
        lng: s.lng,
        isBot: true,
        population: 80 + (h % 320),
        populationCapacity: 0,
        peakPopulation: 0,
        cash: 300 + (h % 700),
        happiness: 50,
        happinessBySection: {},
        inventory: {},
        buildings: [building('housing-block', 1), building('crop-farm', 1)],
        offers: [],
        countryResources,
      }
      // a third building for variety, tied to the city's hash
      const extra = EXTRA_SEED_BUILDINGS[h % EXTRA_SEED_BUILDINGS.length]
      if (getBuilding(extra)) city.buildings.push(building(extra, 1))

      seedStartingInventory(city)
      addInv(city, 'Grain', 60)
      city.peakPopulation = city.population
      growPopulation(city)
      refreshHappiness(city)
      this.cities.set(city.id, city)
    }
  }

  // --- persistence ---
  private load(): SaveState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as SaveState
      if (!parsed.cities || parsed.cities.length === 0) return null
      return parsed
    } catch {
      return null
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      try {
        const state: SaveState = {
          cities: Array.from(this.cities.values()),
          operator: this.operator,
          savedAt: Date.now(),
        }
        localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      } catch { /* quota or disabled storage — ignore */ }
    }, SAVE_DEBOUNCE_MS)
  }

  // --- tick loop ---
  private startTicking(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  private tick(): void {
    const all = Array.from(this.cities.values())
    const ctx = { cities: all, emit: (e: GameEvent) => this.bus.emit(e), rand: Math.random }

    // A random slice of bot cities act this tick (keeps the planet alive).
    const homeId = this.operator?.homeCityId
    const bots = all.filter(c => c.id !== homeId)
    const count = 6 + Math.floor(Math.random() * 6)
    for (let i = 0; i < count; i++) {
      const c = bots[Math.floor(Math.random() * bots.length)]
      if (c) stepBot(c, ctx)
    }

    // The player's city ages too: it eats, grows, and re-scores happiness, even
    // though its production is driven by clicks rather than the bot loop.
    if (homeId) {
      const home = this.cities.get(homeId)
      if (home) {
        this.runAutoclicker(home)
        consumeNeeds(home)
        refreshHappiness(home)
        growPopulation(home)
        refreshHappiness(home)
        this.bus.emit({ type: 'city_update', data: home })
      }
    }

    // Lapse any expired energy drink / autoclicker.
    if (this.operator && expireBoosts(this.operator, Date.now())) {
      this.bus.emit({ type: 'operator_update', data: this.operator })
    }

    this.scheduleSave()
  }

  // --- world reads ---
  async listCities(): Promise<City[]> { return Array.from(this.cities.values()) }
  async getCity(id: string): Promise<City | null> { return this.cities.get(id) ?? null }
  async leaderboard(limit = 10): Promise<City[]> {
    return Array.from(this.cities.values())
      .sort((a, b) => b.population - a.population)
      .slice(0, limit)
  }
  async stats(): Promise<WorldStats> {
    const all = Array.from(this.cities.values())
    let worldPopulation = 0, topPop = 0, topName = '—', totalOffers = 0
    for (const c of all) {
      worldPopulation += c.population
      totalOffers += c.offers.length
      if (c.population > topPop) { topPop = c.population; topName = c.name }
    }
    return { cityCount: all.length, worldPopulation, topCityName: topName, topCityPop: topPop, totalOffers }
  }

  // --- identity ---
  async me(): Promise<Operator | null> { return this.operator }
  async register(name: string, cityId: string): Promise<Operator> {
    const city = this.cities.get(cityId)
    if (!city) throw new Error('unknown city')
    city.isBot = false
    this.operator = {
      id: `op-${hashStr(name + cityId)}`, name, homeCityId: cityId, totalUnits: 0,
      bucks: STARTING_BUCKS, items: { 'air-ticket': 1 }, activeMultiplier: null, autoclickerUntil: null,
    }
    this.bus.emit({ type: 'operator_update', data: this.operator })
    this.bus.emit({ type: 'city_update', data: city })
    this.scheduleSave()
    return this.operator
  }

  private home(): City | null {
    return this.operator ? this.cities.get(this.operator.homeCityId) ?? null : null
  }

  // --- core loop ---
  click(buildingDefId: string): void {
    const city = this.home()
    if (!city || !this.operator) return
    this.activeBuildingId = buildingDefId
    if (!this.meter.tryConsume()) {
      this.bus.emit({ type: 'throttle', data: { remaining: this.meter.remaining(), capacity: this.meter.cap(), blocked: true } })
      return
    }
    const mult = currentMultiplier(this.operator, Date.now())
    const units = clickEffectiveness(city.happiness) * mult // base 1..10 units × drink multiplier
    const res = applyUnits(city, buildingDefId, units)
    this.operator.totalUnits += units
    const def = getBuilding(buildingDefId)
    if (res.completedConstruction) {
      this.bus.emit({ type: 'building_built', data: { cityId: city.id, cityName: city.name, buildingName: def?.name ?? buildingDefId } })
    }
    // Surface what the click produced so the UI can flash live feedback (§7).
    if (res.batches > 0 && def) {
      const b = city.buildings.find(x => x.defId === buildingDefId)
      const [output, perBatch] = Object.entries(def.outputs)[0] ?? []
      if (output) {
        this.bus.emit({ type: 'production', data: { cityId: city.id, buildingDefId, output, qty: perBatch * (b?.level ?? 1) * res.batches } })
      }
    }
    refreshHappiness(city)
    this.bus.emit({ type: 'city_update', data: city })
    this.bus.emit({ type: 'operator_update', data: this.operator })
    this.bus.emit({ type: 'throttle', data: { remaining: this.meter.remaining(), capacity: this.meter.cap(), blocked: false } })
    this.scheduleSave()
  }

  async startBuild(buildingDefId: string): Promise<void> {
    const city = this.home(); if (!city) return
    const def = getBuilding(buildingDefId)
    const r = ecoStartBuild(city, buildingDefId)
    this.notify(r.ok ? { text: `Construction started: ${def?.name ?? buildingDefId}`, tone: 'good' }
                     : { text: r.reason ?? 'cannot build', tone: 'warn' })
    if (r.ok) { this.bus.emit({ type: 'city_update', data: city }); this.scheduleSave() }
  }

  async startUpgrade(buildingDefId: string): Promise<void> {
    const city = this.home(); if (!city) return
    const def = getBuilding(buildingDefId)
    const r = ecoStartUpgrade(city, buildingDefId)
    this.notify(r.ok ? { text: `Upgrading ${def?.name ?? buildingDefId}`, tone: 'good' }
                     : { text: r.reason ?? 'cannot upgrade', tone: 'warn' })
    if (r.ok) { this.bus.emit({ type: 'city_update', data: city }); this.scheduleSave() }
  }

  // --- market ---
  async sellToMarket(resource: string, qty: number): Promise<void> {
    const city = this.home(); if (!city) return
    const sold = marketSell(city, resource, qty)
    if (sold > 0) {
      this.bus.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, resource, qty: sold, kind: 'market_sell' } })
      this.bus.emit({ type: 'city_update', data: city })
      this.scheduleSave()
    }
  }

  async buyFromMarket(resource: string, qty: number): Promise<void> {
    const city = this.home(); if (!city) return
    const bought = marketBuy(city, resource, qty)
    if (bought > 0) {
      this.bus.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, resource, qty: bought, kind: 'market_buy' } })
      this.bus.emit({ type: 'city_update', data: city })
      this.scheduleSave()
    } else {
      this.notify({ text: 'not enough cash', tone: 'warn' })
    }
  }

  async postOffer(resource: string, qty: number, price: number): Promise<void> {
    const city = this.home(); if (!city) return
    const o = postOffer(city, resource, qty, price)
    this.notify(o ? { text: `Listed ${o.qty} ${resource} @ ${o.price}`, tone: 'good' }
                  : { text: 'nothing to list', tone: 'warn' })
    if (o) { this.bus.emit({ type: 'city_update', data: city }); this.scheduleSave() }
  }

  async buyOffer(offerId: string, qty: number): Promise<void> {
    const city = this.home(); if (!city) return
    for (const seller of this.cities.values()) {
      const offer = seller.offers.find(o => o.id === offerId)
      if (!offer) continue
      const bought = takeOffer(city, seller, offer, qty)
      if (bought > 0) {
        this.bus.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, counterpartyName: seller.name, counterpartyId: seller.id, resource: offer.resource, qty: bought, kind: 'offer_buy' } })
        this.bus.emit({ type: 'city_update', data: city })
        this.bus.emit({ type: 'city_update', data: seller })
        this.scheduleSave()
      } else {
        this.notify({ text: 'not enough cash', tone: 'warn' })
      }
      return
    }
  }

  /** Gift goods from the home city to another city — a real player-to-player
   *  transfer (design §8). Against bots today; meaningful once multiplayer lands. */
  async giftResource(toCityId: string, resource: string, qty: number): Promise<void> {
    const city = this.home(); if (!city) return
    const to = this.cities.get(toCityId)
    if (!to || to.id === city.id) { this.notify({ text: 'pick another city to gift', tone: 'warn' }); return }
    const gifted = giftResource(city, to, resource, qty)
    if (gifted > 0) {
      this.bus.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, counterpartyName: to.name, counterpartyId: to.id, resource, qty: gifted, kind: 'gift' } })
      this.bus.emit({ type: 'city_update', data: city })
      this.bus.emit({ type: 'city_update', data: to })
      this.notify({ text: `Gifted ${gifted} ${resource} to ${to.name}`, tone: 'good' })
      this.scheduleSave()
    } else {
      this.notify({ text: 'nothing to gift', tone: 'warn' })
    }
  }

  cancelOffer(offerId: string): void {
    const city = this.home(); if (!city) return
    cancelOffer(city, offerId)
    this.bus.emit({ type: 'city_update', data: city })
    this.scheduleSave()
  }

  // --- shop / monetization (design §8) ---
  /** The employee clicks the active building at the same capped rate as a fast
   *  human — automation buys comfort, not advantage (design §8). */
  private runAutoclicker(home: City): void {
    const op = this.operator
    if (!op || !isAutoclicking(op, Date.now())) return
    const mult = currentMultiplier(op, Date.now())
    let fired = 0
    for (let i = 0; i < 30; i++) {
      if (!this.meter.tryConsume()) break
      const units = clickEffectiveness(home.happiness) * mult
      applyUnits(home, this.activeBuildingId, units)
      op.totalUnits += units
      fired++
    }
    if (fired > 0) {
      this.bus.emit({ type: 'operator_update', data: op })
      this.bus.emit({ type: 'throttle', data: { remaining: this.meter.remaining(), capacity: this.meter.cap(), blocked: false } })
    }
  }

  async buyItem(itemId: string): Promise<void> {
    const op = this.operator; if (!op) return
    const item = getShopItem(itemId)
    const r = shopBuy(op, itemId)
    this.notify(r.ok ? { text: `Bought ${item?.label ?? itemId}`, tone: 'good' } : { text: r.reason ?? 'cannot buy', tone: 'warn' })
    if (r.ok) {
      this.bus.emit({ type: 'operator_update', data: op })
      if (itemId === TOP_ITEM_ID) {
        this.notify({ text: 'Your big buy gifted energy drinks to other cities', tone: 'info' })
      }
      this.scheduleSave()
    }
  }

  async useItem(itemId: string): Promise<void> {
    const op = this.operator; if (!op) return
    const item = getShopItem(itemId)
    const r = shopUse(op, itemId, Date.now())
    this.notify(r.ok ? { text: `Activated ${item?.label ?? itemId}`, tone: 'good' } : { text: r.reason ?? 'cannot use', tone: 'warn' })
    if (r.ok) { this.bus.emit({ type: 'operator_update', data: op }); this.scheduleSave() }
  }

  async moveHomeCity(cityId: string): Promise<void> {
    const op = this.operator; if (!op) return
    if ((op.items['air-ticket'] || 0) <= 0) { this.notify({ text: 'no air ticket — buy one in the shop', tone: 'warn' }); return }
    const dest = this.cities.get(cityId)
    if (!dest || cityId === op.homeCityId) { this.notify({ text: 'pick a different city', tone: 'warn' }); return }
    const old = this.cities.get(op.homeCityId)
    if (old) { old.isBot = true; this.bus.emit({ type: 'city_update', data: old }) }
    dest.isBot = false
    op.homeCityId = cityId
    op.items['air-ticket'] -= 1
    this.activeBuildingId = 'crop-farm'
    this.notify({ text: `Moved home to ${dest.name}`, tone: 'good' })
    this.bus.emit({ type: 'operator_update', data: op })
    this.bus.emit({ type: 'city_update', data: dest })
    this.scheduleSave()
  }

  private notify(data: { text: string; tone: 'info' | 'good' | 'warn' }): void {
    this.bus.emit({ type: 'notice', data })
  }

  // --- realtime ---
  on(handler: (e: GameEvent) => void): () => void { return this.bus.on(handler) }
  connectionState(): ConnectionState { return 'connected' }
}

// Variety pool for the third seeded building (must be low-tier so it's operable).
const EXTRA_SEED_BUILDINGS = [
  'weaving-loom', 'primitive-forge', 'surface-dig-trench', 'potash-pit',
  'cargo-wagon-depot', 'apothecary-lab', 'windmill', 'metal-works-shop',
]
