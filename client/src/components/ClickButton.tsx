import { useState, useCallback } from 'react'
import type { GameMode } from '../types'

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
}

export default function ClickButton({ onClick, personalClicks, cityName, rateLimited, gameMode, multiplier }: ClickButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [particles, setParticles] = useState<Particle[]>([])

  const handleClick = useCallback(() => {
    if (gameMode === 'spectator') {
      // Spectator click could trigger login flow
      onClick()
      return
    }

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
    <div className="click-button-area" style={{
      position: 'absolute', bottom: 32, right: 32, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {cityName && gameMode !== 'spectator' && (
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
          {cityName}
        </span>
      )}

      <div style={{ position: 'relative' }}>
        {/* Particle burst */}
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: 57, top: 57, width: 6, height: 6,
            borderRadius: '50%', background: 'var(--gold)',
            pointerEvents: 'none', zIndex: 20,
            opacity: 0,
            animation: 'particleFade 0.5s ease-out forwards',
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
          } as React.CSSProperties} />
        ))}

        {/* Ripple effects */}
        {ripples.map(id => (
          <div key={id} style={{
            position: 'absolute', inset: -10,
            borderRadius: '50%', border: '2px solid var(--gold)',
            animation: 'ripple 0.6s ease-out forwards',
            pointerEvents: 'none',
          }} />
        ))}

        <button
          onClick={handleClick}
          style={{
            width: 120, height: 120, borderRadius: '50%',
            background: gameMode === 'spectator'
              ? 'radial-gradient(circle at 35% 35%, #93c5fd, #60a5fa, #3b82f6)'
              : 'radial-gradient(circle at 35% 35%, #ffd866, var(--gold), var(--gold-dim))',
            border: 'none', cursor: 'pointer',
            boxShadow: gameMode === 'spectator'
              ? '0 0 30px rgba(96, 165, 250, 0.3), inset 0 -3px 6px rgba(0,0,0,0.2)'
              : '0 0 30px rgba(247, 201, 72, 0.3), inset 0 -3px 6px rgba(0,0,0,0.2)',
            transform: pressing ? 'scale(0.92)' : 'scale(1)',
            transition: 'transform 0.1s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: gameMode === 'spectator' ? 18 : 20, fontWeight: 700,
            color: '#1a1a2e',
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {gameMode !== 'spectator' && (
        <span className="mono" style={{ fontSize: 16, color: 'var(--gold)' }}>
          {personalClicks.toLocaleString()}
        </span>
      )}

      {rateLimited && (
        <span style={{
          fontSize: 11, color: '#ff6b6b', fontFamily: 'var(--font-sans)',
          animation: 'fadeInOut 2s ease-out forwards',
        }}>
          Slow down!
        </span>
      )}

      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes particleFade {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes fadeInOut {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
