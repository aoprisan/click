import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectionStatus from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it('renders nothing when connected', () => {
    const { container } = render(<ConnectionStatus state="connected" />)
    expect(container.innerHTML).toBe('')
  })

  it('shows reconnecting when connecting', () => {
    render(<ConnectionStatus state="connecting" />)
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument()
  })

  it('shows disconnected when disconnected', () => {
    render(<ConnectionStatus state="disconnected" />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })
})
