import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InfoPanel from './InfoPanel'
import type { City } from '../types'

const mockCity: City = {
  id: 'berlin-de', name: 'Berlin', country: 'Germany', countryCode: 'DE',
  lat: 52.5, lng: 13.4, totalClicks: 1500, contributorCount: 5,
  highestEverPopulation: 1500, totalDead: 0, missileStockpile: 0,
}

describe('InfoPanel', () => {
  it('renders city name and country', () => {
    render(<InfoPanel city={mockCity} isHome={false} />)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
  })

  it('shows HOME badge when isHome', () => {
    render(<InfoPanel city={mockCity} isHome={true} />)
    expect(screen.getByText('HOME')).toBeInTheDocument()
  })

  it('does not show HOME badge when not home', () => {
    render(<InfoPanel city={mockCity} isHome={false} />)
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })

  it('shows rank when provided', () => {
    render(<InfoPanel city={mockCity} isHome={false} rank={3} />)
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('shows user clicks when provided', () => {
    render(<InfoPanel city={mockCity} isHome={true} userClicks={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows total clicks', () => {
    render(<InfoPanel city={mockCity} isHome={false} />)
    expect(screen.getByText('1,500')).toBeInTheDocument()
  })
})
