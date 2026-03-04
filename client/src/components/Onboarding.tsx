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
      onRegistered({ id: res.userId, name: res.name, cityId: res.cityId, totalClicks: 0 })
    } catch {
      setError('Registration failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.4s ease-out',
    }}>
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 32, width: 400, maxWidth: '90vw',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontSize: 18, textAlign: 'center' }}>
          CLICKCITY
        </h2>

        {step === 'city' && (
          <>
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 14 }}>
              Pick your city
            </p>
            <input
              type="text"
              placeholder="Search cities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
                fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none',
              }}
            />
            <div style={{ overflowY: 'auto', maxHeight: 300, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map(city => (
                <button
                  key={city.id}
                  onClick={() => { setSelectedCityId(city.id); setStep('name') }}
                  style={{
                    background: city.id === selectedCityId ? 'rgba(247,201,72,0.15)' : 'transparent',
                    border: 'none', borderRadius: 6, padding: '8px 12px',
                    color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-sans)', fontSize: 14,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = city.id === selectedCityId ? 'rgba(247,201,72,0.15)' : 'transparent')}
                >
                  {city.name}, <span style={{ color: 'var(--text-dim)' }}>{city.country}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: 14 }}>
              Representing <span style={{ color: 'var(--gold)' }}>{selectedCity?.name}, {selectedCity?.country}</span>
            </p>
            <input
              type="text"
              placeholder="Your display name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
                fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none',
              }}
            />
            {error && <p style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep('city')}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 0', color: 'var(--text-dim)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14,
                }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
                style={{
                  flex: 2, background: 'var(--gold)', border: 'none', borderRadius: 8,
                  padding: '10px 0', color: '#000', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14,
                  opacity: !name.trim() || submitting ? 0.5 : 1,
                }}
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
