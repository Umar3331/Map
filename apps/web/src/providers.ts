export type ProviderSummary = {
  id: number
  display_name: string
  description: string | null
  is_primary: boolean
  service_count: number
}

export type ProviderLocation = {
  place_id: number
  place_name: string
  address_line: string | null
  postal_code: string | null
  city: string
  longitude: number
  latitude: number
  is_primary: boolean
}

export type ProviderSource = {
  source: string
  source_name: string
  external_id: string
  attribution: string
  license_name: string
  license_url: string
  source_url: string
  imported_at: string
}

export type ProviderProfile = {
  id: number
  display_name: string
  legal_name: string | null
  description: string | null
  phone: string | null
  email: string | null
  website: string | null
  locations: ProviderLocation[]
  sources: ProviderSource[]
}

export type ProviderService = {
  id: number
  code: string
  name: string
  category: string
  display_name: string | null
  description: string | null
  price_amount: string | null
  price_currency: string | null
  duration_minutes: number | null
}

type PlaceProvidersResponse = {
  place_id: number
  providers: ProviderSummary[]
  meta: { returned: number }
}

type ProviderServicesResponse = {
  provider_id: number
  services: ProviderService[]
  meta: { returned: number }
}

async function responseJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function loadPlaceProviders(
  placeId: number,
  signal?: AbortSignal,
): Promise<ProviderSummary[]> {
  const payload = await responseJson<PlaceProvidersResponse>(
    await fetch(`/api/v1/places/${placeId}/providers`, { signal }),
    'Place providers',
  )
  if (!Array.isArray(payload.providers) || payload.meta.returned !== payload.providers.length) {
    throw new Error('Place providers response is invalid')
  }
  return payload.providers
}

export async function loadProviderProfile(
  providerId: number,
  signal?: AbortSignal,
): Promise<ProviderProfile> {
  return responseJson<ProviderProfile>(
    await fetch(`/api/v1/providers/${providerId}`, { signal }),
    'Provider profile',
  )
}

export async function loadProviderServices(
  providerId: number,
  signal?: AbortSignal,
): Promise<ProviderService[]> {
  const payload = await responseJson<ProviderServicesResponse>(
    await fetch(`/api/v1/providers/${providerId}/services`, { signal }),
    'Provider services',
  )
  if (!Array.isArray(payload.services) || payload.meta.returned !== payload.services.length) {
    throw new Error('Provider services response is invalid')
  }
  return payload.services
}

export function serviceCategoryLabel(category: string): string {
  return category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
