import { useState, useCallback, useRef } from 'react'

export interface Toast {
  id: number
  message: string
  type: 'click' | 'achievement' | 'missile_awarded' | 'missile_strike' | 'missile_incoming'
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const addToast = useCallback((message: string, type: Toast['type'] = 'click') => {
    const id = nextId.current++
    setToasts(prev => [...prev.slice(-4), { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return { toasts, addToast }
}

interface ToastSystemProps {
  toasts: Toast[]
}

export default function ToastSystem({ toasts }: ToastSystemProps) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
    }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: getToastBg(toast.type),
          border: `1px solid ${getToastBorder(toast.type)}`,
          borderRadius: 8, padding: '8px 16px',
          fontSize: 12, color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          animation: 'toastIn 0.3s ease-out',
          backdropFilter: 'blur(8px)',
          maxWidth: 300, textAlign: 'center',
        }}>
          {toast.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function getToastBg(type: Toast['type']): string {
  switch (type) {
    case 'achievement': return 'rgba(247, 201, 72, 0.15)'
    case 'missile_awarded': return 'rgba(96, 165, 250, 0.15)'
    case 'missile_strike': return 'rgba(248, 113, 113, 0.15)'
    case 'missile_incoming': return 'rgba(248, 113, 113, 0.2)'
    default: return 'var(--bg-panel)'
  }
}

function getToastBorder(type: Toast['type']): string {
  switch (type) {
    case 'achievement': return 'rgba(247, 201, 72, 0.3)'
    case 'missile_awarded': return 'rgba(96, 165, 250, 0.3)'
    case 'missile_strike': return 'rgba(248, 113, 113, 0.3)'
    case 'missile_incoming': return 'rgba(248, 113, 113, 0.4)'
    default: return 'var(--border)'
  }
}
