import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import type { MapConfig } from './config'
import { createVilniusStyle } from './mapStyle'
import { installPlaceLayers, placeLayerIds, placeSourceId, updatePlaceSource } from './placeLayers'
import { PlaceDetailsPanel } from './PlaceDetailsPanel'
import { loadPlaceDetails, loadPlaces, placesForMap, type PlaceDetails } from './places'

type MapViewProps = {
  config: MapConfig
}

export function MapView({ config }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null)
  const [placesStatus, setPlacesStatus] = useState<
    'loading' | 'ready' | 'empty' | 'truncated' | 'error'
  >('loading')
  const regionName = config.region.charAt(0).toUpperCase() + config.region.slice(1)

  useEffect(() => {
    if (!containerRef.current) return

    maplibregl.setWorkerUrl(maplibreWorkerUrl)
    const mapContainer = containerRef.current
    const loadedSources = new Set<string>()
    let viewportTimer: ReturnType<typeof setTimeout> | undefined
    let placesController: AbortController | undefined
    let detailsController: AbortController | undefined
    let disposed = false
    let viewportRequests = 0
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
    mapRef.current = map

    const loadViewportPlaces = () => {
      if (viewportTimer) clearTimeout(viewportTimer)
      viewportTimer = setTimeout(async () => {
        placesController?.abort()
        placesController = new AbortController()
        const bounds = map.getBounds()
        setPlacesStatus('loading')
        try {
          const places = await loadPlaces({
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          }, placesController.signal)
          if (disposed) return
          const displayedPlaces = placesForMap(places)
          updatePlaceSource(map, displayedPlaces)
          await new Promise<void>((resolve) => { map.once('idle', () => resolve()) })
          if (disposed) return
          viewportRequests += 1
          mapContainer.dataset.placeCount = String(displayedPlaces.features.length)
          mapContainer.dataset.placeTotal = String(places.meta.total)
          mapContainer.dataset.placesTruncated = String(places.meta.truncated)
          mapContainer.dataset.viewportRequestCount = String(viewportRequests)
          const clickable = displayedPlaces.features
            .map((feature) => ({ feature, point: map.project(feature.geometry.coordinates) }))
            .find(({ point }) => point.x > 20 && point.y > 70
              && point.x < mapContainer.clientWidth - 20
              && point.y < mapContainer.clientHeight - 20)
          if (clickable) {
            mapContainer.dataset.placeClickX = String(clickable.point.x)
            mapContainer.dataset.placeClickY = String(clickable.point.y)
          } else {
            delete mapContainer.dataset.placeClickX
            delete mapContainer.dataset.placeClickY
          }
          setPlacesStatus(
            places.meta.truncated
              ? 'truncated'
              : displayedPlaces.features.length ? 'ready' : 'empty',
          )
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (!disposed) setPlacesStatus('error')
        }
      }, 180)
    }

    map.on('load', () => {
      installPlaceLayers(map)
      mapContainer.dataset.placeLayers = Object.values(placeLayerIds).join(',')
      loadViewportPlaces()
    })
    map.on('moveend', loadViewportPlaces)
    map.on('click', placeLayerIds.clusters, async (event) => {
      const feature = event.features?.[0]
      const clusterId = Number(feature?.properties?.cluster_id)
      const coordinates = feature?.geometry.type === 'Point' ? feature.geometry.coordinates : null
      if (!coordinates || !Number.isFinite(clusterId)) return
      const source = map.getSource(placeSourceId) as maplibregl.GeoJSONSource
      const zoom = await source.getClusterExpansionZoom(clusterId)
      map.easeTo({ center: [coordinates[0], coordinates[1]], zoom })
    })
    map.on('click', placeLayerIds.points, async (event) => {
      const feature = event.features?.[0]
      const placeId = Number(feature?.properties?.id ?? feature?.id)
      if (!Number.isFinite(placeId)) return
      mapContainer.dataset.selectedPlaceId = String(placeId)
      map.setFilter(placeLayerIds.selected, ['==', ['id'], placeId])
      detailsController?.abort()
      detailsController = new AbortController()
      try {
        const details = await loadPlaceDetails(placeId, detailsController.signal)
        if (!disposed) setSelectedPlace(details)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!disposed) setPlacesStatus('error')
      }
    })
    for (const layer of [placeLayerIds.clusters, placeLayerIds.points]) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
    }

    return () => {
      disposed = true
      if (viewportTimer) clearTimeout(viewportTimer)
      placesController?.abort()
      detailsController?.abort()
      mapRef.current = null
      map.remove()
    }
  }, [config])

  const closeDetails = () => {
    mapRef.current?.setFilter(placeLayerIds.selected, ['==', ['id'], -1])
    if (containerRef.current) delete containerRef.current.dataset.selectedPlaceId
    setSelectedPlace(null)
  }

  return (
    <>
      <div
        ref={containerRef}
        className="map-canvas"
        aria-label={`Interactive map of ${regionName}`}
        data-places-status={placesStatus}
      />
      {placesStatus === 'loading' && <div className="places-status" role="status">Loading places…</div>}
      {placesStatus === 'empty' && <div className="places-status">No places in this view</div>}
      {placesStatus === 'truncated' && (
        <div className="places-status places-status-guidance" role="status">
          Zoom in to see all places
        </div>
      )}
      {placesStatus === 'error' && <div className="places-status places-status-error" role="alert">Places are temporarily unavailable</div>}
      {selectedPlace && <PlaceDetailsPanel place={selectedPlace} onClose={closeDetails} />}
    </>
  )
}
