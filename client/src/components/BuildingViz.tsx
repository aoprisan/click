interface BuildingVizProps {
  totalClicks: number
}

// Tier thresholds: how many clicks per block (phosphor-amber ramp, dim → bright)
const TIERS = [
  { threshold: 10_000, color: '#523a08' },
  { threshold: 25_000, color: '#8a610a' },
  { threshold: 50_000, color: '#c2880c' },
  { threshold: 100_000, color: '#ffb000' },
]

const BLOCK_W = 22
const BLOCK_H = 16
const GAP = 2

interface Block {
  tier: number
  color: string
}

function computeBlocks(totalClicks: number): Block[] {
  const blocks: Block[] = []
  let remaining = totalClicks

  for (const tier of TIERS) {
    while (remaining >= tier.threshold) {
      blocks.push({ tier: TIERS.indexOf(tier), color: tier.color })
      remaining -= tier.threshold
    }
  }
  return blocks
}

// Pyramid layout: row 0 (bottom) has maxWidth blocks, row 1 has maxWidth-1, etc.
// A block can stack if it has 2 supports below.
function layoutPyramid(blocks: Block[]): { x: number; y: number; color: string }[] {
  if (blocks.length === 0) return []

  // Determine base width: smallest n where n*(n+1)/2 >= blocks.length
  let baseWidth = 1
  while (baseWidth * (baseWidth + 1) / 2 < blocks.length) baseWidth++

  const rows: Block[][] = []
  let placed = 0
  let rowWidth = baseWidth

  while (placed < blocks.length && rowWidth > 0) {
    const rowBlocks = blocks.slice(placed, placed + rowWidth)
    rows.push(rowBlocks)
    placed += rowBlocks.length
    rowWidth--
  }

  const result: { x: number; y: number; color: string }[] = []
  for (let row = 0; row < rows.length; row++) {
    const w = rows[row].length
    const offsetX = (baseWidth - w) * (BLOCK_W + GAP) / 2
    for (let col = 0; col < w; col++) {
      result.push({
        x: offsetX + col * (BLOCK_W + GAP),
        y: (rows.length - 1 - row) * (BLOCK_H + GAP),
        color: rows[row][col].color,
      })
    }
  }
  return result
}

export default function BuildingViz({ totalClicks }: BuildingVizProps) {
  const blocks = computeBlocks(totalClicks)
  const layout = layoutPyramid(blocks)

  if (layout.length === 0) return null

  const maxX = Math.max(...layout.map(b => b.x + BLOCK_W))
  const maxY = Math.max(...layout.map(b => b.y + BLOCK_H))
  const svgW = maxX + 4
  const svgH = maxY + 4

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ maxHeight: 120 }}
    >
      {layout.map((block, i) => (
        <rect
          key={i}
          x={block.x + 2}
          y={block.y + 2}
          width={BLOCK_W}
          height={BLOCK_H}
          fill={block.color}
          rx={0}
        />
      ))}
    </svg>
  )
}
