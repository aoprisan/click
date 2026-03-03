export interface City {
  id: string
  name: string
  country: string
  countryCode: string
  lat: number
  lng: number
  totalClicks: number
  contributorCount: number
}

export interface CityDetail extends City {
  topContributors: Contributor[]
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
}

export interface CityUpdate {
  cityId: string
  totalClicks: number
  contributorCount: number
}

export interface WSMessage {
  type: string
  data?: CityUpdate
}
