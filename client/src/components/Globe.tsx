import { useEffect, useRef, useCallback, useMemo } from 'react'
import GlobeGL from 'react-globe.gl'
import type { City } from '../types'
import * as topojson from 'topojson-client'

const WORLD_ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface GlobeProps {
  cities: City[]
  userCityId: string | null
  onCityClick: (city: City) => void
  selectedCityId: string | null
  pulsingCityId: string | null
}

export default function Globe({ cities, userCityId, onCityClick, selectedCityId, pulsingCityId }: GlobeProps) {
  const globeRef = useRef<any>(null)
  const polygonsRef = useRef<any[]>([])

  // Load country polygons
  useEffect(() => {
    fetch(WORLD_ATLAS_URL)
      .then(r => r.json())
      .then(worldData => {
        const countries = topojson.feature(worldData, worldData.objects.countries)
        polygonsRef.current = (countries as any).features
        if (globeRef.current) {
          globeRef.current.polygonsData(polygonsRef.current)
        }
      })
  }, [])

  // Auto-rotate
  useEffect(() => {
    if (!globeRef.current) return
    const controls = globeRef.current.controls()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.4
    }
  }, [])

  // Fly to user city on mount
  useEffect(() => {
    if (!globeRef.current || !userCityId) return
    const city = cities.find(c => c.id === userCityId)
    if (city) {
      setTimeout(() => {
        globeRef.current.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.5 }, 1500)
      }, 500)
    }
  }, [userCityId, cities])

  // Compute max clicks for log scaling
  const maxClicks = useMemo(() => {
    const max = Math.max(1, ...cities.map(c => c.totalClicks))
    return max
  }, [cities])

  const pointAltitude = useCallback((d: any) => {
    const city = d as City
    if (city.totalClicks === 0) return 0.005
    return 0.005 + 0.3 * Math.log10(city.totalClicks) / Math.log10(Math.max(10, maxClicks))
  }, [maxClicks])

  const pointColor = useCallback((d: any) => {
    const city = d as City
    if (city.id === userCityId) return '#f7c948'
    if (city.id === selectedCityId) return '#ff6b6b'
    return city.totalClicks > 0 ? '#f7c94888' : '#f7c94833'
  }, [userCityId, selectedCityId])

  const pointRadius = useCallback((d: any) => {
    const city = d as City
    if (city.id === userCityId) return 0.35
    if (city.totalClicks > 0) return 0.2 + Math.min(0.3, city.totalClicks / 10000)
    return 0.12
  }, [userCityId])

  const handlePointClick = useCallback((point: any) => {
    const city = point as City
    onCityClick(city)
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: city.lat, lng: city.lng, altitude: 1.8 }, 800)
    }
  }, [onCityClick])

  const pointLabel = useCallback((d: any) => {
    const city = d as City
    return `<div style="font-family: Outfit, sans-serif; font-size: 13px; color: #e8e8f0; text-align: center;">
      <b>${city.name}</b>, ${city.country}<br/>
      <span style="font-family: 'Space Mono', monospace; color: #f7c948;">${city.totalClicks.toLocaleString()} clicks</span>
    </div>`
  }, [])

  // Pulse ring for cities receiving clicks
  const ringsData = useMemo(() => {
    if (!pulsingCityId) return []
    const city = cities.find(c => c.id === pulsingCityId)
    if (!city) return []
    return [{ lat: city.lat, lng: city.lng }]
  }, [pulsingCityId, cities])

  return (
    <GlobeGL
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      // Country borders
      polygonsData={polygonsRef.current}
      polygonCapColor={() => 'rgba(30, 30, 50, 0.6)'}
      polygonSideColor={() => 'rgba(100, 100, 140, 0.1)'}
      polygonStrokeColor={() => 'rgba(200, 200, 255, 0.15)'}
      polygonAltitude={0.005}
      // City points
      pointsData={cities}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={pointAltitude}
      pointColor={pointColor}
      pointRadius={pointRadius}
      pointLabel={pointLabel}
      onPointClick={handlePointClick}
      pointsTransitionDuration={0}
      // Pulse rings for live click activity
      ringsData={ringsData}
      ringLat="lat"
      ringLng="lng"
      ringColor={() => '#f7c948'}
      ringMaxRadius={3}
      ringPropagationSpeed={2}
      ringRepeatPeriod={800}
      // Atmosphere
      atmosphereColor="#3a228a"
      atmosphereAltitude={0.2}
      // Performance
      animateIn={true}
      width={window.innerWidth}
      height={window.innerHeight}
    />
  )
}
