import { describe, it, expect } from 'vitest'
import { allBuildings, getBuilding, resourceInfo, buildCost, allResources } from './catalog'
import { getCountryResources } from './civic'

describe('catalog', () => {
  it('loads buildings parsed from the CSV', () => {
    expect(allBuildings().length).toBeGreaterThan(50)
    const crop = getBuilding('crop-farm')
    expect(crop?.name).toBe('Crop Farm')
    expect(crop?.outputs).toHaveProperty('Grain')
    expect(crop?.needsWorkers).toBe(true)
  })

  it('prices every resource with a buy > sell spread', () => {
    for (const [r, info] of Object.entries(allResources())) {
      expect(info.buy, r).toBeGreaterThanOrEqual(info.sell)
    }
    expect(resourceInfo('Grain').buy).toBeGreaterThan(0)
  })

  it('build cost rises with tier', () => {
    const t1 = allBuildings().find(b => b.tier === 1 && !b.isResidential)!
    const t6 = allBuildings().find(b => b.tier === 6)!
    expect(buildCost(t6)).toBeGreaterThan(buildCost(t1))
  })

  it('falls back to default resources for unknown countries', () => {
    const r = getCountryResources('Nowhereland')
    expect(r.length).toBe(3)
  })
})
