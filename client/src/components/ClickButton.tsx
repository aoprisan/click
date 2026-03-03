import { useState, useCallback } from 'react'

interface ClickButtonProps {
  onClick: () => void
  personalClicks: number
  cityName?: string
}

export default function ClickButton({ onClick, personalClicks, cityName }: ClickButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])

  const handleClick = useCallback(() => {
    setPressing(true)
    setTimeout(() => setPressing(false), 100)

    // Add ripple
    const id = Date.now()
    setRipples(prev => [...prev, id])
    setTimeout(() => setRipples(prev => prev.filter(r => r !== id)), 600)

    onClick()
  }, [onClick])

  return (
    <div style={{
      position: 'absolute', bottom: 32, right: 32, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      {cityName && (
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}>
          {cityName}
        </span>
      )}

      <div style={{ position: 'relative' }}>
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
            background: 'radial-gradient(circle at 35% 35%, #ffd866, var(--gold), var(--gold-dim))',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 0 30px rgba(247, 201, 72, 0.3), inset 0 -3px 6px rgba(0,0,0,0.2)',
            transform: pressing ? 'scale(0.92)' : 'scale(1)',
            transition: 'transform 0.1s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
            color: '#1a1a2e',
          }}
        >
          CLICK
        </button>
      </div>

      <span className="mono" style={{ fontSize: 16, color: 'var(--gold)' }}>
        {personalClicks.toLocaleString()}
      </span>

      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
