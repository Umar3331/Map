import { afterEach, expect, it, vi } from 'vitest'

import { buildPlacesUrl, loadPlaceDetails, loadPlaces, placeCategoryLabel } from './places'

afterEach(() => vi.unstubAllGlobals())

it('builds a bounded viewport request with a hard result limit', () => {
  const url = buildPlacesUrl({ west: 25.1, south: 54.55, east: 25.5, north: 54.85 })
  expect(url).toBe(
    '/api/v1/places?west=25.100000&south=54.550000&east=25.500000&north=54.850000&limit=500',
  )
})

it('loads and validates a GeoJSON place collection', async () => {
  const payload = { type: 'FeatureCollection', features: [] }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }))
  await expect(loadPlaces({ west: 25.1, south: 54.55, east: 25.5, north: 54.85 })).resolves.toEqual(payload)
})

it('rejects malformed place payloads and failed detail requests', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ places: [] }) }))
  await expect(loadPlaces({ west: 25.1, south: 54.55, east: 25.5, north: 54.85 })).rejects.toThrow('not GeoJSON')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
  await expect(loadPlaceDetails(999)).rejects.toThrow('404')
})

it('provides normalized category labels', () => {
  expect(placeCategoryLabel('food_drink')).toBe('Food & Drink')
})
