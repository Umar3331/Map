export const placeCategories = [
  'food_drink',
  'shopping',
  'health',
  'automotive',
  'beauty',
  'fitness',
  'finance',
  'accommodation',
  'services',
  'other',
] as const

export type PlaceCategory = (typeof placeCategories)[number]

export type MapBounds = {
  west: number
  south: number
  east: number
  north: number
}

export type PlaceFeature = {
  type: 'Feature'
  id: number
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    id: number
    name: string
    category: PlaceCategory
    subcategory: string
  }
}

export type PlaceFeatureCollection = {
  type: 'FeatureCollection'
  features: PlaceFeature[]
}

export type PlaceDetails = {
  id: number
  name: string
  category: PlaceCategory
  subcategory: string
  description: string | null
  address_line: string | null
  postal_code: string | null
  city: string
  country_code: string
  phone: string | null
  website: string | null
  email: string | null
  opening_hours_raw: string | null
  longitude: number
  latitude: number
  source: string
  source_name: string
  attribution: string
  license_name: string
  license_url: string
  external_id: string
  source_updated_at: string
}

export const emptyPlaces: PlaceFeatureCollection = { type: 'FeatureCollection', features: [] }

export function buildPlacesUrl(bounds: MapBounds, limit = 500): string {
  const parameters = new URLSearchParams({
    west: bounds.west.toFixed(6),
    south: bounds.south.toFixed(6),
    east: bounds.east.toFixed(6),
    north: bounds.north.toFixed(6),
    limit: String(limit),
  })
  return `/api/v1/places?${parameters}`
}

function isPlaceFeatureCollection(value: unknown): value is PlaceFeatureCollection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PlaceFeatureCollection>
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)
}

export async function loadPlaces(
  bounds: MapBounds,
  signal?: AbortSignal,
): Promise<PlaceFeatureCollection> {
  const response = await fetch(buildPlacesUrl(bounds), { signal })
  if (!response.ok) throw new Error(`Places request failed (${response.status})`)
  const payload: unknown = await response.json()
  if (!isPlaceFeatureCollection(payload)) throw new Error('Places response is not GeoJSON')
  return payload
}

export async function loadPlaceDetails(id: number, signal?: AbortSignal): Promise<PlaceDetails> {
  const response = await fetch(`/api/v1/places/${id}`, { signal })
  if (!response.ok) throw new Error(`Place details request failed (${response.status})`)
  return response.json() as Promise<PlaceDetails>
}

export function placeCategoryLabel(category: PlaceCategory): string {
  return category.replace('_', ' & ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function placeSubcategoryLabel(subcategory: string): string {
  return subcategory.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const placeCategoryColors: Record<PlaceCategory, string> = {
  food_drink: '#d96c4c',
  shopping: '#7658b5',
  health: '#d84f72',
  automotive: '#4a6c88',
  beauty: '#b55494',
  fitness: '#31866f',
  finance: '#3975a8',
  accommodation: '#9b6547',
  services: '#596b5f',
  other: '#6f7477',
}
