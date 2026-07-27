import { describe, it, expect } from 'vitest'
import {
  DEFAULT_KNOBS, formatRecipesCsv, formatTuningCsv, parseRecipesCsv, parseTuningCsv, tierUnlockFor,
} from './tuning'
import { RECIPE_AMOUNTS } from './recipes'

describe('tuning CSV', () => {
  it('round-trips the built-in knobs', () => {
    const { knobs, warnings } = parseTuningCsv(formatTuningCsv(DEFAULT_KNOBS))
    expect(warnings).toEqual([])
    expect(knobs).toEqual(DEFAULT_KNOBS)
  })

  it('overrides only the keys the file names', () => {
    const { knobs } = parseTuningCsv('key,value\nbuild_cost.base,500\n')
    expect(knobs.buildCostBase).toBe(500)
    expect(knobs.workersBase).toBe(DEFAULT_KNOBS.workersBase)
    expect(knobs.foodValues).toEqual(DEFAULT_KNOBS.foodValues)
  })

  it('replaces the whole food list once one food row appears', () => {
    const { knobs } = parseTuningCsv('key,value\nfood_value.Soup,25\n')
    expect(knobs.foodValues).toEqual({ Soup: 25 })
  })

  it('warns instead of throwing on unknown keys and junk values', () => {
    const { knobs, warnings } = parseTuningCsv('key,value\nnot.a.knob,3\nbuild_cost.base,banana\n')
    expect(warnings).toHaveLength(2)
    expect(knobs.buildCostBase).toBe(DEFAULT_KNOBS.buildCostBase) // kept the default
  })

  it('reads tier unlocks, inheriting from the nearest lower tier', () => {
    const { knobs } = parseTuningCsv('key,value\ntier_unlock.1,0\ntier_unlock.4,900\n')
    expect(tierUnlockFor(1, knobs)).toBe(0)
    expect(tierUnlockFor(3, knobs)).toBe(0)
    expect(tierUnlockFor(4, knobs)).toBe(900)
    expect(tierUnlockFor(7, knobs)).toBe(900)
  })
})

describe('recipes CSV', () => {
  it('round-trips the built-in amounts', () => {
    const { recipes, warnings } = parseRecipesCsv(formatRecipesCsv(RECIPE_AMOUNTS))
    expect(warnings).toEqual([])
    expect(recipes).toEqual(RECIPE_AMOUNTS)
  })

  it('reads inputs and outputs per building', () => {
    const { recipes } = parseRecipesCsv([
      'building_id,kind,resource,amount',
      'windmill,input,Grain,4',
      'windmill,output,Flour,2',
    ].join('\n'))
    expect(recipes['windmill']).toEqual({ inputs: { Grain: 4 }, outputs: { Flour: 2 } })
  })

  it('skips bad rows with a warning rather than failing the upload', () => {
    const { recipes, warnings } = parseRecipesCsv([
      'building_id,kind,resource,amount',
      'windmill,sideways,Grain,4',
      'windmill,input,Grain,0',
      'windmill,output,Flour,2',
    ].join('\n'))
    expect(warnings).toHaveLength(2)
    expect(recipes['windmill']).toEqual({ outputs: { Flour: 2 } })
  })
})
