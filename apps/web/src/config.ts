export type MapConfig = {
  region: string
  country: string
  center: {
    latitude: number
    longitude: number
  }
  bounding_box: {
    south: number
    west: number
    north: number
    east: number
  }
}

export async function loadConfig(signal?: AbortSignal): Promise<MapConfig> {
  const response = await fetch('/api/v1/config', { signal })
  if (!response.ok) {
    throw new Error(`Map configuration request failed (${response.status})`)
  }
  return response.json() as Promise<MapConfig>
}
