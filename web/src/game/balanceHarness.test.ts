import { describe, it, expect } from 'vitest'
import { simulate, report, findInvariantViolations } from './balanceHarness'

// These specs ARE the "sane bands" the roadmap asks for: run the world headless
// and assert population / cash / happiness settle where the design intends. The
// sim is deterministic (seeded PRNG), so a regression that re-introduces a
// starvation spiral or a runaway will trip a band here, not just drift unseen.

describe('balance harness — structural invariants', () => {
  it('never violates physical invariants, across seeds and cadences', () => {
    for (const seed of [1, 2, 7, 42]) {
      for (const botActivity of ['all', 'sample'] as const) {
        const r = simulate({ seed, ticks: 80, withPlayer: true, botActivity })
        const violations = findInvariantViolations(r.cities)
        expect(violations, `seed=${seed} ${botActivity}: ${violations.slice(0, 3).join('; ')}`).toEqual([])
      }
    }
  })

  it('is deterministic for a given seed', () => {
    const a = simulate({ seed: 5, ticks: 50, withPlayer: true })
    const b = simulate({ seed: 5, ticks: 50, withPlayer: true })
    const popA = a.history[a.history.length - 1].worldPopulation
    const popB = b.history[b.history.length - 1].worldPopulation
    expect(popA).toBe(popB)
    expect(a.player!.population).toBe(b.player!.population)
  })
})

describe('balance harness — sane bands (steady cadence)', () => {
  // The clean equilibrium probe: every bot acts each tick.
  const r = simulate({ seed: 1, ticks: 60, withPlayer: true, botActivity: 'all' })
  const first = r.history[0]
  const last = r.history[r.history.length - 1]

  it('the world sustains itself — no mass starvation', () => {
    // A healthy economy grows the planet; a broken one starves it back toward 0.
    expect(last.worldPopulation).toBeGreaterThan(first.worldPopulation)
    // No single city is wiped out (the residential-stacking eviction bug did this).
    expect(last.population.min).toBeGreaterThan(0)
  })

  it('does not run away', () => {
    // First-draft numbers can spiral; cap cities and cash to catch a runaway.
    expect(last.population.max).toBeLessThan(20_000)
    expect(last.cash.max).toBeLessThan(1_000_000)
  })

  it('keeps happiness in a livable band — neither collapsed nor pinned', () => {
    expect(last.happiness.median).toBeGreaterThan(40)
    expect(last.happiness.median).toBeLessThan(95)
    expect(last.happiness.min).toBeGreaterThan(10)
  })

  it('lets a diligent clicking player grow their city', () => {
    const player = r.player!
    // Accra starts at 265; a competent player should clear well past that.
    expect(player.population).toBeGreaterThan(800)
    expect(player.cash).toBeGreaterThanOrEqual(0)
    expect(player.happiness).toBeGreaterThan(40)
    expect(player.happiness).toBeLessThanOrEqual(100)
  })
})

describe('balance harness — realistic cadence', () => {
  // Only ~6–11 bots act per tick, as the live client does. Slower, noisier; we
  // assert the planet still trends up and no city is evicted to zero.
  it('sustains the world under sampled bot activity', () => {
    const r = simulate({ seed: 1, ticks: 120, withPlayer: true, botActivity: 'sample' })
    const first = r.history[0]
    const last = r.history[r.history.length - 1]
    expect(last.worldPopulation).toBeGreaterThan(first.worldPopulation)
    expect(last.population.min).toBeGreaterThanOrEqual(0)
    expect(findInvariantViolations(r.cities)).toEqual([])
  })
})

// `npm run balance` surfaces this report for eyeballing the numbers during a
// tuning session — it is not an assertion, just a readout.
describe('balance harness — report', () => {
  it('prints a band report', () => {
    const text = report(simulate({ seed: 1, ticks: 60, withPlayer: true }))
    console.log('\n' + text)
    expect(text).toContain('Balance harness')
  })
})
