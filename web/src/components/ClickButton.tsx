import { useState, useCallback } from 'react'
import { playClickSound, haptic } from '../sound'

interface Particle { id: number; dx: number; dy: number }

interface ClickButtonProps {
  onClick: () => void
  totalUnits: number
  activeBuildingName: string
  /** activity units the next click is worth right now (happiness × drink). */
  unitsPerClick: number
  /** throttle meter 0..1; 1 = full bucket. */
  meter: number
  blocked: boolean
  /** active energy-drink multiplier (1 = none). */
  multiplier: number
  /** an autoclicker employee is working. */
  autoclicking: boolean
  /** HUD panels are hidden — grow the button to fill the freed space. */
  expanded?: boolean
}

export default function ClickButton({ onClick, totalUnits, activeBuildingName, unitsPerClick, meter, blocked, multiplier, autoclicking, expanded }: ClickButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [particles, setParticles] = useState<Particle[]>([])

  const handleClick = useCallback(() => {
    // Tactile feedback: a boosted click gets a punchier, higher-pitched tone.
    playClickSound(multiplier > 1 ? 1.18 : 1)
    haptic(multiplier > 1 ? 18 : 12)

    setPressing(true)
    setTimeout(() => setPressing(false), 100)
    const id = Date.now()
    setRipples(prev => [...prev, id])
    setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 600)
    const dist = 50 + Math.random() * 20
    const newParticles: Particle[] = Array.from({ length: 10 }, (_, i) => {
      const angle = ((360 / 10) * i + Math.random() * 20 - 10) * (Math.PI / 180)
      return { id: id + i, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
    })
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id))), 500)
    onClick()
  }, [onClick, multiplier])

  return (
    <div className={`click-button-area mode-${multiplier > 1 ? 'warrior' : 'builder'}${expanded ? ' expanded' : ''}`}>
      <span className="launch-city">
        {activeBuildingName}
        {multiplier > 1 && <span className="orange"> · ⚡{multiplier}×</span>}
        {autoclicking && <span className="green"> · ⚙</span>}
      </span>

      <div className="dial">
        <div className="dial-ticks" />
        <div className="dial-sweep" />
        {particles.map(p => (
          <div key={p.id} className="particle" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as React.CSSProperties} />
        ))}
        {ripples.map(id => <div key={id} className="ripple" />)}
        <button className={`launch-btn${pressing ? ' pressing' : ''}`} onClick={handleClick}>
          GROW
          <span className="launch-per-click">+{Math.round(unitsPerClick)}</span>
        </button>
      </div>

      <div className={`throttle-meter${meter < 0.15 ? ' hot' : ''}`} title="click rate">
        <span style={{ width: `${Math.round(meter * 100)}%` }} />
      </div>

      <span className="launch-count">{Math.round(totalUnits).toLocaleString()} u</span>
      {blocked && <span className="rate-warn">Throttled — easing off</span>}
    </div>
  )
}
