// First-session tutorial (roadmap UX #6). A small coach card that nudges a new
// operator through the core loop — pick a building → click → bank food → build
// housing — advancing on real game milestones rather than timers, and never
// shown again once finished or skipped. The starvation valve is unintuitive
// cold; this is the warm-up.
import { useEffect, useState } from 'react'
import type { City, Operator } from '../types'

const DONE_KEY = 'gc.tutorial.v1'

interface Step {
  tag: string
  text: string
  /** true once the player has accomplished this step. */
  done: (city: City, op: Operator) => boolean
}

const STEPS: Step[] = [
  {
    tag: 'STEP 1 · WORK',
    text: 'Pick a building in the left panel, then press GROW. Your clicks are the labor that builds and runs it.',
    done: (_c, op) => op.totalUnits > 0,
  },
  {
    tag: 'STEP 2 · FEED',
    text: 'Keep the Crop Farm active and grow some Food. Population eats every tick — an empty larder tanks happiness, and happiness powers your clicks.',
    done: c => (c.inventory['Grain'] || 0) >= 20,
  },
  {
    tag: 'STEP 3 · HOUSE',
    text: 'Crowded cities stop growing. Build a Housing Block (Civic) to raise capacity, then keep it fed. That loop — house, feed, repeat — is the whole game.',
    done: c => c.buildings.some(b => b.defId === 'housing-block' && (b.level >= 2 || b.constructionRemaining > 0)),
  },
]

export default function Tutorial({ city, operator }: { city: City; operator: Operator }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DONE_KEY) === '1' } catch { return false }
  })

  // First step the player hasn't completed yet; -1 once all are done.
  const stepIndex = STEPS.findIndex(s => !s.done(city, operator))

  useEffect(() => {
    if (stepIndex === -1 && !dismissed) {
      try { localStorage.setItem(DONE_KEY, '1') } catch { /* storage off — fine */ }
    }
  }, [stepIndex, dismissed])

  if (dismissed || stepIndex === -1) return null
  const step = STEPS[stepIndex]

  function finish() {
    try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="tutorial-card bracketed">
      <div className="tutorial-head">
        <span className="panel-label panel-label--amber">{step.tag}</span>
        <span className="tutorial-progress">{stepIndex + 1}/{STEPS.length}</span>
        <button className="tutorial-skip" onClick={finish} title="dismiss tutorial">skip ✕</button>
      </div>
      <p className="tutorial-text">{step.text}</p>
    </div>
  )
}
