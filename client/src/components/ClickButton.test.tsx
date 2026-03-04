import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ClickButton from './ClickButton'

describe('ClickButton', () => {
  it('renders the button and personal click count', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={42} />)
    expect(screen.getByText('CLICK')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ClickButton onClick={onClick} personalClicks={0} />)
    fireEvent.click(screen.getByText('CLICK'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows city name when provided', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} cityName="Berlin" />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
  })

  it('shows rate limit warning when rateLimited', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} rateLimited={true} />)
    expect(screen.getByText('Slow down!')).toBeInTheDocument()
  })

  it('does not show rate limit warning when not limited', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={0} rateLimited={false} />)
    expect(screen.queryByText('Slow down!')).not.toBeInTheDocument()
  })

  it('formats large click counts with locale separators', () => {
    render(<ClickButton onClick={vi.fn()} personalClicks={12345} />)
    expect(screen.getByText('12,345')).toBeInTheDocument()
  })
})
