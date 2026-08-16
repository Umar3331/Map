import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { PlaceDetailsPanel } from './PlaceDetailsPanel'
import type { PlaceDetails } from './places'

const place: PlaceDetails = {
  id: 1,
  name: 'Test Cafe',
  category: 'food_drink',
  subcategory: 'cafe',
  description: null,
  address_line: 'Gedimino pr. 1',
  postal_code: '01103',
  city: 'Vilnius',
  country_code: 'LT',
  phone: '+37000000000',
  website: 'https://example.test',
  email: null,
  opening_hours_raw: 'Mo-Fr 08:00-18:00',
  longitude: 25.2797,
  latitude: 54.6872,
  source: 'openstreetmap',
  source_name: 'OpenStreetMap',
  attribution: '© OpenStreetMap contributors',
  license_name: 'Open Database License 1.0',
  license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  external_id: 'n1',
  source_updated_at: '2026-08-16T20:00:00Z',
}

it('renders available details and closes', () => {
  const onClose = vi.fn()
  render(<PlaceDetailsPanel place={place} onClose={onClose} />)
  expect(screen.getByRole('dialog', { name: 'Place details' })).toHaveTextContent('Test Cafe')
  expect(screen.getByText('Gedimino pr. 1, 01103, Vilnius')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close place details' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it('omits labels for missing optional fields', () => {
  render(
    <PlaceDetailsPanel
      place={{ ...place, address_line: null, postal_code: null, phone: null, website: null, opening_hours_raw: null }}
      onClose={() => undefined}
    />,
  )
  expect(screen.queryByText('Phone')).not.toBeInTheDocument()
  expect(screen.queryByText('Website')).not.toBeInTheDocument()
  expect(screen.queryByText('Hours')).not.toBeInTheDocument()
  expect(screen.getByText('Vilnius')).toBeInTheDocument()
})

it('shows a provider summary and opens the profile', () => {
  const onOpenProvider = vi.fn()
  render(
    <PlaceDetailsPanel
      place={place}
      providers={[{
        id: 21,
        display_name: 'Lemon Gym',
        description: null,
        is_primary: true,
        service_count: 2,
      }]}
      onOpenProvider={onOpenProvider}
      onClose={() => undefined}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Provider' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Lemon Gym/ }))
  expect(onOpenProvider).toHaveBeenCalledWith(21)
})

it('does not show an empty provider section for places without providers', () => {
  render(<PlaceDetailsPanel place={place} providers={[]} onClose={() => undefined} />)
  expect(screen.queryByRole('heading', { name: 'Provider' })).not.toBeInTheDocument()
})
