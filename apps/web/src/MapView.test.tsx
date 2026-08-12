import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const { mapConstructor, addControl, remove } = vi.hoisted(() => ({
  mapConstructor: vi.fn(),
  addControl: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor(options: unknown) { mapConstructor(options) }
    addControl = addControl
    remove = remove
  },
  NavigationControl: class {},
  GeolocateControl: class {},
  AttributionControl: class {},
}))

import { MapView } from './MapView'

beforeEach(() => vi.clearAllMocks())

it('initializes and cleans up MapLibre with the Vilnius center', () => {
  const { unmount } = render(
    <MapView
      config={{
        region: 'vilnius',
        country: 'LT',
        center: { latitude: 54.6872, longitude: 25.2797 },
        bounding_box: { south: 54.55, west: 25.1, north: 54.85, east: 25.5 },
      }}
    />,
  )

  expect(mapConstructor).toHaveBeenCalledWith(
    expect.objectContaining({
      center: [25.2797, 54.6872],
      maxBounds: [
        [25.1, 54.55],
        [25.5, 54.85],
      ],
    }),
  )
  expect(addControl).toHaveBeenCalledTimes(3)
  unmount()
  expect(remove).toHaveBeenCalledOnce()
})
