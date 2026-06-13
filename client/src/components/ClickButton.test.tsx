import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ClickButton from './ClickButton'

describe('ClickButton', () => {
  it('renders the button and personal click count', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={42} gameMode="builder" multiplier={1} />)
    expect(screen.getByText('GROW +1')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ClickButton onClick={onClick} personalClicks={0} gameMode="builder" multiplier={1} />)
    fireEvent.click(screen.getByText('GROW +1'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows city name when provided', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} cityName="Berlin" gameMode="builder" multiplier={1} />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
  })

  it('shows rate limit warning when rateLimited', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} rateLimited={true} gameMode="builder" multiplier={1} />)
    expect(screen.getByText('Slow down!')).toBeInTheDocument()
  })

  it('does not show rate limit warning when not limited', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} rateLimited={false} gameMode="builder" multiplier={1} />)
    expect(screen.queryByText('Slow down!')).not.toBeInTheDocument()
  })

  it('formats large click counts with locale separators', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={12345} gameMode="builder" multiplier={1} />)
    expect(screen.getByText('12,345')).toBeInTheDocument()
  })

  it('shows LOGIN for spectators', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} gameMode="spectator" multiplier={1} />)
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
  })

  it('shows GROW +2 for warriors', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} gameMode="warrior" multiplier={2} />)
    expect(screen.getByText('GROW +2')).toBeInTheDocument()
  })

  it('applies the expanded class when panels are collapsed', () => {
    const { container } = render(
      <ClickButton onClick={vi.fn()} personalClicks={0} gameMode="builder" multiplier={1} expanded />,
    )
    expect(container.querySelector('.click-button-area')).toHaveClass('expanded')
  })

  it('keeps normal size (no expanded class) when panels are visible', () => {
    const { container } = render(
      <ClickButton onClick={vi.fn()} personalClicks={0} gameMode="builder" multiplier={1} />,
    )
    expect(container.querySelector('.click-button-area')).not.toHaveClass('expanded')
  })
})
