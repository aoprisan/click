// Canonical domain model for the city-building economy. Shared by the mock
// client (today) and any future live backend behind the same GameClient seam.

export type Resource = string
export type Inventory = Record<Resource, number>

export type SubsectionKey = 'housing' | 'food' | 'energy' | 'employment' | 'fun' | 'luxuries'

/** One building instance in a city. A city holds at most one per def; `level`
 *  stands in for repeated builds (residential capacity, production output). */
export interface CityBuilding {
  defId: string
  /** 0 while the first build is still under construction; ≥1 once operational. */
  level: number
  /** activity units of construction work left; >0 means not yet operational/upgrading. */
  constructionRemaining: number
  /** units banked toward the next production batch. */
  workAccumulated: number
}

/** A player-priced sell offer of one of a city's goods (design §5). */
export interface TradeOffer {
  id: string
  cityId: string
  cityName: string
  resource: Resource
  qty: number
  /** price per unit, clamped into the global sell/buy spread. */
  price: number
}

export interface City {
  id: string
  name: string
  country: string
  countryCode: string
  lat: number
  lng: number
  isBot: boolean
  population: number
  populationCapacity: number
  peakPopulation: number
  cash: number
  /** 0..100 weighted happiness across active subsections. */
  happiness: number
  happinessBySection: Partial<Record<SubsectionKey, number>>
  inventory: Inventory
  buildings: CityBuilding[]
  offers: TradeOffer[]
  /** the 3 raw goods this city can produce from scratch (design §4). */
  countryResources: Resource[]
}

/** A time-boxed click multiplier from an energy drink (design §8). */
export interface ActiveBoost {
  factor: number
  /** epoch ms when the boost lapses. */
  expiresAt: number
}

export interface Operator {
  id: string
  name: string
  homeCityId: string
  /** lifetime activity units the player has contributed. */
  totalUnits: number
  /** hard currency for the shop (design §8). Bought with real money — here a
   *  prototype balance, no payments. */
  bucks: number
  /** owned shop items: item id → count (energy drinks, autoclickers, air tickets). */
  items: Record<string, number>
  /** the energy drink currently in effect, if any. */
  activeMultiplier: ActiveBoost | null
  /** epoch ms the active autoclicker runs until, if any. */
  autoclickerUntil: number | null
}

export interface WorldStats {
  cityCount: number
  worldPopulation: number
  topCityName: string
  topCityPop: number
  totalOffers: number
}

// --- realtime events ---
export interface ThrottleState {
  /** clicks remaining in the current window. */
  remaining: number
  capacity: number
  /** true when the last click was dropped by the cap. */
  blocked: boolean
}

export interface TradeEvent {
  cityId: string
  cityName: string
  counterpartyName?: string
  resource: Resource
  qty: number
  kind: 'market_sell' | 'market_buy' | 'offer_buy'
}

export interface BuildingBuiltEvent {
  cityId: string
  cityName: string
  buildingName: string
}

export interface NoticeEvent {
  text: string
  tone: 'info' | 'good' | 'warn'
}

export type GameEvent =
  | { type: 'city_update'; data: City }
  | { type: 'operator_update'; data: Operator }
  | { type: 'trade'; data: TradeEvent }
  | { type: 'building_built'; data: BuildingBuiltEvent }
  | { type: 'throttle'; data: ThrottleState }
  | { type: 'notice'; data: NoticeEvent }
