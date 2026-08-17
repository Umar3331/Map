import { expect, it, vi } from 'vitest'

import { placeLayerIds } from './placeLayers'
import {
  installSearchLayers,
  searchLayerIds,
  searchSourceId,
  selectSearchResult,
  updateSearchResults,
} from './searchLayers'

const gym = {
  id: 2294,
  result_type: 'place' as const,
  provider_id: null,
  place_id: 2294,
  name: 'Lemon gym',
  category: 'fitness' as const,
  subcategory: 'fitness_centre',
  latitude: 54.69,
  longitude: 25.28,
  address_line: null,
  distance_m: 300,
  matched_service: null,
}

const repairProvider = {
  ...gym,
  id: 220,
  place_id: 220,
  provider_id: 120,
  result_type: 'provider_service' as const,
  name: '12Boksas',
  category: 'automotive' as const,
  subcategory: 'car_repair',
  matched_service: { code: 'vehicle_repair', name: 'Vehicle repair' },
}

it('installs native unclustered search result and selected layers', () => {
  const addSource = vi.fn()
  const addLayer = vi.fn()
  installSearchLayers({ addSource, addLayer } as never)
  expect(addSource).toHaveBeenCalledWith(searchSourceId, expect.objectContaining({
    type: 'geojson',
    promoteId: 'id',
  }))
  expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: searchLayerIds.points }))
  expect(addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: searchLayerIds.selected }))
})

it('activates search markers, hides normal POIs, selects a result, and restores browsing', () => {
  const setData = vi.fn()
  const setLayoutProperty = vi.fn()
  const setFilter = vi.fn()
  const map = {
    getSource: vi.fn(() => ({ setData })),
    getLayer: vi.fn(() => ({})),
    setLayoutProperty,
    setFilter,
  } as never

  updateSearchResults(map, [gym])
  expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
    features: [expect.objectContaining({ id: gym.id })],
  }))
  for (const layerId of Object.values(placeLayerIds)) {
    expect(setLayoutProperty).toHaveBeenCalledWith(layerId, 'visibility', 'none')
  }
  expect(setLayoutProperty).toHaveBeenCalledWith(searchLayerIds.points, 'visibility', 'visible')

  selectSearchResult(map, gym.id)
  expect(setFilter).toHaveBeenCalledWith(searchLayerIds.selected, ['==', ['id'], gym.id])

  updateSearchResults(map, [])
  for (const layerId of Object.values(placeLayerIds)) {
    expect(setLayoutProperty).toHaveBeenCalledWith(layerId, 'visibility', 'visible')
  }
  expect(setLayoutProperty).toHaveBeenCalledWith(searchLayerIds.points, 'visibility', 'none')
})

it('puts provider and matched-service context on service map features', () => {
  const setData = vi.fn()
  const map = {
    getSource: vi.fn(() => ({ setData })),
    getLayer: vi.fn(() => ({})),
    setLayoutProperty: vi.fn(),
    setFilter: vi.fn(),
  } as never

  updateSearchResults(map, [repairProvider])
  expect(setData).toHaveBeenCalledWith(expect.objectContaining({
    features: [expect.objectContaining({
      id: repairProvider.place_id,
      properties: expect.objectContaining({
        result_type: 'provider_service',
        provider_id: repairProvider.provider_id,
        matched_service: 'vehicle_repair',
      }),
    })],
  }))
})
