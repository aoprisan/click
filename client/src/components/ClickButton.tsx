import { useState, useCallback } from 'react'
import type { GameMode } from '../types'
import { playClickSound, haptic } from '../sound'

interface Particle {
  id: number
  dx: number
  dy: number
}

interface ClickButtonProps {
  onClick: () => void
  personalClicks: number
  cityName?: string
  rateLimited?: boolean
  gameMode: GameMode
  multiplier: number
  expanded?: boolean
}

export default function ClickButton({ onClick, personalClicks, cityName, rateLimited, gameMode, multiplier, expanded }: ClickButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [particles, setParticles] = useState<Particle[]>([])

  const handleClick = useCallback(() => {
    if (gameMode === 'spectator') {
      // Spectator click triggers the login flow
      onClick()
      return
    }

    // Tactile feedback: warriors get a punchier, higher-pitched click.
    playClickSound(gameMode === 'warrior' ? 1.18 : 1)
    haptic(gameMode === 'warrior' ? 18 : 12)

    setPressing(true)
    setTimeout(() => setPressing(false), 100)

    // Add ripple
    const id = Date.now()
    setRipples(prev => [...prev, id])
    setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 600)

    // Add particles
    const dist = 50 + Math.random() * 20
    const newParticles: Particle[] = Array.from({ length: 10 }, (_, i) => {
      const angle = ((360 / 10) * i + Math.random() * 20 - 10) * (Math.PI / 180)
      return { id: id + i, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
    })
    setParticles(prev => [...prev, ...newParticles])
    setTimeout(() => setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id))), 500)

    onClick()
  }, [onClick, gameMode])

  const buttonLabel = gameMode === 'spectator' ? 'LOGIN' : `GROW +${multiplier}`

  return (
    <div className={`click-button-area mode-${gameMode}${expanded ? ' expanded' : ''}`}>
      {cityName && gameMode !== 'spectator' && (
        <span className="launch-city">{cityName}</span>
      )}

      <div className="dial">
        <div className="dial-ticks" />
        <div className="dial-sweep" />

        {particles.map(p => (
          <div
            key={p.id}
            className="particle"
            style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as React.CSSProperties}
          />
        ))}

        {ripples.map(id => (
          <div key={id} className="ripple" />
        ))}

        <button className={`launch-btn${pressing ? ' pressing' : ''}`} onClick={handleClick}>
          {buttonLabel}
        </button>
      </div>

      {gameMode !== 'spectator' && (
        <span className="launch-count">{personalClicks.toLocaleString()}</span>
      )}

      {rateLimited && (
        <span className="rate-warn">Slow down!</span>
      )}
    </div>
  )
}
