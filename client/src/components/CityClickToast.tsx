import { useState, useCallback } from 'react'
import type { CityClick } from '../types'

interface Toast {
  id: number
  userName: string
}

export function useCityClickToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((click: CityClick) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-4), { id, userName: click.userName }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2000)
  }, [])

  return { toasts, addToast }
}

export default function CityClickToast({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: 'var(--amber)', background: 'rgba(8, 11, 7, 0.85)',
          border: '1px solid var(--line-dim)',
          padding: '4px 12px',
          backdropFilter: 'blur(6px)',
          animation: 'toastFloat 2s ease-out forwards',
        }}>
          <b>{t.userName}</b> clicked!
        </div>
      ))}
    </div>
  )
}
