// Rival cities, simulated entirely client-side. Like foom's tick, bots act
// through stochastic rolls + constraints — no AI, no pathfinding — so the world
// feels alive: they produce, grow, build, and trade against the same markets
// the player uses.
import type { City, GameEvent } from '../types'
import { ALL_BUILDINGS, getBuilding, buildCost } from './catalog'
import { applyUnits, startBuild, isOperational, findBuilding, isBuildingUnlocked } from './economy'
import { consumeNeeds, refreshHappiness } from './happiness'
import { growPopulation, capacityOf } from './population'
import { marketSell, postOffer, takeOffer, addInv } from './market'

export interface BotContext {
  cities: City[]
  emit: (e: GameEvent) => void
  rand: () => number
}

const SURPLUS_RESERVE = 30 // keep this much of any good before selling/offering

export function stepBot(city: City, ctx: BotContext): void {
  const operationalBefore = new Set(
    city.buildings.filter(isOperational).map(b => b.defId),
  )

  // Operate every building a little — construction first, then production.
  for (const b of city.buildings) {
    applyUnits(city, b.defId, 20 + Math.floor(ctx.rand() * 40))
  }
  for (const b of city.buildings) {
    if (isOperational(b) && !operationalBefore.has(b.defId)) {
      const def = getBuilding(b.defId)
      ctx.emit({ type: 'building_built', data: { cityId: city.id, cityName: city.name, buildingName: def?.name ?? b.defId } })
    }
  }

  if (ctx.rand() < 0.18) botConstruct(city, ctx)

  consumeNeeds(city)
  refreshHappiness(city)
  growPopulation(city)
  refreshHappiness(city)

  botTrade(city, ctx)

  ctx.emit({ type: 'city_update', data: city })
}

function botConstruct(city: City, ctx: BotContext): void {
  const cap = capacityOf(city)
  const crowded = cap === 0 || city.population > cap * 0.7
  // Grow housing when crowded; otherwise stand up a new affordable factory.
  if (crowded && city.cash >= buildCost(getBuilding('housing-block')!)) {
    startBuild(city, 'housing-block')
    return
  }
  const options = ALL_BUILDINGS.filter(def =>
    !def.isResidential &&
    def.tier <= 6 &&
    isBuildingUnlocked(city, def) &&
    !findBuilding(city, def.id) &&
    city.cash >= buildCost(def),
  )
  if (options.length === 0) return
  const pick = options[Math.floor(ctx.rand() * options.length)]
  startBuild(city, pick.id)
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
        ctx.emit({ type: 'trade', data: { cityId: city.id, cityName: city.name, counterpartyName: best.seller.name, resource: o.resource, qty: bought, kind: 'offer_buy' } })
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
