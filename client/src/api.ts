import type { City, CityDetail, User } from './types'

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
