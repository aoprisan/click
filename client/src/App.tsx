import { useState, useEffect, useCallback, useRef } from 'react'
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
import type { City, User, CityUpdate, CityClick } from './types'

const USER_STORAGE_KEY = 'clickcity_user_id'

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulsingCityId, setPulsingCityId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<City[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingFading, setOnboardingFading] = useState(false)
  const citiesRef = useRef(cities)
  citiesRef.current = cities

  // Load cities + check existing session
  useEffect(() => {
    Promise.all([fetchCities(), fetchMe(), fetchLeaderboard(10)])
      .then(([citiesData, userData, leaderboardData]) => {
        setCities(citiesData)
        setLeaderboard(leaderboardData)
        if (userData) {
          setUser(userData)
          localStorage.setItem(USER_STORAGE_KEY, userData.id)
          const home = citiesData.find(c => c.id === userData.cityId)
          if (home) setSelectedCity(home)
        } else {
          setShowOnboarding(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Refresh leaderboard when cities update
  const refreshLeaderboard = useCallback(() => {
    fetchLeaderboard(10).then(setLeaderboard).catch(() => {})
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
    // Refresh leaderboard from server
    refreshLeaderboard()
  }, [refreshLeaderboard])

  // Handle city_click from same-city players (currently used for pulse)
  const onCityClick = useCallback((_click: CityClick) => {
    // Could show a toast or marker animation for same-city teammate clicks
  }, [])

  const ws = useWebSocket(user, onCityUpdate, onCityClick)

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
    localStorage.setItem(USER_STORAGE_KEY, newUser.id)
    const home = cities.find(c => c.id === newUser.cityId)
    if (home) setSelectedCity(home)
    // Fade out onboarding
    setOnboardingFading(true)
    setTimeout(() => {
      setShowOnboarding(false)
      setOnboardingFading(false)
    }, 400)
  }, [cities])

  const userCity = user ? cities.find(c => c.id === user.cityId) : null
  const totalGlobalClicks = cities.reduce((sum, c) => sum + c.totalClicks, 0)
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

      {showOnboarding && (
        <Onboarding
          cities={cities}
          onRegistered={handleRegistered}
          fading={onboardingFading}
        />
      )}
    </>
  )
}
