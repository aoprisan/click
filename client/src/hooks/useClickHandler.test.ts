import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClickHandler } from './useClickHandler'
import type { User } from '../types'

const mockUser: User = { id: 'u1', name: 'Alice', cityId: 'berlin-de', totalClicks: 0, role: 'builder', totalKills: 0, best10s: 0, best1day: 0, clickMissileClicks: 0, lastCumulativeThreshold: 0 }

function createMockWs() {
  return { send: vi.fn() }
}

describe('useClickHandler', () => {
  it('increments personal clicks on click', () => {
    const ws = createMockWs()
    const onOptimistic = vi.fn()
    const { result } = renderHook(() => useClickHandler(ws, mockUser, onOptimistic, 'builder'))

    act(() => { result.current.handleClick() })

    expect(result.current.personalClicks).toBe(1)
    expect(ws.send).toHaveBeenCalledWith({ type: 'click' })
    expect(onOptimistic).toHaveBeenCalledTimes(1)
  })

  it('does nothing when user is null', () => {
    const ws = createMockWs()
    const onOptimistic = vi.fn()
    const { result } = renderHook(() => useClickHandler(ws, null, onOptimistic, 'spectator'))

    act(() => { result.current.handleClick() })

    expect(result.current.personalClicks).toBe(0)
    expect(ws.send).not.toHaveBeenCalled()
  })

  it('respects client-side rate limit of 100 clicks', () => {
    const ws = createMockWs()
    const onOptimistic = vi.fn()
    const { result } = renderHook(() => useClickHandler(ws, mockUser, onOptimistic, 'builder'))

    for (let i = 0; i < 105; i++) {
      act(() => { result.current.handleClick() })
    }

    // Should cap at 100
    expect(result.current.personalClicks).toBe(100)
    expect(ws.send).toHaveBeenCalledTimes(100)
  })

  it('gives 2x multiplier for warriors', () => {
    const ws = createMockWs()
    const onOptimistic = vi.fn()
    const warriorUser = { ...mockUser, role: 'warrior' }
    const { result } = renderHook(() => useClickHandler(ws, warriorUser, onOptimistic, 'warrior'))

    act(() => { result.current.handleClick() })

    expect(result.current.personalClicks).toBe(2)
    expect(result.current.multiplier).toBe(2)
  })
})
