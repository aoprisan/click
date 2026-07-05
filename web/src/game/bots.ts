// Rival cities, simulated entirely client-side. Like foom's tick, bots act
// through stochastic rolls + constraints — no AI, no pathfinding — so the world
// feels alive: they produce, grow, build, and trade against the same markets
// the player uses.
import type { City, GameEvent } from '../types'
import { ALL_BUILDINGS, getBuilding, buildCost, upgradeCost, type BuildingMeta } from './catalog'
import { applyUnits, startBuild, startUpgrade, findBuilding, isBuildingUnlocked, isOperational } from './economy'
import { drainFood, refreshHappiness } from './happiness'
import { syncCity, capacityOf } from './population'
import { marketSell, postOffer, takeOffer, addInv } from './market'

export interface BotContext {
  cities: City[]
  emit: (e: GameEvent) => void
  rand: () => number
}

const SURPLUS_RESERVE = 30 // keep this much of any good before selling/offering

export function stepBot(city: City, ctx: BotContext): void {
  // Cash → an instant new workplace/block: population is a spend now, not a grind.
  if (ctx.rand() < 0.18) botConstruct(city, ctx)

  // Clicks drive production only — operate every building a little.
  for (const b of city.buildings) {
    applyUnits(city, b.defId, 20 + Math.floor(ctx.rand() * 40))
  }

  // Workers eat for the work this step did (CORE_LOOP §3): one meal per building
  // operated, mirroring the player's 1-food-per-click. Then re-derive population
  // and re-score happiness.
  drainFood(city, city.buildings.length)
  syncCity(city)
  refreshHappiness(city)

  botTrade(city, ctx)

  ctx.emit({ type: 'city_update', data: city })
}

/** Spend cash on workforce: a new affordable, unlocked workplace when one
 *  exists, otherwise upgrade an operational one (+1 level = more workers).
 *  Shared by the bot brain and the balance harness's simulated player. Returns
 *  the def when a NEW building went up (so callers can toast it); upgrades
 *  return null. The upgrade arm matters structurally: every tier ≤2 workplace
 *  together employs ~830, short of the 1,000 tier-3 unlock — without upgrades
 *  a city can never climb past tier 2. */
export function growWorkforce(city: City, rand: () => number, maxTier = 6): BuildingMeta | null {
  const fresh = ALL_BUILDINGS.filter(def =>
    !def.isResidential &&
    def.tier <= maxTier &&
    isBuildingUnlocked(city, def) &&
    !findBuilding(city, def.id) &&
    city.cash >= buildCost(def),
  )
  if (fresh.length > 0) {
    const pick = fresh[Math.floor(rand() * fresh.length)]
    return startBuild(city, pick.id).ok ? pick : null
  }
  const upgradable = city.buildings.filter(b => {
    const def = getBuilding(b.defId)
    return def && !def.isResidential && isOperational(b) && city.cash >= upgradeCost(def, b.level)
  })
  if (upgradable.length > 0) {
    startUpgrade(city, upgradable[Math.floor(rand() * upgradable.length)].defId)
  }
  return null
}

function botConstruct(city: City, ctx: BotContext): void {
  const cap = capacityOf(city)
  const crowded = cap === 0 || city.population > cap * 0.7
  // Grow housing when crowded; otherwise a new workplace or an upgrade.
  if (crowded && city.cash >= buildCost(getBuilding('housing-block')!)) {
    startBuild(city, 'housing-block') // residential stack — no "built" toast
    return
  }
  const built = growWorkforce(city, ctx.rand)
  if (built) {
    ctx.emit({ type: 'building_built', data: { cityId: city.id, cityName: city.name, buildingName: built.name } })
  }
}

function botTrade(city: City, ctx: BotContext): void {
  // Sell surplus outputs to the global market for cash.
  for (const [r, qty] of Object.entries(city.inventory)) {
    if (qty > SURPLUS_RESERVE * 3) {
      const sold = marketSell(city, r, Math.floor((qty - SURPLUS_RESERVE) * 0.5))
      if (sold > 0 && ctx.rand() < 0.15) {
        ctx.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, resource: r, qty: sold, kind: 'market_sell' } })
      }
    }
  }

  // Occasionally post a city-to-city offer on a surplus good.
  if (ctx.rand() < 0.12) {
    const surplus = Object.entries(city.inventory).filter(([, q]) => q > SURPLUS_RESERVE * 2)
    if (surplus.length > 0 && city.offers.length < 4) {
      const [r, q] = surplus[Math.floor(ctx.rand() * surplus.length)]
      postOffer(city, r, Math.floor(q * 0.3), 0) // price 0 → clamped up to market sell
    }
  }

  // Occasionally buy the cheapest offer of a good this city is short on.
  if (ctx.rand() < 0.12) {
    const wants = neededGoods(city)
    let best: { seller: City; offerIdx: number } | null = null
    let bestPrice = Infinity
    for (const seller of ctx.cities) {
      if (seller.id === city.id) continue
      for (let i = 0; i < seller.offers.length; i++) {
        const o = seller.offers[i]
        if (wants.has(o.resource) && o.price < bestPrice) {
          bestPrice = o.price
          best = { seller, offerIdx: i }
        }
      }
    }
    if (best) {
      const o = best.seller.offers[best.offerIdx]
      const bought = takeOffer(city, best.seller, o, Math.ceil(o.qty * 0.5))
      if (bought > 0) {
        ctx.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, counterpartyName: best.seller.name, counterpartyId: best.seller.id, resource: o.resource, qty: bought, kind: 'offer_buy' } })
        ctx.emit({ type: 'city_update', data: best.seller })
      }
    }
  }
}

function neededGoods(city: City): Set<string> {
  const wants = new Set<string>()
  for (const b of city.buildings) {
    const def = getBuilding(b.defId)
    if (!def) continue
    for (const r of Object.keys(def.inputs)) {
      if ((city.inventory[r] || 0) < 5) wants.add(r)
    }
  }
  return wants
}

// Seed a city's starting goods so it can act on tick one.
export function seedStartingInventory(city: City): void {
  for (const r of city.countryResources) addInv(city, r, 40)
}
