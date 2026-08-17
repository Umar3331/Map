export type BookableOffering = {
  id: number
  provider_service_id: number
  provider_location_id: number
  duration_minutes: number
  slot_interval_minutes: number
  capacity: number
  timezone: string
  is_demo: boolean
  service_code: string
  service_name: string
  service_category: string
  place_id: number
  place_name: string
  address_line: string | null
  city: string
}

export type AvailabilitySlot = {
  starts_at: string
  ends_at: string
  starts_at_utc: string
  ends_at_utc: string
  capacity: number
}

export type AvailabilityDay = {
  date: string
  status: 'scheduled' | 'override' | 'closed' | 'no_schedule' | 'no_availability'
  slots: AvailabilitySlot[]
}

export type AvailabilityResponse = {
  offering: {
    id: number
    provider_id: number
    provider_service_id: number
    provider_location_id: number
    provider_name: string
    service_code: string
    service_name: string
    place_id: number
    place_name: string
    address_line: string | null
    city: string
    duration_minutes: number
    slot_interval_minutes: number
    capacity: number
    is_demo: boolean
  }
  timezone: string
  from: string
  to: string
  days: AvailabilityDay[]
  demo_notice: string | null
}

type ProviderOfferingsResponse = {
  provider_id: number
  offerings: BookableOffering[]
  meta: { returned: number }
}

async function responseJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label} request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function loadProviderOfferings(
  providerId: number,
  signal?: AbortSignal,
): Promise<BookableOffering[]> {
  const payload = await responseJson<ProviderOfferingsResponse>(
    await fetch(`/api/v1/providers/${providerId}/offerings`, { signal }),
    'Provider offerings',
  )
  if (!Array.isArray(payload.offerings) || payload.meta.returned !== payload.offerings.length) {
    throw new Error('Provider offerings response is invalid')
  }
  return payload.offerings
}

export async function loadAvailability(
  offeringId: number,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AvailabilityResponse> {
  const parameters = new URLSearchParams({ from, to })
  const payload = await responseJson<AvailabilityResponse>(
    await fetch(`/api/v1/offerings/${offeringId}/availability?${parameters}`, { signal }),
    'Availability',
  )
  if (!Array.isArray(payload.days) || payload.from !== from || payload.to !== to) {
    throw new Error('Availability response is invalid')
  }
  return payload
}

export function dateInTimezone(timezone: string, instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function localTime(isoTimestamp: string): string {
  return isoTimestamp.slice(11, 16)
}
