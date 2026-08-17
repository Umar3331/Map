import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

import { placeLayerIds } from './placeLayers'
import type { SearchResult } from './search'

export const searchSourceId = 'app-search-results'

export const searchLayerIds = {
  points: 'app-search-result-points',
  selected: 'app-search-result-selected',
} as const

const normalPlaceLayers = Object.values(placeLayerIds)

function resultCollection(results: SearchResult[]) {
  return {
    type: 'FeatureCollection' as const,
    features: results.map((result) => ({
      type: 'Feature' as const,
      id: result.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [result.longitude, result.latitude],
      },
      properties: {
        id: result.id,
        name: result.name,
        category: result.category,
        subcategory: result.subcategory,
        result_type: result.result_type,
        provider_id: result.provider_id,
        matched_service: result.matched_service?.code ?? null,
      },
    })),
  }
}

export function installSearchLayers(map: MapLibreMap): void {
  map.addSource(searchSourceId, {
    type: 'geojson',
    data: resultCollection([]),
    promoteId: 'id',
  })
  map.addLayer({
    id: searchLayerIds.points,
    type: 'circle',
    source: searchSourceId,
    layout: { visibility: 'none' },
    paint: {
      'circle-color': '#17664f',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 9],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: searchLayerIds.selected,
    type: 'circle',
    source: searchSourceId,
    filter: ['==', ['id'], -1],
    layout: { visibility: 'none' },
    paint: {
      'circle-color': '#f5c451',
      'circle-radius': 13,
      'circle-opacity': 0.45,
      'circle-stroke-color': '#10241e',
      'circle-stroke-width': 3,
    },
  })
}

export function updateSearchResults(map: MapLibreMap, results: SearchResult[]): void {
  const source = map.getSource(searchSourceId) as GeoJSONSource | undefined
  source?.setData(resultCollection(results))
  const active = results.length > 0
  for (const layerId of normalPlaceLayers) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', active ? 'none' : 'visible')
    }
  }
  for (const layerId of Object.values(searchLayerIds)) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', active ? 'visible' : 'none')
    }
  }
  if (!active && map.getLayer(searchLayerIds.selected)) {
    map.setFilter(searchLayerIds.selected, ['==', ['id'], -1])
  }
}

export function selectSearchResult(map: MapLibreMap, placeId: number): void {
  if (map.getLayer(searchLayerIds.selected)) {
    map.setFilter(searchLayerIds.selected, ['==', ['id'], placeId])
  }
}
