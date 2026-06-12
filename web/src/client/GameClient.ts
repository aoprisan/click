import type { City, Operator, WorldStats, GameEvent } from '../types'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

/**
 * The single seam between the UI and the world. Today only MockGameClient
 * exists (in-browser sim, no server). When a Go backend lands, a LiveGameClient
 * wrapping fetch + WebSocket implements this same interface and the UI does not
 * change. See src/client/index.ts for selection.
 */
export interface GameClient {
  // --- world reads ---
  listCities(): Promise<City[]>
  getCity(id: string): Promise<City | null>
  leaderboard(limit?: number): Promise<City[]>
  stats(): Promise<WorldStats>

  // --- identity ---
  me(): Promise<Operator | null>
  register(name: string, cityId: string): Promise<Operator>

  // --- the core loop ---
  /** Spend one click of activity units on a building in the home city. The
   *  units it's worth scale with multiplier × happiness (design §3). Emits
   *  city_update + throttle; a dropped click (rate cap) emits throttle only. */
  click(buildingDefId: string): void

  /** Pay cash from the home city to start a new building (or housing). */
  startBuild(buildingDefId: string): Promise<void>
  /** Pay cash to begin upgrading an operational building (raises output). */
  startUpgrade(buildingDefId: string): Promise<void>

  // --- market (design §5) ---
  sellToMarket(resource: string, qty: number): Promise<void>
  buyFromMarket(resource: string, qty: number): Promise<void>
  postOffer(resource: string, qty: number, price: number): Promise<void>
  buyOffer(offerId: string, qty: number): Promise<void>
  cancelOffer(offerId: string): void

  // --- shop / monetization (design §8) ---
  /** Buy a shop item with Bucks (energy drink, autoclicker, air ticket). */
  buyItem(itemId: string): Promise<void>
  /** Activate an owned energy drink or autoclicker. */
  useItem(itemId: string): Promise<void>
  /** Spend an air ticket to change the home city. */
  moveHomeCity(cityId: string): Promise<void>

  // --- realtime ---
  on(handler: (e: GameEvent) => void): () => void
  connectionState(): ConnectionState
}

/** Minimal synchronous pub/sub used by the mock client and event hooks. */
export class EventBus {
  private handlers = new Set<(e: GameEvent) => void>()

  on(handler: (e: GameEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(e: GameEvent): void {
    for (const h of this.handlers) {
      try { h(e) } catch { /* never let one listener break the loop */ }
    }
  }
}
