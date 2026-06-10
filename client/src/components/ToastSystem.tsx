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

const TOAST_TAGS: Record<Toast['type'], string> = {
  click: 'POP',
  achievement: 'ACHV',
  missile_awarded: 'ARMD',
  missile_strike: 'STRK',
  missile_incoming: 'ALRT',
}

export default function ToastSystem({ toasts }: ToastSystemProps) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span className="toast-tag">{TOAST_TAGS[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
