import { useState, useEffect, useCallback } from 'react'
import type { Missile, GameMode } from '../types'
import { fetchMyMissiles } from '../api'

interface MissilePanelProps {
  gameMode: GameMode
  onFireMissile: (missile: Missile) => void
  refreshKey: number
}

export default function MissilePanel({ gameMode, onFireMissile, refreshKey }: MissilePanelProps) {
  const [missiles, setMissiles] = useState<Missile[]>([])
  const [collapsed, setCollapsed] = useState(false)

  const loadMissiles = useCallback(() => {
    if (gameMode === 'spectator') return
    fetchMyMissiles().then(setMissiles).catch(() => {})
  }, [gameMode])

  useEffect(() => {
    loadMissiles()
  }, [loadMissiles, refreshKey])

  if (gameMode === 'spectator' || missiles.length === 0) return null

  return (
    <div className="panel missile-panel" style={{
      top: 110, left: 24, width: 240,
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', marginBottom: collapsed ? 0 : 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: '#f87171', letterSpacing: 1, textTransform: 'uppercase' }}>
          Arsenal ({missiles.length})
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{collapsed ? '+' : '-'}</span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missiles.map(m => (
            <div key={m.id} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: getMissileColor(m.missileType) }}>
                    {m.missileType}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {m.source === 'achievement' ? 'Achievement' : 'Click'} · {m.rangeKm}km · {m.damageLower}-{m.damageUpper}
                  </div>
                </div>
                <button
                  onClick={() => onFireMissile(m)}
                  style={{
                    background: '#f87171', border: 'none', borderRadius: 6,
                    padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    color: '#000', cursor: 'pointer',
                  }}
                >
                  FIRE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getMissileColor(type: string): string {
  if (type.startsWith('Atlas')) return '#f87171'
  if (type.startsWith('Titan')) return '#fb923c'
  return '#fbbf24'
}
