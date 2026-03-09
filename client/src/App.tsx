import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Globe from './components/Globe'
import Onboarding from './components/Onboarding'
import ClickButton from './components/ClickButton'
import InfoPanel from './components/InfoPanel'
import Leaderboard from './components/Leaderboard'
import GlobalDataPanel from './components/GlobalDataPanel'
import ConnectionStatus from './components/ConnectionStatus'
import ToastSystem, { useToasts } from './components/ToastSystem'
import PlayerPanel from './components/PlayerPanel'
import MissilePanel from './components/MissilePanel'
import SubscriptionPanel from './components/SubscriptionPanel'
import ErrorBoundary from './components/ErrorBoundary'
import { fetchCities, fetchLeaderboard, fetchMe, fetchStats, fireMissile } from './api'
import { useWebSocket } from './hooks/useWebSocket'
import { useClickHandler } from './hooks/useClickHandler'
import type { City, User, CityUpdate, CityClick, MissileStrikeData, AchievementEarnedData, GlobalStats, GameMode, Missile } from './types'

const LEADERBOARD_REFRESH_MS = 3000

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [loading, setLoading] = useState(true)
  const [pulsingCityId, setPulsingCityId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<City[]>([])
  const [onboardingState, setOnboardingState] = useState<'hidden' | 'visible' | 'fading'>('hidden')
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [missileRefreshKey, setMissileRefreshKey] = useState(0)
  const [targetingMissile, setTargetingMissile] = useState<Missile | null>(null)
  const leaderboardTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const { toasts, addToast } = useToasts()

  // Derive game mode from user state
  const gameMode: GameMode = user
    ? (user.role === 'warrior' ? 'warrior' : 'builder')
    : 'spectator'

  // Load cities + check existing session
  useEffect(() => {
    Promise.all([fetchCities(), fetchMe(), fetchLeaderboard(10), fetchStats()])
      .then(([citiesData, userData, leaderboardData, statsData]) => {
        setCities(citiesData)
        setLeaderboard(leaderboardData)
        setGlobalStats(statsData)
        if (userData) {
          setUser(userData)
          const home = citiesData.find(c => c.id === userData.cityId)
          if (home) setSelectedCity(home)
        } else {
          // Spectator: auto-select #1 city from leaderboard
          if (leaderboardData.length > 0) {
            const topCity = citiesData.find(c => c.id === leaderboardData[0].id)
            if (topCity) setSelectedCity(topCity)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Cleanup leaderboard timer
  useEffect(() => {
    return () => clearTimeout(leaderboardTimer.current)
  }, [])

  // Throttled leaderboard refresh
  const refreshLeaderboard = useCallback(() => {
    if (leaderboardTimer.current) return
    leaderboardTimer.current = setTimeout(() => {
      fetchLeaderboard(10).then(setLeaderboard).catch(() => {})
      fetchStats().then(setGlobalStats).catch(() => {})
      leaderboardTimer.current = undefined
    }, LEADERBOARD_REFRESH_MS)
  }, [])

  // Ref for reconcile to avoid ordering issues (onCityUpdate defined before useClickHandler)
  const reconcileRef = useRef<(serverTotal: number) => void>(() => {})

  // Handle WS city updates
  const onCityUpdate = useCallback((update: CityUpdate) => {
    setCities(prev =>
      prev.map(c =>
        c.id === update.cityId
          ? { ...c, totalClicks: update.totalClicks, contributorCount: update.contributorCount, highestEverPopulation: update.highestEverPopulation }
          : c
      )
    )
    setSelectedCity(prev =>
      prev && prev.id === update.cityId
        ? { ...prev, totalClicks: update.totalClicks, contributorCount: update.contributorCount, highestEverPopulation: update.highestEverPopulation }
        : prev
    )
    // Reconcile personal click counter with server truth
    if (user && update.cityId === user.cityId) {
      reconcileRef.current(update.totalClicks)
    }
    setPulsingCityId(update.cityId)
    setTimeout(() => setPulsingCityId(null), 1500)
    refreshLeaderboard()
  }, [refreshLeaderboard, user])

  const onCityClick = useCallback((click: CityClick) => {
    if (user && click.cityId === user.cityId) {
      addToast(`${click.userName} grew your city!`, 'click')
    }
  }, [user, addToast])

  const citiesRef = useRef(cities)
  citiesRef.current = cities

  const onMissileStrike = useCallback((strike: MissileStrikeData) => {
    if (user && strike.targetCityId === user.cityId) {
      addToast(`${strike.damage.toLocaleString()} killed by missile from ${strike.attackerCityName}`, 'missile_incoming')
    } else {
      const targetCity = citiesRef.current.find(c => c.id === strike.targetCityId)
      const targetName = targetCity ? targetCity.name : 'unknown'
      addToast(`${strike.damage.toLocaleString()} killed in ${targetName}`, 'missile_strike')
    }
    setMissileRefreshKey(k => k + 1)
  }, [user, addToast])

  const onAchievement = useCallback((data: AchievementEarnedData) => {
    let msg = `Achievement: ${data.achievementName}`
    if (data.missileType) {
      msg += `. New missile available, ${data.missileType}`
    }
    addToast(msg, 'achievement')
    setMissileRefreshKey(k => k + 1)
  }, [addToast])

  const onMissileAwarded = useCallback((data: { missileType: string; source: string }) => {
    addToast(`New missile available, ${data.missileType}`, 'missile_awarded')
    setMissileRefreshKey(k => k + 1)
  }, [addToast])

  const onMissileUpgraded = useCallback((data: { missileType: string; source: string }) => {
    addToast(`Missile upgraded to ${data.missileType}!`, 'missile_awarded')
    setMissileRefreshKey(k => k + 1)
  }, [addToast])

  const ws = useWebSocket(user, onCityUpdate, onCityClick, onMissileStrike, onAchievement, onMissileAwarded, onMissileUpgraded)

  const { handleClick, personalClicks, pendingClicks, rateLimited, multiplier, reconcile } = useClickHandler(ws, user, () => {
    // Optimistic update for own clicks
    if (user) {
      const mult = gameMode === 'warrior' ? 2 : 1
      setCities(prev =>
        prev.map(c =>
          c.id === user.cityId
            ? { ...c, totalClicks: c.totalClicks + mult }
            : c
        )
      )
    }
  }, gameMode)
  reconcileRef.current = reconcile

  const handleFireAtCity = useCallback(async (missile: Missile, targetCity: City) => {
    setTargetingMissile(null)
    try {
      const result = await fireMissile(missile.id, targetCity.id)
      addToast(`${result.damage.toLocaleString()} killed in ${result.targetCity}`, 'missile_strike')
      setMissileRefreshKey(k => k + 1)
    } catch (e) {
      addToast(`Fire failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'missile_strike')
    }
  }, [addToast])

  const handleCitySelect = useCallback((city: City) => {
    if (targetingMissile) {
      // In targeting mode: fire missile at selected city
      handleFireAtCity(targetingMissile, city)
      return
    }
    setSelectedCity(city)
  }, [targetingMissile, handleFireAtCity])

  const handleFireMissile = useCallback((missile: Missile) => {
    setTargetingMissile(missile)
    addToast(`Select a target city within ${missile.rangeKm}km range`, 'missile_awarded')
  }, [addToast])

  const handleRegistered = useCallback((newUser: User) => {
    setUser(newUser)
    const home = cities.find(c => c.id === newUser.cityId)
    if (home) setSelectedCity(home)
    setOnboardingState('fading')
    setTimeout(() => setOnboardingState('hidden'), 400)
  }, [cities])

  const handleSubscriptionUpgraded = useCallback(() => {
    // Refresh user to get updated role
    fetchMe().then(u => { if (u) setUser(u) }).catch(() => {})
  }, [])

  const handleSpectatorLogin = useCallback(() => {
    setOnboardingState('visible')
  }, [])

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

      <div className="logo">GLOBAL CONFLICT</div>

      <GlobalDataPanel stats={globalStats} totalPopulation={totalGlobalClicks} />

      <ToastSystem toasts={toasts} />

      <Leaderboard cities={leaderboard} />

      {selectedCity && (
        <InfoPanel
          city={selectedCity}
          isHome={user ? selectedCity.id === user.cityId : false}
          userClicks={user && selectedCity.id === user.cityId ? personalClicks : undefined}
          rank={selectedCityRank}
        />
      )}

      {user && (
        <PlayerPanel
          user={user}
          gameMode={gameMode}
          personalClicks={personalClicks}
          cityName={userCity?.name}
        />
      )}

      <MissilePanel
        gameMode={gameMode}
        onFireMissile={handleFireMissile}
        refreshKey={missileRefreshKey}
      />

      <SubscriptionPanel
        gameMode={gameMode}
        onUpgraded={handleSubscriptionUpgraded}
      />

      <ClickButton
        onClick={gameMode === 'spectator' ? handleSpectatorLogin : handleClick}
        personalClicks={user ? personalClicks : 0}
        cityName={userCity?.name}
        rateLimited={rateLimited}
        gameMode={gameMode}
        multiplier={multiplier}
      />

      <ConnectionStatus state={ws.connectionState} />

      {onboardingState !== 'hidden' && (
        <Onboarding
          cities={cities}
          onRegistered={handleRegistered}
          fading={onboardingState === 'fading'}
        />
      )}

      {targetingMissile && (
        <div className="targeting-overlay" style={{
          position: 'absolute', bottom: 160, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, background: 'rgba(248, 113, 113, 0.2)', border: '1px solid rgba(248, 113, 113, 0.4)',
          borderRadius: 8, padding: '8px 16px', fontSize: 12, color: '#f87171',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span>Targeting: {targetingMissile.missileType} ({targetingMissile.rangeKm}km)</span>
          <button
            onClick={() => setTargetingMissile(null)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4, padding: '2px 8px', color: 'var(--text)', cursor: 'pointer', fontSize: 11,
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </>
  )
}
