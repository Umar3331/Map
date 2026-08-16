import { expect, it, vi } from 'vitest'

import { placeSourceId, updatePlaceSource } from './placeLayers'
import { emptyPlaces } from './places'

it('updates the native MapLibre GeoJSON source', () => {
  const setData = vi.fn()
  const getSource = vi.fn(() => ({ setData }))
  updatePlaceSource({ getSource } as never, emptyPlaces)
  expect(getSource).toHaveBeenCalledWith(placeSourceId)
  expect(setData).toHaveBeenCalledWith(emptyPlaces)
})
