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

  it('hides the walk toggle when the device has no motion support', () => {
    const { container } = render(<ClickButton {...base} onClick={vi.fn()} />)
    expect(container.querySelector('.walk-toggle')).toBeNull()
  })

  it('shows the walk toggle and forwards presses without stealing the click', () => {
    const onClick = vi.fn()
    const onToggle = vi.fn()
    render(<ClickButton {...base} onClick={onClick} walk={{ active: false, steps: 0, activity: 'idle', onToggle }} />)
    fireEvent.click(screen.getByText(/MINE WHILE WALKING/))
    expect(onToggle).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows the live step count while walk mining', () => {
    render(<ClickButton {...base} onClick={vi.fn()} walk={{ active: true, steps: 42, activity: 'idle', onToggle: vi.fn() }} />)
    expect(screen.getByText(/WALK MINING · 42/)).toBeInTheDocument()
  })

  it('labels the detected activity — walking vs jogging', () => {
    const { rerender } = render(
      <ClickButton {...base} onClick={vi.fn()} walk={{ active: true, steps: 7, activity: 'walking', onToggle: vi.fn() }} />,
    )
    expect(screen.getByText(/WALKING · 7/)).toBeInTheDocument()
    rerender(
      <ClickButton {...base} onClick={vi.fn()} walk={{ active: true, steps: 8, activity: 'jogging', onToggle: vi.fn() }} />,
    )
    expect(screen.getByText(/JOGGING · 8/)).toBeInTheDocument()
  })
})
