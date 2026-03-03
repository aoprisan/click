interface GlobalCounterProps {
  total: number
}

export default function GlobalCounter({ total }: GlobalCounterProps) {
  return (
    <div style={{
      position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
        Global Clicks
      </div>
      <div className="mono" style={{ fontSize: 20, color: 'var(--gold)', fontWeight: 700 }}>
        {total.toLocaleString()}
      </div>
    </div>
  )
}
