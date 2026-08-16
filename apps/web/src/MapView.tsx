import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { MapConfig } from './config'
import { createVilniusStyle } from './mapStyle'

type MapViewProps = {
  config: MapConfig
}

export function MapView({ config }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const regionName = config.region.charAt(0).toUpperCase() + config.region.slice(1)

  useEffect(() => {
    if (!containerRef.current) return

    const mapContainer = containerRef.current
    const loadedSources = new Set<string>()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createVilniusStyle(window.location.origin),
      center: [config.center.longitude, config.center.latitude],
      zoom: 11.4,
      minZoom: 8,
      maxBounds: [
        [config.bounding_box.west, config.bounding_box.south],
        [config.bounding_box.east, config.bounding_box.north],
      ],
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
        fitBoundsOptions: { maxZoom: 14 },
      }),
      'bottom-right',
    )
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: 'Map v0.1' }),
      'bottom-left',
    )

    map.on('error', (event) => {
      console.error('MapLibre runtime error', event.error)
    })
    map.on('sourcedata', (event) => {
      if (!event.sourceId || event.sourceDataType !== 'content') return
      loadedSources.add(event.sourceId)
      mapContainer.dataset.loadedSources = [...loadedSources].sort().join(',')
      if (import.meta.env.DEV) {
        console.debug('MapLibre source data', event.sourceId, event.sourceDataType)
      }
    })

    return () => map.remove()
  }, [config])

  return <div ref={containerRef} className="map-canvas" aria-label={`Interactive map of ${regionName}`} />
}
