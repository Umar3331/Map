import { afterEach, expect, it, vi } from 'vitest'

import { buildSearchUrl, formatSearchDistance, loadSearch } from './search'

afterEach(() => vi.unstubAllGlobals())

it('builds a bounded local search request with geographic bias', () => {
  expect(buildSearchUrl('Maxima', {
    bounds: { west: 25.1, south: 54.55, east: 25.5, north: 54.85 },
    latitude: 54.6872,
    longitude: 25.2797,
  })).toBe('/api/v1/search?q=Maxima&limit=10&west=25.100000&south=54.550000&east=25.500000&north=54.850000&latitude=54.687200&longitude=25.279700')
})

it('validates search response metadata', async () => {
  const payload = { query: 'maxima', results: [], meta: { returned: 0 } }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
  await expect(loadSearch('maxima')).resolves.toEqual(payload)

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ...payload, meta: { returned: 1 } }),
  }))
  await expect(loadSearch('maxima')).rejects.toThrow('Search response is invalid')
})

it('formats nearby and city-scale distances without exposing nulls', () => {
  expect(formatSearchDistance(null)).toBeNull()
  expect(formatSearchDistance(243)).toBe('240 m away')
  expect(formatSearchDistance(1840)).toBe('1.8 km away')
  expect(formatSearchDistance(12_400)).toBe('12 km away')
})
