import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { ProviderProfilePanel } from './ProviderProfilePanel'
import type { BookableOffering } from './availability'
import type { ProviderProfile, ProviderService } from './providers'

const provider: ProviderProfile = {
  id: 21,
  display_name: 'Lemon Gym',
  legal_name: null,
  description: 'Local fitness provider',
  phone: '+37000000000',
  email: null,
  website: 'https://example.test',
  locations: [{
    place_id: 11,
    place_name: 'Lemon Gym Konstitucijos',
    address_line: 'Konstitucijos pr. 7A',
    postal_code: null,
    city: 'Vilnius',
    longitude: 25.2701,
    latitude: 54.6962,
    is_primary: true,
  }],
  sources: [{
    source: 'openstreetmap',
    source_name: 'OpenStreetMap',
    external_id: 'n11',
    attribution: '© OpenStreetMap contributors',
    license_name: 'Open Database License 1.0',
    license_url: 'https://opendatacommons.org/licenses/odbl/1-0/',
    source_url: 'https://www.openstreetmap.org/',
    imported_at: '2026-08-17T12:00:00Z',
  }],
}

const services: ProviderService[] = [{
  id: 1,
  provider_service_id: 31,
  code: 'gym_membership',
  name: 'Gym membership',
  category: 'fitness',
  display_name: null,
  description: null,
  price_amount: null,
  price_currency: null,
  duration_minutes: null,
}]

const offerings: BookableOffering[] = [{
  id: 51,
  provider_service_id: 31,
  provider_location_id: 41,
  duration_minutes: 60,
  slot_interval_minutes: 30,
  capacity: 1,
  timezone: 'Europe/Vilnius',
  is_demo: true,
  service_code: 'gym_membership',
  service_name: 'Gym membership',
  service_category: 'fitness',
  place_id: 11,
  place_name: 'Lemon Gym Konstitucijos',
  address_line: 'Konstitucijos pr. 7A',
  city: 'Vilnius',
}]

it('renders services, locations, and available provider fields', () => {
  const onBack = vi.fn()
  const onClose = vi.fn()
  const onViewAvailability = vi.fn()
  render(
    <ProviderProfilePanel
      provider={provider}
      services={services}
      offerings={offerings}
      onViewAvailability={onViewAvailability}
      onBack={onBack}
      onClose={onClose}
    />,
  )

  const dialog = screen.getByRole('dialog', { name: 'Provider profile' })
  expect(dialog).toHaveTextContent('Lemon Gym')
  expect(dialog).toHaveTextContent('Gym membership')
  expect(dialog).toHaveTextContent('Konstitucijos pr. 7A, Vilnius')
  expect(dialog).not.toHaveTextContent('min')
  fireEvent.click(screen.getByRole('button', { name: /View availability/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Back to place details' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close provider profile' }))
  expect(onBack).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
  expect(onViewAvailability).toHaveBeenCalledWith(offerings[0])
})

it('omits missing optional fields and handles no services', () => {
  render(
    <ProviderProfilePanel
      provider={{ ...provider, description: null, phone: null, website: null, locations: [] }}
      services={[]}
      offerings={[]}
      onViewAvailability={() => undefined}
      onBack={() => undefined}
      onClose={() => undefined}
    />,
  )
  expect(screen.queryByText('Phone')).not.toBeInTheDocument()
  expect(screen.queryByText('Website')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Services' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Locations' })).not.toBeInTheDocument()
})

it('marks a service without availability configuration honestly', () => {
  render(
    <ProviderProfilePanel
      provider={provider}
      services={services}
      offerings={[]}
      onViewAvailability={() => undefined}
      onBack={() => undefined}
      onClose={() => undefined}
    />,
  )
  expect(screen.getByText('No schedule configured')).toBeInTheDocument()
})
