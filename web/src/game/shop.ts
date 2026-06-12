// The monetization MVP (design §8): a hard-currency ("Bucks") shop of inventory
// items — energy drinks (click multipliers), autoclickers ("employees"), and
// air tickets (move home city). Bucks would be bought with real money; in this
// prototype the operator simply starts with a balance. Prices are placeholders
// — the design leaves exact price points open (§11), so tune them here.
import type { Operator } from '../types'

export type ShopKind = 'energy_drink' | 'autoclicker' | 'air_ticket'

export interface ShopItem {
  id: string
  kind: ShopKind
  label: string
  /** price in Bucks. */
  bucks: number
  /** energy drink: click multiplier. */
  factor?: number
  /** energy drink / autoclicker: how long the effect lasts, ms. */
  durationMs?: number
}

export const STOCKPILE_MAX = 20
export const STARTING_BUCKS = 2000

const MIN = 60_000
const HOUR = 60 * MIN

// Energy drinks: a matrix of multiplier × duration (design §8).
const DRINK_FACTORS: Array<{ factor: number; weight: number }> = [
  { factor: 2, weight: 1 },
  { factor: 5, weight: 2 },
  { factor: 10, weight: 4 },
]
const DRINK_DURATIONS: Array<{ tag: string; ms: number; base: number }> = [
  { tag: '1m', ms: 1 * MIN, base: 10 },
  { tag: '5m', ms: 5 * MIN, base: 40 },
  { tag: '15m', ms: 15 * MIN, base: 100 },
  { tag: '8h', ms: 8 * HOUR, base: 1500 },
]

function buildDrinks(): ShopItem[] {
  const items: ShopItem[] = []
  for (const f of DRINK_FACTORS) {
    for (const d of DRINK_DURATIONS) {
      items.push({
        id: `drink-${f.factor}x-${d.tag}`,
        kind: 'energy_drink',
        label: `${f.factor}× · ${d.tag}`,
        bucks: f.weight * d.base,
        factor: f.factor,
        durationMs: d.ms,
      })
    }
  }
  return items
}

const AUTOCLICKERS: ShopItem[] = [
  { id: 'auto-15m', kind: 'autoclicker', label: 'Employee · 15m', bucks: 200, durationMs: 15 * MIN },
  { id: 'auto-1h', kind: 'autoclicker', label: 'Employee · 1h', bucks: 600, durationMs: 1 * HOUR },
  { id: 'auto-8h', kind: 'autoclicker', label: 'Employee · 8h', bucks: 3000, durationMs: 8 * HOUR },
]

const AIR_TICKET: ShopItem = { id: 'air-ticket', kind: 'air_ticket', label: 'Air Ticket', bucks: 800 }

export const SHOP_ITEMS: ShopItem[] = [...buildDrinks(), ...AUTOCLICKERS, AIR_TICKET]

/** The single most expensive item — buying it triggers the gifting flourish. */
export const TOP_ITEM_ID = SHOP_ITEMS.reduce((a, b) => (b.bucks > a.bucks ? b : a)).id

const byId = new Map(SHOP_ITEMS.map(i => [i.id, i]))
export function getShopItem(id: string): ShopItem | undefined { return byId.get(id) }

export interface ShopResult { ok: boolean; reason?: string }

/** Spend Bucks to add an item to the operator's inventory (stockpile-capped). */
export function buyItem(op: Operator, itemId: string): ShopResult {
  const item = getShopItem(itemId)
  if (!item) return { ok: false, reason: 'unknown item' }
  if (op.bucks < item.bucks) return { ok: false, reason: 'not enough Bucks' }
  if ((op.items[itemId] || 0) >= STOCKPILE_MAX) return { ok: false, reason: 'stockpile full' }
  op.bucks -= item.bucks
  op.items[itemId] = (op.items[itemId] || 0) + 1
  return { ok: true }
}

/** Consume an energy drink or autoclicker, activating its effect. Air tickets
 *  are consumed by moveHomeCity, not here. */
export function useItem(op: Operator, itemId: string, now: number): ShopResult {
  const item = getShopItem(itemId)
  if (!item) return { ok: false, reason: 'unknown item' }
  if ((op.items[itemId] || 0) <= 0) return { ok: false, reason: 'none owned' }
  if (item.kind === 'energy_drink') {
    op.activeMultiplier = { factor: item.factor!, expiresAt: now + item.durationMs! }
  } else if (item.kind === 'autoclicker') {
    op.autoclickerUntil = Math.max(op.autoclickerUntil ?? 0, now) + item.durationMs!
  } else {
    return { ok: false, reason: 'use Move City for air tickets' }
  }
  op.items[itemId] -= 1
  return { ok: true }
}

/** The click multiplier in effect right now (1 when no drink is active). */
export function currentMultiplier(op: Operator, now: number): number {
  if (op.activeMultiplier && now < op.activeMultiplier.expiresAt) return op.activeMultiplier.factor
  return 1
}

export function isAutoclicking(op: Operator, now: number): boolean {
  return op.autoclickerUntil != null && now < op.autoclickerUntil
}

/** Clear lapsed boosts. Returns true if anything changed (so callers re-emit). */
export function expireBoosts(op: Operator, now: number): boolean {
  let changed = false
  if (op.activeMultiplier && now >= op.activeMultiplier.expiresAt) { op.activeMultiplier = null; changed = true }
  if (op.autoclickerUntil != null && now >= op.autoclickerUntil) { op.autoclickerUntil = null; changed = true }
  return changed
}

/** Fill in any fields missing from an older persisted operator. */
export function normalizeOperator(op: Operator): Operator {
  return {
    ...op,
    bucks: op.bucks ?? STARTING_BUCKS,
    items: op.items ?? { 'air-ticket': 1 },
    activeMultiplier: op.activeMultiplier ?? null,
    autoclickerUntil: op.autoclickerUntil ?? null,
  }
}
