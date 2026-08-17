import { afterEach, expect, it, vi } from 'vitest'

import { loadPlaceProviders, loadProviderProfile, loadProviderServices } from './providers'

afterEach(() => vi.restoreAllMocks())

it('loads compact providers for a place', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    place_id: 11,
    providers: [{
      id: 21,
      display_name: 'Lemon Gym',
      description: null,
      is_primary: true,
      service_count: 2,
    }],
    meta: { returned: 1 },
  })))

  await expect(loadPlaceProviders(11)).resolves.toHaveLength(1)
  expect(fetch).toHaveBeenCalledWith('/api/v1/places/11/providers', { signal: undefined })
})

it('loads provider profile and services without requiring commercial data', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 21,
      display_name: 'Lemon Gym',
      legal_name: null,
      description: null,
      phone: null,
      email: null,
      website: null,
      locations: [],
      sources: [],
    })))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      provider_id: 21,
      services: [{
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
      }],
      meta: { returned: 1 },
    })))

  await expect(loadProviderProfile(21)).resolves.toMatchObject({ display_name: 'Lemon Gym' })
  const services = await loadProviderServices(21)
  expect(services[0]).toMatchObject({ code: 'gym_membership', price_amount: null })
})

it('rejects inconsistent provider collections', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    place_id: 11,
    providers: [],
    meta: { returned: 1 },
  })))
  await expect(loadPlaceProviders(11)).rejects.toThrow('response is invalid')
})
