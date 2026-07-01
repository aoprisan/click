import { describe, it, expect } from 'vitest'
import { getBuilding, formatRecipe, recipeOverrideProblems } from './catalog'

describe('recipe amounts overlay', () => {
  it('has no dangling overrides — every id and resource is real', () => {
    // A typo'd building id or ingredient in recipes.ts trips this.
    expect(recipeOverrideProblems()).toEqual([])
  })

  it('merges hand-authored amounts onto the generated 1-in/1-out recipe', () => {
    const forge = getBuilding('primitive-forge')!
    expect(forge.inputs['Iron Ore']).toBe(2) // overridden
    expect(forge.inputs['Timber']).toBe(1)   // unspecified → stays 1
    expect(forge.outputs['Iron Bricks']).toBe(2)
  })

  it('leaves un-overridden buildings at 1-in / 1-out', () => {
    expect(getBuilding('crop-farm')!.outputs['Grain']).toBe(1)
  })

  it('shows amounts (>1) in the recipe label but hides the 1s', () => {
    const label = formatRecipe(getBuilding('blast-furnace')!)
    expect(label).toContain('Iron Bricks×2')
    expect(label).toContain('Coal') // amount 1 → no ×N suffix
    expect(label).not.toContain('Coal×1')
  })
})
