export interface Toast {
  id: number
  tag: string
  text: string
  tone: 'info' | 'good' | 'warn' | 'trade' | 'build'
}

const toneClass: Record<Toast['tone'], string> = {
  info: 'toast--click',
  good: 'toast--achievement',
  warn: 'toast--missile_incoming',
  trade: 'toast--missile_awarded',
  build: 'toast--achievement',
}

export default function ToastSystem({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      {toasts.slice(-5).map(t => (
        <div key={t.id} className={`toast ${toneClass[t.tone]}`}>
          <span className="toast-tag">{t.tag}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
