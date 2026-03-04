import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import BuildingViz from './BuildingViz'

describe('BuildingViz', () => {
  it('renders nothing for zero clicks', () => {
    const { container } = render(<BuildingViz totalClicks={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for clicks below first tier', () => {
    const { container } = render(<BuildingViz totalClicks={5000} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders blocks for clicks at first tier', () => {
    const { container } = render(<BuildingViz totalClicks={10000} />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBe(1)
  })

  it('renders multiple blocks for large click counts', () => {
    const { container } = render(<BuildingViz totalClicks={35000} />)
    const rects = container.querySelectorAll('rect')
    // 3 x 10k = 30k (5k remaining below any tier) → 3 blocks
    expect(rects.length).toBe(3)
  })
})
