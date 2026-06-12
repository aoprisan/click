import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import GlobeGL from 'react-globe.gl'
import * as topojson from 'topojson-client'
import type { City } from '../types'

const ATLAS_URL = `${import.meta.env.BASE_URL}countries-110m.json`

/** A transient trade/gift link drawn as a great-circle arc on the globe (§8). */
export interface TradeArc {
  id: number
  kind: 'market_sell' | 'market_buy' | 'offer_buy' | 'gift'
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}

interface GlobeProps {
  cities: City[]
  homeCityId: string | null
  selectedCityId: string | null
  arcs?: TradeArc[]
  onCityClick: (city: City) => void
}

// Color a city by happiness: red (miserable) → amber → green (thriving).
function happinessColor(happiness: number, alpha = 0.8): string {
  const h = Math.max(0, Math.min(100, happiness))
  const hue = Math.round((h / 100) * 130) // 0 = red, 130 = green
  return `hsla(${hue}, 85%, 55%, ${alpha})`
}

const ARC_COLOR: Record<TradeArc['kind'], string> = {
  gift: '#ffb000',
  offer_buy: '#4be37a',
  market_sell: '#4be37a',
  market_buy: '#4be37a',
}

export default function Globe({ cities, homeCityId, selectedCityId, arcs = [], onCityClick }: GlobeProps) {
  const globeRef = useRef<any>(null)
  const polygonsRef = useRef<any[]>([])
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => setDimensions({ width: window.innerWidth, height: window.innerHeight }), 150)
    }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeout) }
  }, [])

  useEffect(() => {
    fetch(ATLAS_URL)
      .then(r => r.json())
      .then(world => {
        const countries = topojson.feature(world, world.objects.countries)
        polygonsRef.current = (countries as any).features
        if (globeRef.current) globeRef.current.polygonsData(polygonsRef.current)
      })
      .catch(() => { /* offline / missing atlas — globe still renders points */ })
  }, [])

  useEffect(() => {
    if (!globeRef.current) return
    const controls = globeRef.current.controls()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.4
      controls.enableDamping = false
    }
  }, [])

  useEffect(() => {
    if (!globeRef.current || !homeCityId) return
    const city = cities.find(c => c.id === homeCityId)
    if (city) {
      setTimeout(() => {
        globeRef.current?.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.6 }, 1500)
      }, 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCityId])

  const maxPop = useMemo(() => Math.max(1, ...cities.map(c => c.population)), [cities])

  const pointAltitude = useCallback((d: any) => {
    const c = d as City
    if (c.population <= 0) return 0.002
    return 0.002 + 0.06 * Math.log10(c.population) / Math.log10(Math.max(10, maxPop))
  }, [maxPop])

  const pointColor = useCallback((d: any) => {
    const c = d as City
    if (c.id === homeCityId) return '#ffb000'
    if (c.id === selectedCityId) return '#ff4536'
    // Everyone else is tinted by happiness — the planet reads as a heat-map of
    // thriving (green) vs struggling (red) cities, dim if depopulated (§8).
    return c.population > 0 ? happinessColor(c.happiness, 0.75) : '#4be37a30'
  }, [homeCityId, selectedCityId])

  const pointRadius = useCallback((d: any) => {
    const c = d as City
    const base = 0.12 + 0.4 * Math.log10(Math.max(1, c.population)) / Math.log10(Math.max(10, maxPop))
    return c.id === homeCityId ? base + 0.15 : base
  }, [homeCityId, maxPop])

  const handlePointClick = useCallback((point: any) => {
    const c = point as City
    onCityClick(c)
    globeRef.current?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.8 }, 800)
  }, [onCityClick])

  const pointLabel = useCallback((d: any) => {
    const c = d as City
    return `<div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#d4dcc6;text-align:center;background:rgba(8,11,7,0.85);border:1px solid rgba(255,176,0,0.3);padding:4px 10px;">
      <b>${c.name}</b>, ${c.country}<br/>
      <span style="color:#ffb000;">pop ${Math.round(c.population).toLocaleString()}</span>
      <span style="color:${happinessColor(c.happiness)};"> · ☺ ${c.happiness}%</span>
    </div>`
  }, [])

  return (
    <GlobeGL
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      polygonsData={polygonsRef.current}
      polygonCapColor={() => 'rgba(28, 42, 18, 0.55)'}
      polygonSideColor={() => 'rgba(120, 160, 80, 0.12)'}
      polygonStrokeColor={() => 'rgba(180, 220, 140, 0.28)'}
      polygonAltitude={0.005}
      pointsData={cities}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={pointAltitude}
      pointColor={pointColor}
      pointRadius={pointRadius}
      pointLabel={pointLabel}
      onPointClick={handlePointClick}
      pointsTransitionDuration={0}
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={(d: any) => ARC_COLOR[(d as TradeArc).kind] ?? '#4be37a'}
      arcStroke={0.5}
      arcAltitudeAutoScale={0.4}
      arcDashLength={0.5}
      arcDashGap={0.2}
      arcDashAnimateTime={1800}
      arcsTransitionDuration={300}
      atmosphereColor="#2e7d4f"
      atmosphereAltitude={0.18}
      animateIn={true}
      width={dimensions.width}
      height={dimensions.height}
    />
  )
}
