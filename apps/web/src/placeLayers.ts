import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

import { emptyPlaces, placeCategoryColors, type PlaceFeatureCollection } from './places'

export const placeLayerIds = {
  clusters: 'app-place-clusters',
  clusterCount: 'app-place-cluster-count',
  points: 'app-place-points',
  selected: 'app-place-selected',
} as const

export const placeSourceId = 'app-places'

const categoryColorExpression = [
  'match',
  ['get', 'category'],
  ...Object.entries(placeCategoryColors).flat(),
  placeCategoryColors.other,
] as unknown as ExpressionSpecification

export function installPlaceLayers(map: MapLibreMap): void {
  map.addSource(placeSourceId, {
    type: 'geojson',
    data: emptyPlaces,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 46,
    promoteId: 'id',
  })
  map.addLayer({
    id: placeLayerIds.clusters,
    type: 'circle',
    source: placeSourceId,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#173f34',
      'circle-radius': ['step', ['get', 'point_count'], 16, 25, 20, 100, 25],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: placeLayerIds.clusterCount,
    type: 'symbol',
    source: placeSourceId,
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 },
    paint: { 'text-color': '#ffffff' },
  })
  map.addLayer({
    id: placeLayerIds.points,
    type: 'circle',
    source: placeSourceId,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': categoryColorExpression,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4.5, 16, 7],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    },
  })
  map.addLayer({
    id: placeLayerIds.selected,
    type: 'circle',
    source: placeSourceId,
    filter: ['==', ['id'], -1],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': 11,
      'circle-opacity': 0.25,
      'circle-stroke-color': '#10241e',
      'circle-stroke-width': 3,
    },
  })
}

export function updatePlaceSource(
  map: Pick<MapLibreMap, 'getSource'>,
  data: PlaceFeatureCollection,
): void {
  const source = map.getSource(placeSourceId) as GeoJSONSource | undefined
  source?.setData(data)
}
