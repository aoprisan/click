import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Globe from './components/Globe'
import Onboarding from './components/Onboarding'
import ClickButton from './components/ClickButton'
import InfoPanel from './components/InfoPanel'
import Leaderboard from './components/Leaderboard'
import GlobalCounter from './components/GlobalCounter'
import ConnectionStatus from './components/ConnectionStatus'
import ErrorBoundary from './components/ErrorBoundary'
import { fetchCities, fetchLeaderboard, fetchMe } from './api'
import { useWebSocket } from './hooks/useWebSocket'
import { useClickHandler } from './hooks/useClickHandler'
import type { City, User, CityUpdate } from './types'

const LEADERBOARD_REFRESH_MS = 3000

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulsingCityId, setPulsingCityId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<City[]>([])
  const [onboardingState, setOnboardingState] = useState<'hidden' | 'visible' | 'fading'>('hidden')
  const leaderboardTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Load cities + check existing session
  useEffect(() => {
    Promise.all([fetchCities(), fetchMe(), fetchLeaderboard(10)])
      .then(([citiesData, userData, leaderboardData]) => {
        setCities(citiesData)
        setLeaderboard(leaderboardData)
        if (userData) {
          setUser(userData)

          const home = citiesData.find(c => c.id === userData.cityId)
          if (home) setSelectedCity(home)
        } else {
          setOnboardingState('visible')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Cleanup leaderboard timer
  useEffect(() => {
    return () => clearTimeout(leaderboardTimer.current)
  }, [])

  // Throttled leaderboard refresh (at most once per LEADERBOARD_REFRESH_MS)
  const refreshLeaderboard = useCallback(() => {
    if (leaderboardTimer.current) return
    leaderboardTimer.current = setTimeout(() => {
      fetchLeaderboard(10).then(setLeaderboard).catch(() => {})
      leaderboardTimer.current = undefined
    }, LEADERBOARD_REFRESH_MS)
  }, [])

  // Handle WS city updates
  const onCityUpdate = useCallback((update: CityUpdate) => {
    setCities(prev =>
      prev.map(c =>
        c.id === update.cityId
          ? { ...c, totalClicks: update.totalClicks, contributorCount: update.contributorCount }
          : c
      )
    )
    setSelectedCity(prev =>
      prev && prev.id === update.cityId
        ? { ...prev, totalClicks: update.totalClicks, contributorCount: update.contributorCount }
        : prev
    )
    // Pulse effect via rings
    setPulsingCityId(update.cityId)
    setTimeout(() => setPulsingCityId(null), 1500)
    // Throttled leaderboard refresh
    refreshLeaderboard()
  }, [refreshLeaderboard])

  const ws = useWebSocket(user, onCityUpdate)

  const { handleClick, personalClicks, rateLimited } = useClickHandler(ws, user, () => {
    // Optimistic update for own clicks
    if (user) {
      setCities(prev =>
        prev.map(c =>
          c.id === user.cityId
            ? { ...c, totalClicks: c.totalClicks + 1 }
            : c
        )
      )
    }
  })

  const handleCitySelect = useCallback((city: City) => {
    setSelectedCity(city)
  }, [])

  const handleRegistered = useCallback((newUser: User) => {
    setUser(newUser)
    const home = cities.find(c => c.id === newUser.cityId)
    if (home) setSelectedCity(home)
    // Fade out onboarding
    setOnboardingState('fading')
    setTimeout(() => setOnboardingState('hidden'), 400)
  }, [cities])

  const userCity = user ? cities.find(c => c.id === user.cityId) : null
  const totalGlobalClicks = useMemo(
    () => cities.reduce((sum, c) => sum + c.totalClicks, 0),
    [cities],
  )
  const selectedCityRank = selectedCity
    ? leaderboard.findIndex(c => c.id === selectedCity.id) + 1
    : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--gold)' }}>
        Loading...
      </div>
    )
  }

  return (
    <>
      <ErrorBoundary>
        <Globe
          cities={cities}
          userCityId={user?.cityId ?? null}
          onCityClick={handleCitySelect}
          selectedCityId={selectedCity?.id ?? null}
          pulsingCityId={pulsingCityId}
        />
      </ErrorBoundary>

      <div className="logo">CLICKCITY</div>

      <GlobalCounter total={totalGlobalClicks} />

      <Leaderboard cities={leaderboard} />

      {user && selectedCity && (
        <InfoPanel
          city={selectedCity}
          isHome={selectedCity.id === user.cityId}
          userClicks={selectedCity.id === user.cityId ? (user.totalClicks + personalClicks) : undefined}
          rank={selectedCityRank}
        />
      )}

      {user && (
        <ClickButton
          onClick={handleClick}
          personalClicks={user.totalClicks + personalClicks}
          cityName={userCity?.name}
          rateLimited={rateLimited}
        />
      )}

      {user && <ConnectionStatus state={ws.connectionState} />}

      {onboardingState !== 'hidden' && (
        <Onboarding
          cities={cities}
          onRegistered={handleRegistered}
          fading={onboardingState === 'fading'}
        />
      )}
    </>
  )
}
