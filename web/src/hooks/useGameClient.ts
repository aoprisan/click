import { useEffect, useRef, useState } from 'react'
import { game } from '../client'
import type { ConnectionState } from '../client'
import type {
  City, Operator, TradeEvent, BuildingBuiltEvent, ThrottleState, NoticeEvent,
} from '../types'

export type { ConnectionState }

export interface GameClientHandlers {
  onCityUpdate?: (c: City) => void
  onOperatorUpdate?: (o: Operator) => void
  onTrade?: (t: TradeEvent) => void
  onBuildingBuilt?: (b: BuildingBuiltEvent) => void
  onThrottle?: (t: ThrottleState) => void
  onNotice?: (n: NoticeEvent) => void
}

/** Subscribes to the shared GameClient event stream and routes each event to
 *  the matching callback (mock today, live backend later). */
export function useGameClient(handlers: GameClientHandlers) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(game.connectionState())
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const unsubscribe = game.on(e => {
      const h = ref.current
      switch (e.type) {
        case 'city_update': h.onCityUpdate?.(e.data); break
        case 'operator_update': h.onOperatorUpdate?.(e.data); break
        case 'trade': h.onTrade?.(e.data); break
        case 'building_built': h.onBuildingBuilt?.(e.data); break
        case 'throttle': h.onThrottle?.(e.data); break
        case 'notice': h.onNotice?.(e.data); break
      }
    })
    setConnectionState(game.connectionState())
    return unsubscribe
  }, [])

  return { connectionState }
}
