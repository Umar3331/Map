import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const { mapConstructor, addControl, remove, on, eventHandlers } = vi.hoisted(() => ({
  mapConstructor: vi.fn(),
  addControl: vi.fn(),
  remove: vi.fn(),
  on: vi.fn(),
  eventHandlers: new Map<string, (event: { error?: Error; sourceId?: string; sourceDataType?: string }) => void>(),
}))

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor(options: unknown) { mapConstructor(options) }
    addControl = addControl
    on(eventName: string, handler: (event: { error?: Error; sourceId?: string; sourceDataType?: string }) => void) {
      on(eventName, handler)
      eventHandlers.set(eventName, handler)
      return this
    }
    remove = remove
  },
  NavigationControl: class {},
  GeolocateControl: class {},
  AttributionControl: class {},
}))

import { MapView } from './MapView'

beforeEach(() => {
  vi.clearAllMocks()
  eventHandlers.clear()
})

it('initializes and cleans up MapLibre with the Vilnius center', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
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
  const mapOptions = mapConstructor.mock.calls[0][0]
  const transportation = mapOptions.style.sources.transportation
  expect(transportation.tiles).toEqual([
    `${window.location.origin}/tiles/transportation/{z}/{x}/{y}`,
  ])
  expect(addControl).toHaveBeenCalledTimes(3)
  expect(on).toHaveBeenCalledWith('error', expect.any(Function))
  expect(on).toHaveBeenCalledWith('sourcedata', expect.any(Function))

  eventHandlers.get('sourcedata')?.({ sourceId: 'transportation', sourceDataType: 'content' })
  expect(document.querySelector('.map-canvas')).toHaveAttribute('data-loaded-sources', 'transportation')

  const runtimeError = new Error('tile load failed')
  eventHandlers.get('error')?.({ error: runtimeError })
  expect(consoleError).toHaveBeenCalledWith('MapLibre runtime error', runtimeError)

  unmount()
  expect(remove).toHaveBeenCalledOnce()
  consoleError.mockRestore()
})
