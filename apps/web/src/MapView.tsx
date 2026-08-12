import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { MapConfig } from './config'
import { vilniusStyle } from './mapStyle'

type MapViewProps = {
  config: MapConfig
}

export function MapView({ config }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: vilniusStyle,
      center: [config.center.longitude, config.center.latitude],
      zoom: 11.4,
      minZoom: 8,
      maxBounds: [
        [24.75, 54.35],
        [25.85, 55.05],
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

    return () => map.remove()
  }, [config])

  return <div ref={containerRef} className="map-canvas" aria-label="Interactive map of Vilnius" />
}
