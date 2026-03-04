import { useEffect, useRef, useCallback, useState } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import type { User, CityUpdate, WSMessage } from '../types'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export function useWebSocket(
  user: User | null,
  onCityUpdate: (update: CityUpdate) => void,
) {
  const wsRef = useRef<ReconnectingWebSocket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  useEffect(() => {
    if (!user) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`
    const ws = new ReconnectingWebSocket(url)
    wsRef.current = ws

    setConnectionState('connecting')

    ws.onopen = () => setConnectionState('connected')
    ws.onclose = () => setConnectionState('disconnected')

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.type === 'city_update' && msg.data) {
          onCityUpdate(msg.data)
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
  }, [user, onCityUpdate])

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { send, connectionState }
}
