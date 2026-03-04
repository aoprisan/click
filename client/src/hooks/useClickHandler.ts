import { useState, useCallback, useRef } from 'react'
import type { User, CityUpdate } from '../types'

const RATE_LIMIT = 100
const RATE_WINDOW = 60_000 // 60 seconds

export function useClickHandler(
  ws: { send: (msg: object) => void },
  user: User | null,
  onOptimisticUpdate: (update: CityUpdate) => void,
) {
  const [personalClicks, setPersonalClicks] = useState(0)
  const clickTimestamps = useRef<number[]>([])

  const [rateLimited, setRateLimited] = useState(false)
  const rateLimitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleClick = useCallback(() => {
    if (!user) return

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
    setPersonalClicks(prev => prev + 1)
    onOptimisticUpdate({
      cityId: user.cityId,
      totalClicks: 0, // not used by optimistic handler
      contributorCount: 0,
    })

    // Send to server
    ws.send({ type: 'click' })
  }, [ws, user, onOptimisticUpdate])

  return { handleClick, personalClicks, rateLimited }
}
