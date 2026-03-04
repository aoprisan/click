import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GlobalCounter from './GlobalCounter'

describe('GlobalCounter', () => {
  it('renders the total with formatting', () => {
    render(<GlobalCounter total={12345} />)
    expect(screen.getByText('12,345')).toBeInTheDocument()
  })

  it('renders zero', () => {
    render(<GlobalCounter total={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('shows the label', () => {
    render(<GlobalCounter total={100} />)
    expect(screen.getByText('Global Clicks')).toBeInTheDocument()
  })
})
