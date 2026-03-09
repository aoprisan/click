import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Leaderboard from './Leaderboard'
import type { City } from '../types'

const mockCities: City[] = [
  { id: 'berlin-de', name: 'Berlin', country: 'Germany', countryCode: 'DE', lat: 52.5, lng: 13.4, totalClicks: 500, contributorCount: 3, highestEverPopulation: 500, totalDead: 0, missileStockpile: 0 },
  { id: 'paris-fr', name: 'Paris', country: 'France', countryCode: 'FR', lat: 48.8, lng: 2.3, totalClicks: 300, contributorCount: 2, highestEverPopulation: 300, totalDead: 0, missileStockpile: 0 },
]

describe('Leaderboard', () => {
  it('renders city names and click counts', () => {
    render(<Leaderboard cities={mockCities} />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('shows empty state when no cities', () => {
    render(<Leaderboard cities={[]} />)
    expect(screen.getByText('No population yet')).toBeInTheDocument()
  })

  it('toggles collapse', () => {
    render(<Leaderboard cities={mockCities} />)
    expect(screen.getByText('Berlin')).toBeVisible()

    fireEvent.click(screen.getByText('Most Populated'))
    expect(screen.queryByText('Berlin')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Most Populated'))
    expect(screen.getByText('Berlin')).toBeInTheDocument()
  })
})
