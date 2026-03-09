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
      <div className="subscription-panel" style={{
        position: 'absolute', top: 80, left: 24, zIndex: 10,
      }}>
        <button
          onClick={() => setShow(true)}
          style={{
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
            padding: '4px 10px', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer',
          }}
        >
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
      <div className="panel subscription-panel" style={{
        top: 80, left: 24, width: 260,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Upgrade to Warrior
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
          2x population per click, earn click missiles, unlock full combat
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleSubscribe('weekly')}
            disabled={loading}
            style={{
              flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8,
              padding: '8px 0', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 12,
              opacity: loading ? 0.5 : 1,
            }}
          >
            $1.99/wk
          </button>
          <button
            onClick={() => handleSubscribe('monthly')}
            disabled={loading}
            style={{
              flex: 1, background: 'var(--gold)', border: 'none', borderRadius: 8,
              padding: '8px 0', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 12,
              opacity: loading ? 0.5 : 1,
            }}
          >
            $4.99/mo
          </button>
        </div>
      </div>
    )
  }

  // Warrior view (expanded)
  return (
    <div className="panel subscription-panel" style={{
      top: 80, left: 24, width: 240,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Warrior Sub
        </span>
        <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        {isExpired ? 'Expired' : `${daysLeft} days remaining`} · {sub?.plan}
      </div>
      {(isExpired || canEarlyRenew) && (
        <button
          onClick={handleRenew}
          disabled={loading}
          style={{
            width: '100%', background: 'var(--gold)', border: 'none', borderRadius: 8,
            padding: '8px 0', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: 12,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {canEarlyRenew ? 'Renew Early (20% off)' : 'Renew'}
        </button>
      )}
    </div>
  )
}
