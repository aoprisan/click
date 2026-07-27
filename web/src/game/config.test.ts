import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  BUILT_IN_SOURCE, activeConfig, applyConfig, buildConfig, configSummary, onConfigChange, resetConfig,
} from './config'
import { allBuildings, buildCost, defaultWorkBuildingId, getBuilding, resourceInfo, tierUnlockPopulation } from './catalog'
import { getCountryResources } from './civic'

const TREE = [
  'Branch,Tier 1,Tier 2',
  'Widgets,Widget Pit (Workers->Widget),Widget Press (Widget + Workers->Pressed Widget)',
].join('\n')

const COUNTRIES = ['Country,R1,R2,R3', 'Testland,Widget,Widget,Widget'].join('\n')

afterEach(() => { resetConfig() })

describe('built-in config', () => {
  it('parses the shipped CSVs into the catalog the game runs on', () => {
    const summary = configSummary(activeConfig())
    expect(summary.buildings).toBeGreaterThan(50)
    expect(summary.branches).toBe(10)
    expect(summary.countries).toBeGreaterThan(150)
    expect(getBuilding('crop-farm')?.name).toBe('Crop Farm')
  })

  it('reports itself as unmodified, and re-applying its own files is a no-op', () => {
    expect(activeConfig().custom).toEqual([])
    const next = applyConfig({ treeCsv: BUILT_IN_SOURCE.treeCsv })
    expect(next.custom).toEqual([])
  })

  it('reads every cell of the shipped tree — its only warnings are data gaps', () => {
    // The shipped tech tree does have inputs nothing produces (Water, AI Cores,
    // Microchips…), so those buildings can never run. That's a design-data gap,
    // not a parse failure: assert the parser understood every cell.
    const unreadable = activeConfig().warnings.filter(w => !/^(unobtainable input|…and \d+ more)/.test(w))
    expect(unreadable).toEqual([])
  })
})

describe('applying an uploaded config', () => {
  it('rebuilds the whole catalog from new CSVs', () => {
    applyConfig({ treeCsv: TREE, countriesCsv: COUNTRIES })

    const ids = allBuildings().map(b => b.id)
    expect(ids).toEqual(['housing-block', 'widget-pit', 'widget-press'])
    expect(getBuilding('crop-farm')).toBeUndefined()
    expect(getBuilding('widget-press')?.inputs).toEqual({ Widget: 1 })
    // deeper in the tree ⇒ dearer, straight off the price curve
    expect(resourceInfo('Pressed Widget').buy).toBeGreaterThan(resourceInfo('Widget').buy)
    expect(getCountryResources('Testland')).toEqual(['Widget', 'Widget', 'Widget'])
  })

  it('re-aims the starter building when the old one is gone', () => {
    expect(defaultWorkBuildingId()).toBe('crop-farm')
    applyConfig({ treeCsv: TREE, countriesCsv: COUNTRIES })
    expect(defaultWorkBuildingId()).toBe('widget-pit') // tier 1, needs no inputs
  })

  it('applies tuning numbers to the economy curves', () => {
    applyConfig({
      treeCsv: TREE,
      tuningCsv: ['key,value', 'build_cost.base,500', 'workers.base,7', 'workers.per_tier,0', 'tier_unlock.1,0', 'tier_unlock.2,4200'].join('\n'),
    })
    const pit = getBuilding('widget-pit')!
    expect(buildCost(pit)).toBe(500)
    expect(pit.workersPerLevel).toBe(7)
    expect(tierUnlockPopulation(2)).toBe(4200)
  })

  it('applies recipe amounts to the merged building metas', () => {
    applyConfig({
      treeCsv: TREE,
      recipesCsv: ['building_id,kind,resource,amount', 'widget-press,input,Widget,6'].join('\n'),
    })
    expect(getBuilding('widget-press')!.inputs).toEqual({ Widget: 6 })
  })

  it('keeps the files it was not given', () => {
    const next = applyConfig({ treeCsv: TREE })
    expect(next.custom).toEqual(['treeCsv'])
    expect(next.source.countriesCsv).toBe(BUILT_IN_SOURCE.countriesCsv)
  })

  it('reverts to the built-in config', () => {
    applyConfig({ treeCsv: TREE })
    expect(getBuilding('crop-farm')).toBeUndefined()
    resetConfig()
    expect(getBuilding('crop-farm')?.name).toBe('Crop Farm')
    expect(activeConfig().custom).toEqual([])
  })

  it('notifies subscribers so derived tables can rebuild', () => {
    const seen: number[] = []
    const unsubscribe = onConfigChange(c => seen.push(c.catalog.buildings.length))
    applyConfig({ treeCsv: TREE })
    unsubscribe()
    applyConfig({ treeCsv: BUILT_IN_SOURCE.treeCsv })
    expect(seen).toEqual([2]) // only while subscribed
  })
})

describe('persistence', () => {
  it('reloads an uploaded config on the next boot, and forgets it after a revert', async () => {
    applyConfig({ treeCsv: TREE })
    expect(localStorage.getItem('gc.config.v1')).toContain('Widget Pit')

    vi.resetModules() // a fresh page load reading the same localStorage
    const reloaded = await import('./config')
    expect(reloaded.activeConfig().custom).toEqual(['treeCsv'])
    expect(reloaded.activeConfig().catalog.buildings).toHaveLength(2)

    reloaded.resetConfig()
    expect(localStorage.getItem('gc.config.v1')).toBeNull()
  })

  it('drops a corrupt stored config rather than bricking the game', async () => {
    localStorage.setItem('gc.config.v1', '{ not json')
    vi.resetModules()
    const reloaded = await import('./config')
    expect(reloaded.activeConfig().custom).toEqual([])
    expect(reloaded.activeConfig().warnings[0]).toContain('reverted to the built-in one')
    expect(localStorage.getItem('gc.config.v1')).toBeNull()
  })
})

describe('broken uploads', () => {
  it('rejects a tech tree with nothing readable and leaves the game running', () => {
    const before = allBuildings().length
    expect(() => applyConfig({ treeCsv: 'Branch,Tier 1\nWidgets,nonsense\n' }))
      .toThrow(/no readable buildings/)
    expect(allBuildings().length).toBe(before)
    expect(activeConfig().custom).toEqual([])
  })

  it('warns about unreadable cells and unobtainable inputs instead of dropping them silently', () => {
    const config = buildConfig({
      treeCsv: [
        'Branch,Tier 1,Tier 2',
        'Widgets,Widget Pit (Workers->Widget),oops this is not a recipe',
        'Gadgets,Gadget Mill (Unobtanium->Gadget),N/A',
      ].join('\n'),
      countriesCsv: COUNTRIES,
    })
    expect(config.warnings.some(w => w.includes('cannot read'))).toBe(true)
    expect(config.warnings.some(w => w.includes('unobtainable input: Unobtanium'))).toBe(true)
  })
})
