import { useEffect, useRef, useCallback, useState } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import type { User, CityUpdate, CityClick, WSMessage } from '../types'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export function useWebSocket(
  user: User | null,
  onCityUpdate: (update: CityUpdate) => void,
  onCityClick?: (click: CityClick) => void,
) {
  const wsRef = useRef<ReconnectingWebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const onCityUpdateRef = useRef(onCityUpdate)
  onCityUpdateRef.current = onCityUpdate
  const onCityClickRef = useRef(onCityClick)
  onCityClickRef.current = onCityClick

  useEffect(() => {
    if (!user) return

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
  }, [user])

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { send, connectionState }
}
