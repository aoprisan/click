import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { game } from './client'
import { useGameClient } from './hooks/useGameClient'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import type { City, Operator } from './types'
import { getBuilding } from './game/catalog'
import { clickEffectiveness } from './game/happiness'
import type { TradeArc } from './components/Globe'
import Globe from './components/Globe'
import Onboarding from './components/Onboarding'
import CityPanel from './components/CityPanel'
import BuildPanel from './components/BuildPanel'
import Tutorial from './components/Tutorial'
import MarketPanel from './components/MarketPanel'
import TradePanel from './components/TradePanel'
import Leaderboard from './components/Leaderboard'
import ShopPanel from './components/ShopPanel'
import ClickButton from './components/ClickButton'
import ToastSystem from './components/ToastSystem'
import type { Toast } from './components/ToastSystem'
import PwaPrompts from './components/PwaPrompts'

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [operator, setOperator] = useState<Operator | null>(null)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [activeBuildingId, setActiveBuildingId] = useState('crop-farm')
  const [meter, setMeter] = useState(1)
  const [blocked, setBlocked] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [booted, setBooted] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [arcs, setArcs] = useState<TradeArc[]>([])
  const [hudHidden, setHudHidden] = useState(false)
  const toastSeq = useRef(0)
  const arcSeq = useRef(0)
  const lastProdToast = useRef(0)
  const cityRef = useRef<Map<string, City>>(new Map())
  const pwa = usePwaUpdate()

  // A slow clock so active-boost countdowns tick down in the UI.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const pushToast = useCallback((tag: string, text: string, tone: Toast['tone']) => {
    const id = ++toastSeq.current
    setToasts(prev => [...prev.slice(-6), { id, tag, text, tone }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  // initial load
  useEffect(() => {
    let alive = true
    Promise.all([game.listCities(), game.me()]).then(([cs, me]) => {
      if (!alive) return
      setCities(cs)
      if (me) { setOperator(me); setSelectedCityId(me.homeCityId) }
      setBooted(true)
    })
    return () => { alive = false }
  }, [])

  const homeId = operator?.homeCityId ?? null

  // Keep a live id→city map for coordinate lookups (globe arcs) without
  // re-creating the trade handler on every city tick.
  useEffect(() => { cityRef.current = new Map(cities.map(c => [c.id, c])) }, [cities])

  useGameClient({
    onCityUpdate: c => setCities(prev => {
      const i = prev.findIndex(x => x.id === c.id)
      if (i < 0) return [...prev, c]
      const next = prev.slice()
      next[i] = c
      return next
    }),
    onOperatorUpdate: o => setOperator(o),
    onThrottle: t => {
      setMeter(t.capacity > 0 ? t.remaining / t.capacity : 0)
      if (t.blocked) { setBlocked(true); setTimeout(() => setBlocked(false), 1500) }
    },
    onBuildingBuilt: b => { if (b.cityId === homeId) pushToast('BUILT', `${b.buildingName} is operational`, 'build') },
    onTrade: t => {
      if (t.kind === 'gift' && t.cityId === homeId) {
        pushToast('GIFT', `Gifted ${t.qty} ${t.resource} to ${t.counterpartyName}`, 'good')
      } else if (t.cityId === homeId) {
        const verb = t.kind === 'market_sell' ? 'Sold' : 'Bought'
        pushToast('TRADE', `${verb} ${t.qty} ${t.resource}`, 'trade')
      } else if (t.counterpartyName && homeId && cities.find(c => c.id === homeId)?.name === t.counterpartyName) {
        pushToast('TRADE', `${t.cityName} bought ${t.qty} ${t.resource} from you`, 'trade')
      }
      if (t.counterpartyId) addArc(t.cityId, t.counterpartyId, t.kind)
    },
    onProduction: p => {
      if (p.cityId !== homeId) return
      // throttle so a flurry of clicks doesn't bury the toast stack
      const t = Date.now()
      if (t - lastProdToast.current < 1200) return
      lastProdToast.current = t
      pushToast('PROD', `▲ ${Math.round(p.qty)} ${p.output}`, 'build')
    },
    onNotice: n => pushToast(n.tone === 'warn' ? 'WARN' : 'INFO', n.text, n.tone === 'warn' ? 'warn' : 'info'),
  })

  // A transient great-circle arc between two trading cities, fading off the globe.
  const addArc = useCallback((aId: string, bId: string, kind: TradeArc['kind']) => {
    setArcs(prev => {
      const ca = cityRef.current.get(aId), cb = cityRef.current.get(bId)
      if (!ca || !cb) return prev
      const id = ++arcSeq.current
      const arc: TradeArc = {
        id, kind,
        startLat: ca.lat, startLng: ca.lng, endLat: cb.lat, endLng: cb.lng,
      }
      setTimeout(() => setArcs(p => p.filter(x => x.id !== id)), 5000)
      return [...prev.slice(-13), arc]
    })
  }, [])

  const homeCity = useMemo(() => cities.find(c => c.id === homeId) ?? null, [cities, homeId])
  const selectedCity = useMemo(
    () => cities.find(c => c.id === selectedCityId) ?? homeCity,
    [cities, selectedCityId, homeCity],
  )

  const handleRegister = useCallback((name: string, cityId: string) => {
    game.register(name, cityId).then(op => {
      setOperator(op)
      setSelectedCityId(cityId)
      setActiveBuildingId('crop-farm')
      pushToast('CITY', `Founded operations in your city`, 'good')
    })
  }, [pushToast])

  const handleClick = useCallback(() => game.click(activeBuildingId), [activeBuildingId])

  const activeBuildingName = getBuilding(activeBuildingId)?.name ?? activeBuildingId
  const multiplier = operator?.activeMultiplier && now < operator.activeMultiplier.expiresAt ? operator.activeMultiplier.factor : 1
  const autoclicking = !!(operator?.autoclickerUntil && now < operator.autoclickerUntil)
  // Units the next click is worth right now — scales live with happiness × drink (§7).
  const unitsPerClick = homeCity ? clickEffectiveness(homeCity.happiness) * multiplier : multiplier

  return (
    <>
      <div className="logo">
        <span className="logo-main">GLOBAL CONFLICT</span>
        <span className="logo-sub">CITY ECONOMY · V2</span>
      </div>

      {booted && (
        <button
          className={`hud-toggle${hudHidden ? ' collapsed' : ''}`}
          onClick={() => setHudHidden(h => !h)}
          aria-pressed={hudHidden}
          title={hudHidden ? 'Show panels' : 'Hide panels'}
        >
          <span className="hud-toggle-icon" aria-hidden="true">{hudHidden ? '▣' : '▢'}</span>
          {hudHidden ? 'Show panels' : 'Hide panels'}
        </button>
      )}

      <Globe
        cities={cities}
        homeCityId={homeId}
        selectedCityId={selectedCityId}
        arcs={arcs}
        onCityClick={c => setSelectedCityId(c.id)}
      />

      {!hudHidden && booted && cities.length > 0 && <WorldReadout cities={cities} />}

      {!hudHidden && <Leaderboard cities={cities} homeCityId={homeId} onSelect={c => setSelectedCityId(c.id)} />}

      {!hudHidden && selectedCity && <CityPanel city={selectedCity} isHome={selectedCity.id === homeId} />}

      {homeCity && (
        <>
          {!hudHidden && <div className="hud-left">
            <BuildPanel
              city={homeCity}
              activeBuildingId={activeBuildingId}
              onSelectActive={setActiveBuildingId}
              onBuild={id => game.startBuild(id)}
              onUpgrade={id => game.startUpgrade(id)}
            />
          </div>}

          {!hudHidden && <div className="right-stack">
            <MarketPanel
              city={homeCity}
              onSell={(r, q) => game.sellToMarket(r, q)}
              onBuy={(r, q) => game.buyFromMarket(r, q)}
            />
            <TradePanel
              home={homeCity}
              cities={cities}
              onBuyOffer={(id, q) => game.buyOffer(id, q)}
              onPostOffer={(r, q, p) => game.postOffer(r, q, p)}
              onCancelOffer={id => game.cancelOffer(id)}
              onGift={(toId, r, q) => game.giftResource(toId, r, q)}
            />
            {operator && (
              <ShopPanel
                operator={operator}
                cities={cities}
                now={now}
                onBuy={id => game.buyItem(id)}
                onUse={id => game.useItem(id)}
                onMove={id => game.moveHomeCity(id)}
              />
            )}
          </div>}

          <ClickButton
            onClick={handleClick}
            totalUnits={operator?.totalUnits ?? 0}
            activeBuildingName={activeBuildingName}
            unitsPerClick={unitsPerClick}
            meter={meter}
            blocked={blocked}
            multiplier={multiplier}
            autoclicking={autoclicking}
          />
        </>
      )}

      {homeCity && operator && <Tutorial city={homeCity} operator={operator} />}

      <ToastSystem toasts={toasts} />
      <PwaPrompts pwa={pwa} />

      {booted && !operator && <Onboarding cities={cities} onRegister={handleRegister} />}
      {!booted && <div className="boot-screen">INITIALIZING</div>}
    </>
  )
}

function WorldReadout({ cities }: { cities: City[] }) {
  const worldPop = cities.reduce((a, c) => a + c.population, 0)
  const offers = cities.reduce((a, c) => a + c.offers.length, 0)
  return (
    <div className="global-counter">
      <div className="gc-label">World Population</div>
      <div className="gc-value">{Math.round(worldPop).toLocaleString()}</div>
      <div className="gc-meta">
        <span>{cities.length} cities</span>
        <span className="amber">{offers} offers</span>
      </div>
    </div>
  )
}
