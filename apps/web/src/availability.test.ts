import { afterEach, expect, it, vi } from 'vitest'

import { addDays, dateInTimezone, loadAvailability, loadProviderOfferings, localTime } from './availability'

afterEach(() => vi.restoreAllMocks())

it('loads provider offerings and validates collection metadata', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    provider_id: 21,
    offerings: [{ id: 51, is_demo: true }],
    meta: { returned: 1 },
  })))
  await expect(loadProviderOfferings(21)).resolves.toHaveLength(1)
  expect(fetch).toHaveBeenCalledWith('/api/v1/providers/21/offerings', { signal: undefined })
})

it('loads a bounded availability range', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    offering: { id: 51 },
    timezone: 'Europe/Vilnius',
    from: '2026-08-17',
    to: '2026-08-23',
    days: [],
    demo_notice: 'Development schedule only',
  })))
  await expect(loadAvailability(51, '2026-08-17', '2026-08-23')).resolves.toMatchObject({
    timezone: 'Europe/Vilnius',
  })
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/offerings/51/availability?from=2026-08-17&to=2026-08-23',
    { signal: undefined },
  )
})

it('formats deterministic date and time values', () => {
  expect(dateInTimezone('Europe/Vilnius', new Date('2026-01-01T22:30:00Z'))).toBe('2026-01-02')
  expect(addDays('2026-08-17', 6)).toBe('2026-08-23')
  expect(localTime('2026-08-17T09:30:00+03:00')).toBe('09:30')
})
