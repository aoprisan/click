import type { City, SubsectionKey } from '../types'

const SECTION_ORDER: SubsectionKey[] = ['housing', 'food', 'energy', 'employment', 'fun', 'luxuries']

export default function CityPanel({ city, isHome }: { city: City; isHome: boolean }) {
  const inv = Object.entries(city.inventory)
    .filter(([, q]) => q >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return (
    <div className="panel city-panel bracketed">
      <div className="panel-head">
        <span className="panel-label panel-label--amber">{isHome ? 'Home City' : 'City Dossier'}</span>
        {isHome && <span className="home-badge">HOME</span>}
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="row"><span className="stat-key">{city.name}</span><span className="stat-val">{city.countryCode}</span></div>
        <div className="stat-row"><span className="stat-key">Population</span><span className="stat-val stat-val--amber">{Math.round(city.population).toLocaleString()} / {city.populationCapacity.toLocaleString()}</span></div>
        <div className="stat-row"><span className="stat-key">Cash</span><span className="stat-val cash-chip">${Math.round(city.cash).toLocaleString()}</span></div>
        <div className="stat-row"><span className="stat-key">Happiness</span><span className="stat-val stat-val--green">{city.happiness}%</span></div>
      </div>

      <div className={`happy-bar${city.happiness < 50 ? ' low' : ''}`} style={{ margin: '6px 0 10px' }}>
        <span style={{ width: `${city.happiness}%` }} />
      </div>

      <div className="section-grid">
        {SECTION_ORDER.filter(k => city.happinessBySection[k] !== undefined).map(k => (
          <div key={k} className="row">
            <span className="muted" style={{ textTransform: 'capitalize' }}>{k}</span>
            <span className={city.happinessBySection[k]! < 40 ? 'red' : 'green'}>{city.happinessBySection[k]}%</span>
          </div>
        ))}
      </div>

      <hr className="rule" />
      <span className="panel-label">Inventory</span>
      <div className="inv-list scroll-y" style={{ maxHeight: 150, marginTop: 6 }}>
        {inv.length === 0 && <span className="muted tiny">empty</span>}
        {inv.map(([r, q]) => (
          <div key={r} className="inv-row"><span>{r}</span><span className="q">{Math.round(q).toLocaleString()}</span></div>
        ))}
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>
        Produces: {city.countryResources.join(', ')}
      </div>
    </div>
  )
}
