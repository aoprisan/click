interface GlobalCounterProps {
  total: number
}

export default function GlobalCounter({ total }: GlobalCounterProps) {
  return (
    <div className="global-counter">
      <div className="gc-label">Global Clicks</div>
      <div className="gc-value">{total.toLocaleString()}</div>
    </div>
  )
}
