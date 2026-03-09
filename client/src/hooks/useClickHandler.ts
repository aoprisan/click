import { useState, useCallback, useRef, useEffect } from 'react'
import type { User, CityUpdate, GameMode } from '../types'

const RATE_LIMIT = 100
const RATE_WINDOW = 60_000 // 60 seconds

export function useClickHandler(
  ws: { send: (msg: object) => void },
  user: User | null,
  onOptimisticUpdate: (update: CityUpdate) => void,
  gameMode: GameMode,
) {
  // pendingClicks tracks optimistic clicks not yet confirmed by server
  const [pendingClicks, setPendingClicks] = useState(0)
  // serverClicks tracks the last confirmed server total for this user's city
  const serverClicksRef = useRef(0)
  const clickTimestamps = useRef<number[]>([])

  const [rateLimited, setRateLimited] = useState(false)
  const rateLimitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(rateLimitTimer.current), [])

  const multiplier = gameMode === 'warrior' ? 2 : 1

  const handleClick = useCallback(() => {
    if (!user || gameMode === 'spectator') return

    // Client-side rate check
    const now = Date.now()
    clickTimestamps.current = clickTimestamps.current.filter(t => now - t < RATE_WINDOW)
    if (clickTimestamps.current.length >= RATE_LIMIT) {
      setRateLimited(true)
      clearTimeout(rateLimitTimer.current)
      rateLimitTimer.current = setTimeout(() => setRateLimited(false), 2000)
      return
    }
    clickTimestamps.current.push(now)

    // Optimistic local update
    setPendingClicks(prev => prev + multiplier)
    onOptimisticUpdate({
      cityId: user.cityId,
      totalClicks: 0, // not used by optimistic handler
      contributorCount: 0,
      highestEverPopulation: 0,
    })

    // Send to server
    ws.send({ type: 'click' })
  }, [ws, user, onOptimisticUpdate, gameMode, multiplier])

  // Called when server confirms city population via city_update
  const reconcile = useCallback((serverTotal: number) => {
    const prevServer = serverClicksRef.current
    serverClicksRef.current = serverTotal
    if (prevServer === 0) {
      // First reconciliation — no pending delta to clear
      return
    }
    const confirmed = serverTotal - prevServer
    // Reduce pending by the amount confirmed, but never go below 0
    setPendingClicks(prev => Math.max(0, prev - confirmed))
  }, [])

  // personalClicks = server total + optimistic pending
  const personalClicks = (serverClicksRef.current || (user?.totalClicks ?? 0)) + pendingClicks

  return { handleClick, personalClicks, pendingClicks, rateLimited, multiplier, reconcile }
}
