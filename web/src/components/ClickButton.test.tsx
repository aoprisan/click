import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ClickButton from './ClickButton'

const base = {
  totalUnits: 0,
  activeBuildingName: 'Crop Farm',
  unitsPerClick: 1,
  meter: 1,
  blocked: false,
  multiplier: 1,
  autoclicking: false,
}

describe('ClickButton', () => {
  it('calls onClick when pressed', () => {
    const onClick = vi.fn()
    render(<ClickButton {...base} onClick={onClick} />)
    fireEvent.click(screen.getByText('GROW'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies the expanded class when panels are collapsed', () => {
    const { container } = render(<ClickButton {...base} onClick={vi.fn()} expanded />)
    expect(container.querySelector('.click-button-area')).toHaveClass('expanded')
  })

  it('keeps normal size (no expanded class) when panels are visible', () => {
    const { container } = render(<ClickButton {...base} onClick={vi.fn()} />)
    expect(container.querySelector('.click-button-area')).not.toHaveClass('expanded')
  })
})
