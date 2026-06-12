import { useMemo, useState } from 'react'
import type { City } from '../types'

interface Props {
  cities: City[]
  onRegister: (name: string, cityId: string) => void
}

export default function Onboarding({ cities, onRegister }: Props) {
  const [step, setStep] = useState<'city' | 'name'>('city')
  const [query, setQuery] = useState('')
  const [cityId, setCityId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...cities].sort((a, b) => b.population - a.population)
    if (!q) return list.slice(0, 40)
    return list.filter(c => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)).slice(0, 40)
  }, [query, cities])

  const chosen = cities.find(c => c.id === cityId)

  function submit() {
    if (!cityId) { setError('Pick a city'); return }
    if (name.trim().length < 2) { setError('Enter a name'); return }
    onRegister(name.trim(), cityId)
  }

  return (
    <div className="onboard-overlay">
      <div className="onboard-card bracketed">
        <div className="onboard-title">ENLISTMENT TERMINAL</div>

        {step === 'city' && (
          <>
            <div className="onboard-sub">Choose a <span className="amber">home city</span> to grow. You'll share it with every other player who picks it.</div>
            <input className="field" autoFocus placeholder="Search city or country…" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="city-list">
              {matches.map(c => (
                <button
                  key={c.id}
                  className="city-option"
                  onClick={() => { setCityId(c.id); setStep('name'); setError('') }}
                >
                  {c.name} <span className="dim">· {c.country} · pop {Math.round(c.population).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <div className="onboard-sub">Operating from <span className="amber">{chosen?.name}</span>. What's your callsign?</div>
            <input className="field" autoFocus placeholder="Your name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            {error && <div className="form-error">{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" onClick={() => setStep('city')}>← Back</button>
              <button className="btn" style={{ flex: 1 }} onClick={submit}>Found my city</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
