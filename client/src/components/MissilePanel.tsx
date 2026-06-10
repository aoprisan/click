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
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768)

  const loadMissiles = useCallback(() => {
    if (gameMode === 'spectator') return
    fetchMyMissiles().then(setMissiles).catch(() => {})
  }, [gameMode])

  useEffect(() => {
    loadMissiles()
  }, [loadMissiles, refreshKey])

  if (gameMode === 'spectator' || missiles.length === 0) return null

  return (
    <div className="panel panel--static bracketed bracketed--red missile-panel" style={{ borderColor: 'rgba(255, 69, 54, 0.25)' }}>
      <div className="hazard" />
      <div
        className="panel-head"
        onClick={() => setCollapsed(!collapsed)}
        style={{ marginBottom: collapsed ? 0 : 10 }}
      >
        <span className="panel-label panel-label--red">Arsenal ({missiles.length})</span>
        <span className="panel-toggle">{collapsed ? '+' : '−'}</span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missiles.map(m => (
            <div key={m.id} className="missile-row">
              <div style={{ minWidth: 0 }}>
                <div className="missile-name" style={{ color: getMissileColor(m.missileType) }}>
                  {m.missileType}
                </div>
                <div className="missile-spec">
                  {m.source === 'achievement' ? 'Achievement' : 'Click'} · {m.rangeKm}km · {m.damageLower}–{m.damageUpper}
                </div>
              </div>
              <button className="btn-fire" onClick={() => onFireMissile(m)}>
                FIRE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getMissileColor(type: string): string {
  if (type.startsWith('Atlas')) return 'var(--red)'
  if (type.startsWith('Titan')) return 'var(--orange)'
  return 'var(--amber)'
}
