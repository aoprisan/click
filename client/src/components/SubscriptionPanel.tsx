import { useState, useEffect } from 'react'
import type { GameMode, Subscription } from '../types'
import { subscribe, fetchSubscription, renewSubscription } from '../api'

interface SubscriptionPanelProps {
  gameMode: GameMode
  onUpgraded: () => void
}

export default function SubscriptionPanel({ gameMode, onUpgraded }: SubscriptionPanelProps) {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    fetchSubscription().then(setSub).catch(() => {})
  }, [gameMode])

  if (gameMode === 'spectator') return null

  const isExpired = sub ? new Date(sub.expiresAt) < new Date() : true
  const daysLeft = sub ? Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
  const canEarlyRenew = daysLeft > 0 && daysLeft <= 2

  if (gameMode === 'warrior' && !show) {
    return (
      <div className="subscription-panel">
        <button className="btn-ghost" onClick={() => setShow(true)}>
          Subscription {daysLeft > 0 ? `(${daysLeft}d left)` : '(expired)'}
        </button>
      </div>
    )
  }

  const handleSubscribe = async (plan: string) => {
    setLoading(true)
    try {
      const newSub = await subscribe(plan)
      setSub(newSub)
      onUpgraded()
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  const handleRenew = async () => {
    setLoading(true)
    try {
      const newSub = await renewSubscription()
      setSub(newSub)
      onUpgraded()
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  if (gameMode === 'builder') {
    return (
      <div className="panel panel--static bracketed subscription-panel">
        <div className="panel-label panel-label--amber" style={{ marginBottom: 8 }}>
          Upgrade to Warrior
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.6 }}>
          2x population per click, earn click missiles, unlock full combat
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={() => handleSubscribe('weekly')}
            disabled={loading}
          >
            $1.99/wk
          </button>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={() => handleSubscribe('monthly')}
            disabled={loading}
          >
            $4.99/mo
          </button>
        </div>
      </div>
    )
  }

  // Warrior view (expanded)
  return (
    <div className="panel panel--static bracketed subscription-panel">
      <div className="panel-head" style={{ marginBottom: 8, cursor: 'default' }}>
        <span className="panel-label panel-label--amber">Warrior Sub</span>
        <button
          onClick={() => setShow(false)}
          style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 8 }}>
        {isExpired ? 'Expired' : `${daysLeft} days remaining`} · {sub?.plan}
      </div>
      {(isExpired || canEarlyRenew) && (
        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={handleRenew}
          disabled={loading}
        >
          {canEarlyRenew ? 'Renew Early (20% off)' : 'Renew'}
        </button>
      )}
    </div>
  )
}
