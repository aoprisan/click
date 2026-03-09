import { useEffect, useRef, useCallback, useState } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import type { User, CityUpdate, CityClick, MissileStrikeData, AchievementEarnedData, WSMessage } from '../types'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export function useWebSocket(
  user: User | null,
  onCityUpdate: (update: CityUpdate) => void,
  onCityClick?: (click: CityClick) => void,
  onMissileStrike?: (strike: MissileStrikeData) => void,
  onAchievement?: (data: AchievementEarnedData) => void,
  onMissileAwarded?: (data: { missileType: string; source: string }) => void,
) {
  const wsRef = useRef<ReconnectingWebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const onCityUpdateRef = useRef(onCityUpdate)
  onCityUpdateRef.current = onCityUpdate
  const onCityClickRef = useRef(onCityClick)
  onCityClickRef.current = onCityClick
  const onMissileStrikeRef = useRef(onMissileStrike)
  onMissileStrikeRef.current = onMissileStrike
  const onAchievementRef = useRef(onAchievement)
  onAchievementRef.current = onAchievement
  const onMissileAwardedRef = useRef(onMissileAwarded)
  onMissileAwardedRef.current = onMissileAwarded

  useEffect(() => {
    // Connect for all visitors (spectators and authenticated users)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`
    const ws = new ReconnectingWebSocket(url)
    wsRef.current = ws

    setConnectionState('connecting')

    ws.onopen = () => setConnectionState('connected')
    ws.onclose = () => setConnectionState('connecting')  // RWS will retry

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'city_update' && msg.data) {
          onCityUpdateRef.current(msg.data as CityUpdate)
        } else if (msg.type === 'city_click' && msg.data) {
          onCityClickRef.current?.(msg.data as CityClick)
        } else if (msg.type === 'missile_strike' && msg.data) {
          onMissileStrikeRef.current?.(msg.data as MissileStrikeData)
        } else if (msg.type === 'missile_incoming' && msg.data) {
          onMissileStrikeRef.current?.(msg.data as MissileStrikeData)
        } else if (msg.type === 'achievement_earned' && msg.data) {
          onAchievementRef.current?.(msg.data as AchievementEarnedData)
        } else if ((msg.type === 'missile_awarded' || msg.type === 'missile_upgraded') && msg.data) {
          onMissileAwardedRef.current?.(msg.data as unknown as { missileType: string; source: string })
        }
      } catch {
        // ignore malformed messages
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
      setConnectionState('disconnected')
    }
  }, [user?.id]) // Reconnect when user changes (login/logout)

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { send, connectionState }
}
