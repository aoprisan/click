import type { City, CityDetail, User, GlobalStats, Missile, Subscription } from './types'

export async function fetchCities(): Promise<City[]> {
  const res = await fetch('/api/cities')
  if (!res.ok) throw new Error('Failed to fetch cities')
  return res.json()
}

export async function fetchCityDetail(id: string): Promise<CityDetail> {
  const res = await fetch(`/api/cities/${id}`)
  if (!res.ok) throw new Error('Failed to fetch city')
  return res.json()
}

export async function fetchLeaderboard(limit = 10): Promise<City[]> {
  const res = await fetch(`/api/leaderboard?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch leaderboard')
  return res.json()
}

export async function register(name: string, cityId: string): Promise<{ userId: string; name: string; cityId: string }> {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, cityId }),
  })
  if (!res.ok) throw new Error('Failed to register')
  return res.json()
}

export async function fetchMe(): Promise<User | null> {
  const res = await fetch('/api/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function fetchStats(): Promise<GlobalStats> {
  const res = await fetch('/api/stats')
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function fetchMyMissiles(): Promise<Missile[]> {
  const res = await fetch('/api/me/missiles')
  if (res.status === 401) return []
  if (!res.ok) throw new Error('Failed to fetch missiles')
  return res.json()
}

export async function fireMissile(missileId: string, targetCityId: string): Promise<{ damage: number; missileType: string; targetCity: string }> {
  const res = await fetch(`/api/missiles/${missileId}/fire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetCityId }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to fire missile')
  }
  return res.json()
}

export async function subscribe(plan: string = 'weekly'): Promise<Subscription> {
  const res = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new Error('Failed to subscribe')
  return res.json()
}

export async function fetchSubscription(): Promise<Subscription | null> {
  const res = await fetch('/api/me/subscription')
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to fetch subscription')
  return res.json()
}

export async function renewSubscription(): Promise<Subscription> {
  const res = await fetch('/api/subscribe/renew', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to renew subscription')
  return res.json()
}
