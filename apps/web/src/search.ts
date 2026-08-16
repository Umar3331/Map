import type { MapBounds, PlaceCategory } from './places'

export type SearchContext = {
  bounds: MapBounds
  latitude: number
  longitude: number
}

export type SearchResult = {
  id: number
  name: string
  category: PlaceCategory
  subcategory: string
  latitude: number
  longitude: number
  address_line: string | null
  distance_m: number | null
}

export type SearchResponse = {
  query: string
  results: SearchResult[]
  meta: { returned: number; intent: 'name' | 'category' }
}

export function buildSearchUrl(query: string, context?: SearchContext | null, limit = 10): string {
  const parameters = new URLSearchParams({ q: query, limit: String(limit) })
  if (context) {
    parameters.set('west', context.bounds.west.toFixed(6))
    parameters.set('south', context.bounds.south.toFixed(6))
    parameters.set('east', context.bounds.east.toFixed(6))
    parameters.set('north', context.bounds.north.toFixed(6))
    parameters.set('latitude', context.latitude.toFixed(6))
    parameters.set('longitude', context.longitude.toFixed(6))
  }
  return `/api/v1/search?${parameters}`
}

function isSearchResponse(value: unknown): value is SearchResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SearchResponse>
  return typeof candidate.query === 'string'
    && Array.isArray(candidate.results)
    && candidate.meta !== undefined
    && Number.isInteger(candidate.meta.returned)
    && candidate.meta.returned === candidate.results.length
    && (candidate.meta.intent === 'name' || candidate.meta.intent === 'category')
}

export async function loadSearch(
  query: string,
  context?: SearchContext | null,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const response = await fetch(buildSearchUrl(query, context), { signal })
  if (!response.ok) throw new Error(`Search request failed (${response.status})`)
  const payload: unknown = await response.json()
  if (!isSearchResponse(payload)) throw new Error('Search response is invalid')
  return payload
}

export function formatSearchDistance(distance: number | null): string | null {
  if (distance === null) return null
  if (distance < 1000) return `${Math.max(10, Math.round(distance / 10) * 10)} m away`
  return `${(distance / 1000).toFixed(distance < 10_000 ? 1 : 0)} km away`
}
