export interface City {
  id: string
  name: string
  country: string
  countryCode: string
  lat: number
  lng: number
  totalClicks: number
  contributorCount: number
  highestEverPopulation: number
  totalDead: number
  missileStockpile: number
}

export interface CityDetail extends City {
  topContributors: Contributor[]
  dailyChangePercent: number
}

export interface Contributor {
  name: string
  totalClicks: number
}

export interface User {
  id: string
  name: string
  cityId: string
  totalClicks: number
  role: string
  totalKills: number
  best10s: number
  best1day: number
  clickMissileClicks: number
  lastCumulativeThreshold: number
  todayClicks?: number
}

export type GameMode = 'spectator' | 'builder' | 'warrior'

export interface GlobalStats {
  worldPopulation: number
  cityCount: number
  highestEverCity: string
  highestEverPop: number
  avgPopulation: number
  dailyChangePercent: number
  worldMissileStockpile: number
}

export interface Missile {
  id: string
  userId: string
  missileType: string
  source: string
  rangeKm: number
  damageLower: number
  damageUpper: number
  fired: boolean
  firedAt?: string
  targetCityId?: string
  damageDealt: number
}

export interface Subscription {
  id: string
  userId: string
  plan: string
  startedAt: string
  expiresAt: string
}

export interface CityUpdate {
  cityId: string
  totalClicks: number
  contributorCount: number
  highestEverPopulation: number
}

export interface CityClick {
  cityId: string
  userName: string
}

export interface MissileStrikeData {
  attackerName: string
  targetCityId: string
  missileType: string
  damage: number
  fromLat: number
  fromLng: number
  toLat: number
  toLng: number
}

export interface AchievementEarnedData {
  achievementName: string
  missileType?: string
}

export interface WSMessage {
  type: string
  data?: CityUpdate | CityClick | MissileStrikeData | AchievementEarnedData
}
