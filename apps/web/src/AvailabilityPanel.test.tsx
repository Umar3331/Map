import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { AvailabilityPanel } from './AvailabilityPanel'
import type { BookableOffering } from './availability'

const offering: BookableOffering = {
  id: 51,
  provider_service_id: 31,
  provider_location_id: 41,
  duration_minutes: 60,
  slot_interval_minutes: 30,
  capacity: 1,
  timezone: 'Europe/Vilnius',
  is_demo: true,
  service_code: 'vehicle_repair',
  service_name: 'Vehicle repair',
  service_category: 'automotive',
  place_id: 11,
  place_name: '12Boksas',
  address_line: null,
  city: 'Vilnius',
}

function response(days: Array<{ date: string; status: string; slots: unknown[] }>) {
  return new Response(JSON.stringify({
    offering: { id: 51 },
    timezone: 'Europe/Vilnius',
    from: days[0].date,
    to: days.at(-1)?.date,
    days,
    demo_notice: 'Development schedule only',
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('loads dates, switches days, and selects a slot without booking', async () => {
  vi.setSystemTime(new Date('2026-08-17T09:00:00Z'))
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response([
    {
      date: '2026-08-17',
      status: 'scheduled',
      slots: [{
        starts_at: '2026-08-17T09:00:00+03:00',
        ends_at: '2026-08-17T10:00:00+03:00',
        starts_at_utc: '2026-08-17T06:00:00Z',
        ends_at_utc: '2026-08-17T07:00:00Z',
        capacity: 1,
      }],
    },
    { date: '2026-08-18', status: 'closed', slots: [] },
    { date: '2026-08-19', status: 'no_availability', slots: [] },
    { date: '2026-08-20', status: 'scheduled', slots: [] },
    { date: '2026-08-21', status: 'scheduled', slots: [] },
    { date: '2026-08-22', status: 'scheduled', slots: [] },
    { date: '2026-08-23', status: 'scheduled', slots: [] },
  ]))
  render(<AvailabilityPanel offering={offering} onBack={() => undefined} onClose={() => undefined} />)

  expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '09:00' }))
  expect(screen.getByText(/No booking has been created/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('listitem', { name: 'Tue Aug 18' }))
  expect(screen.getByText('Closed')).toBeInTheDocument()
})

it('shows API failure without exposing a technical error', async () => {
  vi.setSystemTime(new Date('2026-08-17T09:00:00Z'))
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))
  render(<AvailabilityPanel offering={offering} onBack={() => undefined} onClose={() => undefined} />)
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable'))
})

it('supports back and close actions', () => {
  vi.setSystemTime(new Date('2026-08-17T09:00:00Z'))
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined))
  const onBack = vi.fn()
  const onClose = vi.fn()
  render(<AvailabilityPanel offering={offering} onBack={onBack} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Back to provider profile' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close availability' }))
  expect(onBack).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
})
