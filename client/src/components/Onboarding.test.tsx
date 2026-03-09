import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Onboarding from './Onboarding'
import type { City } from '../types'

vi.mock('../api', () => ({
  register: vi.fn().mockResolvedValue({ userId: 'u1', name: 'Alice', cityId: 'berlin-de' }),
}))

const mockCities: City[] = [
  { id: 'berlin-de', name: 'Berlin', country: 'Germany', countryCode: 'DE', lat: 52.52, lng: 13.41, totalClicks: 0, contributorCount: 0, highestEverPopulation: 0, totalDead: 0, missileStockpile: 0 },
  { id: 'paris-fr', name: 'Paris', country: 'France', countryCode: 'FR', lat: 48.86, lng: 2.35, totalClicks: 0, contributorCount: 0, highestEverPopulation: 0, totalDead: 0, missileStockpile: 0 },
  { id: 'tokyo-jp', name: 'Tokyo', country: 'Japan', countryCode: 'JP', lat: 35.69, lng: 139.69, totalClicks: 0, contributorCount: 0, highestEverPopulation: 0, totalDead: 0, missileStockpile: 0 },
]

describe('Onboarding', () => {
  it('renders city picker on first step', () => {
    render(<Onboarding cities={mockCities} onRegistered={vi.fn()} />)
    expect(screen.getByText('Pick your city')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cities...')).toBeInTheDocument()
  })

  it('filters cities by search text', () => {
    render(<Onboarding cities={mockCities} onRegistered={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Search cities...'), { target: { value: 'ber' } })
    expect(screen.getByText('Berlin,')).toBeInTheDocument()
    expect(screen.queryByText('Paris,')).not.toBeInTheDocument()
  })

  it('advances to name step when a city is clicked', () => {
    render(<Onboarding cities={mockCities} onRegistered={vi.fn()} />)
    fireEvent.click(screen.getByText('Berlin,').closest('button')!)
    expect(screen.getByPlaceholderText('Your display name')).toBeInTheDocument()
    expect(screen.getByText(/Berlin/)).toBeInTheDocument()
  })

  it('can go back from name step to city step', () => {
    render(<Onboarding cities={mockCities} onRegistered={vi.fn()} />)
    fireEvent.click(screen.getByText('Berlin,').closest('button')!)
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('Pick your city')).toBeInTheDocument()
  })

  it('calls onRegistered after successful submit', async () => {
    const onRegistered = vi.fn()
    render(<Onboarding cities={mockCities} onRegistered={onRegistered} />)

    fireEvent.click(screen.getByText('Berlin,').closest('button')!)
    fireEvent.change(screen.getByPlaceholderText('Your display name'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledWith({
        id: 'u1', name: 'Alice', cityId: 'berlin-de', totalClicks: 0,
        role: 'builder', totalKills: 0, best10s: 0, best1day: 0, clickMissileClicks: 0, lastCumulativeThreshold: 0,
      })
    })
  })

  it('applies fading style when fading prop is true', () => {
    const { container } = render(<Onboarding cities={mockCities} onRegistered={vi.fn()} fading={true} />)
    const overlay = container.firstChild as HTMLElement
    expect(overlay.style.opacity).toBe('0')
  })
})
