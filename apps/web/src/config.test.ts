import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from './config'

afterEach(() => vi.unstubAllGlobals())

describe('loadConfig', () => {
  it('loads the Vilnius configuration from the same-origin API', async () => {
    const payload = {
      region: 'vilnius',
      country: 'LT',
      center: { latitude: 54.6872, longitude: 25.2797 },
      bounding_box: { south: 54.55, west: 25.1, north: 54.85, east: 25.5 },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadConfig()).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/config', { signal: undefined })
  })

  it('reports an unsuccessful API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(loadConfig()).rejects.toThrow('Map configuration request failed (503)')
  })
})
