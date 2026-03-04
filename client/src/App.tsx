import { useState, useEffect, useCallback, useRef } from 'react'
import Globe from './components/Globe'
import Onboarding from './components/Onboarding'
import ClickButton from './components/ClickButton'
import InfoPanel from './components/InfoPanel'
import Leaderboard from './components/Leaderboard'
import GlobalCounter from './components/GlobalCounter'
import ConnectionStatus from './components/ConnectionStatus'
import ErrorBoundary from './components/ErrorBoundary'
import { fetchCities, fetchMe } from './api'
import { useWebSocket } from './hooks/useWebSocket'
import { useClickHandler } from './hooks/useClickHandler'
import type { City, User, CityUpdate } from './types'

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulsingCityId, setPulsingCityId] = useState<string | null>(null)
  const citiesRef = useRef(cities)
  citiesRef.current = cities

  // Load cities + check existing session
  useEffect(() => {
    Promise.all([fetchCities(), fetchMe()])
      .then(([citiesData, userData]) => {
        setCities(citiesData)
        if (userData) {
          setUser(userData)
          const home = citiesData.find(c => c.id === userData.cityId)
          if (home) setSelectedCity(home)
        }
      })
      .finally(() => setLoading(false))
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
    // Pulse effect
    setPulsingCityId(update.cityId)
    setTimeout(() => setPulsingCityId(null), 300)
  }, [])

  const ws = useWebSocket(user, onCityUpdate)

  const { handleClick, personalClicks } = useClickHandler(ws, user, (update) => {
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

  const handleCityClick = useCallback((city: City) => {
    setSelectedCity(city)
  }, [])

  const handleRegistered = useCallback((newUser: User) => {
    setUser(newUser)
    const home = cities.find(c => c.id === newUser.cityId)
    if (home) setSelectedCity(home)
  }, [cities])

  const userCity = user ? cities.find(c => c.id === user.cityId) : null
  const totalGlobalClicks = cities.reduce((sum, c) => sum + c.totalClicks, 0)
  const sortedByClicks = [...cities].filter(c => c.totalClicks > 0).sort((a, b) => b.totalClicks - a.totalClicks)
  const leaderboard = sortedByClicks.slice(0, 10)
  const selectedCityRank = selectedCity ? sortedByClicks.findIndex(c => c.id === selectedCity.id) + 1 : 0

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
          onCityClick={handleCityClick}
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
        />
      )}

      {user && <ConnectionStatus state={ws.connectionState} />}

      {!user && (
        <Onboarding cities={cities} onRegistered={handleRegistered} />
      )}
    </>
  )
}
