import type { City, CityBuilding } from '../types'

export function makeBuilding(defId: string, level = 1): CityBuilding {
  return { defId, level, constructionRemaining: 0, workAccumulated: 0 }
}

export function makeCity(over: Partial<City> = {}): City {
  return {
    id: 't', name: 'Test', country: 'X', countryCode: 'XX', lat: 0, lng: 0,
    isBot: false, population: 100, populationCapacity: 400, peakPopulation: 100,
    cash: 1000, happiness: 50, happinessBySection: {},
    inventory: {}, buildings: [], offers: [], countryResources: ['Grain'],
    ...over,
  }
}
