import { useState, useMemo } from 'react'
import { register } from '../api'
import type { City, User } from '../types'

interface OnboardingProps {
  cities: City[]
  onRegistered: (user: User) => void
  fading?: boolean
}

export default function Onboarding({ cities, onRegistered, fading }: OnboardingProps) {
  const [search, setSearch] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<'city' | 'name'>('city')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return cities.slice(0, 50)
    const q = search.toLowerCase()
    return cities
      .filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .slice(0, 50)
  }, [cities, search])

  const selectedCity = cities.find(c => c.id === selectedCityId)

  const handleSubmit = async () => {
    if (!selectedCityId || !name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await register(name.trim(), selectedCityId)
      onRegistered({ id: res.userId, name: res.name, cityId: res.cityId, totalClicks: 0, role: 'builder', totalKills: 0, best10s: 0, best1day: 0, clickMissileClicks: 0, lastCumulativeThreshold: 0 })
    } catch {
      setError('Registration failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="onboard-overlay" style={{ opacity: fading ? 0 : 1 }}>
      <div className="onboard-card bracketed">
        <div>
          <h2 className="onboard-title">GLOBAL CONFLICT</h2>
          <div className="panel-label" style={{ textAlign: 'center', marginTop: 4 }}>
            Enlistment Terminal
          </div>
        </div>

        {step === 'city' && (
          <>
            <p className="onboard-sub">Pick your city</p>
            <input
              type="text"
              className="field"
              placeholder="Search cities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div className="city-list">
              {filtered.map(city => (
                <button
                  key={city.id}
                  className="city-option"
                  style={city.id === selectedCityId ? { background: 'rgba(255,176,0,0.1)', borderLeftColor: 'var(--amber)' } : undefined}
                  onClick={() => { setSelectedCityId(city.id); setStep('name') }}
                >
                  {city.name}, <span className="dim">{city.country}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <p className="onboard-sub">
              Representing <span className="amber">{selectedCity?.name}, {selectedCity?.country}</span>
            </p>
            <input
              type="text"
              className="field"
              placeholder="Your display name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            {error && <p className="form-error">{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ flex: 1, padding: '10px 0' }} onClick={() => setStep('city')}>
                Back
              </button>
              <button
                className="btn"
                style={{ flex: 2 }}
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? 'Joining...' : 'Join'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
