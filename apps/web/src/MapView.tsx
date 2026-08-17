import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import type { MapConfig } from './config'
import { createVilniusStyle } from './mapStyle'
import { installPlaceLayers, placeLayerIds, placeSourceId, updatePlaceSource } from './placeLayers'
import { PlaceDetailsPanel } from './PlaceDetailsPanel'
import { loadPlaceDetails, loadPlaces, placesForMap, type PlaceDetails } from './places'
import { ProviderProfilePanel } from './ProviderProfilePanel'
import {
  loadPlaceProviders,
  loadProviderProfile,
  loadProviderServices,
  type ProviderProfile,
  type ProviderService,
  type ProviderSummary,
} from './providers'
import { SearchBox } from './SearchBox'
import type { SearchContext, SearchResult } from './search'
import {
  installSearchLayers,
  searchLayerIds,
  selectSearchResult,
  updateSearchResults,
} from './searchLayers'

type MapViewProps = {
  config: MapConfig
}

export function MapView({ config }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const selectPlaceRef = useRef<(result: SearchResult) => void>(() => undefined)
  const pendingSearchResultsRef = useRef<SearchResult[]>([])
  const updateSearchResultsRef = useRef<(results: SearchResult[]) => void>(() => undefined)
  const searchSelectionRef = useRef(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null)
  const [placeProviders, setPlaceProviders] = useState<ProviderSummary[]>([])
  const [providersStatus, setProvidersStatus] = useState<'loading' | 'ready' | 'error'>('ready')
  const [providerView, setProviderView] = useState<
    | { status: 'loading' }
    | { status: 'ready'; provider: ProviderProfile; services: ProviderService[] }
    | { status: 'error' }
    | null
  >(null)
  const providerProfileControllerRef = useRef<AbortController | null>(null)
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  const [searchActive, setSearchActive] = useState(false)
  const [placesStatus, setPlacesStatus] = useState<
    'loading' | 'ready' | 'empty' | 'truncated' | 'error'
  >('loading')
  const regionName = config.region.charAt(0).toUpperCase() + config.region.slice(1)
  const handleSearchResultsChange = useCallback((results: SearchResult[]) => {
    updateSearchResultsRef.current(results)
  }, [])

  const openProvider = useCallback(async (providerId: number) => {
    providerProfileControllerRef.current?.abort()
    const controller = new AbortController()
    providerProfileControllerRef.current = controller
    setProviderView({ status: 'loading' })
    try {
      const [provider, services] = await Promise.all([
        loadProviderProfile(providerId, controller.signal),
        loadProviderServices(providerId, controller.signal),
      ])
      setProviderView({ status: 'ready', provider, services })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setProviderView({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    maplibregl.setWorkerUrl(maplibreWorkerUrl)
    const mapContainer = containerRef.current
    const loadedSources = new Set<string>()
    let viewportTimer: ReturnType<typeof setTimeout> | undefined
    let placesController: AbortController | undefined
    let detailsController: AbortController | undefined
    let providersController: AbortController | undefined
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

    const updateSearchContext = () => {
      const bounds = map.getBounds()
      const center = map.getCenter()
      setSearchContext({
        bounds: {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        },
        latitude: center.lat,
        longitude: center.lng,
      })
      mapContainer.dataset.mapCenter = `${center.lng.toFixed(6)},${center.lat.toFixed(6)}`
      mapContainer.dataset.mapZoom = map.getZoom().toFixed(2)
    }

    const selectPlace = async (
      placeId: number,
      coordinates: [number, number],
      fromSearch: boolean,
      serviceProviderId?: number,
    ) => {
      mapContainer.dataset.selectedPlaceId = String(placeId)
      if (fromSearch) {
        mapContainer.dataset.searchSelectedPlaceId = String(placeId)
        searchSelectionRef.current = true
        map.easeTo({
          center: coordinates,
          zoom: Math.max(map.getZoom(), 16),
          duration: 650,
        })
        selectSearchResult(map, placeId)
      } else {
        delete mapContainer.dataset.searchSelectedPlaceId
        searchSelectionRef.current = false
      }
      if (map.getLayer(placeLayerIds.selected)) {
        map.setFilter(placeLayerIds.selected, ['==', ['id'], placeId])
      }
      detailsController?.abort()
      providersController?.abort()
      detailsController = new AbortController()
      providersController = new AbortController()
      setPlaceProviders([])
      setProvidersStatus('loading')
      setProviderView(null)
      try {
        const details = await loadPlaceDetails(placeId, detailsController.signal)
        if (!disposed) {
          setSelectedPlace(details)
          if (serviceProviderId !== undefined) void openProvider(serviceProviderId)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!disposed) setPlacesStatus('error')
      }
      try {
        const summaries = await loadPlaceProviders(placeId, providersController.signal)
        if (!disposed) {
          setPlaceProviders(summaries)
          setProvidersStatus('ready')
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!disposed) setProvidersStatus('error')
      }
    }

    selectPlaceRef.current = (result) => {
      void selectPlace(
        result.place_id,
        [result.longitude, result.latitude],
        true,
        result.result_type === 'provider_service' && result.provider_id !== null
          ? result.provider_id
          : undefined,
      )
    }

    const applySearchResults = (results: SearchResult[]) => {
      pendingSearchResultsRef.current = results
      if (!map.getLayer(searchLayerIds.points)) return
      updateSearchResults(map, results)
      setSearchActive(Boolean(results.length))
      mapContainer.dataset.searchMode = results.length ? 'active' : 'inactive'
      mapContainer.dataset.searchResultCount = String(results.length)
      mapContainer.dataset.normalPlacesVisible = String(!results.length)
      if (!results.length) delete mapContainer.dataset.searchSelectedPlaceId
    }
    updateSearchResultsRef.current = applySearchResults

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
      installSearchLayers(map)
      applySearchResults(pendingSearchResultsRef.current)
      const selectedPlaceId = Number(mapContainer.dataset.selectedPlaceId)
      if (Number.isFinite(selectedPlaceId)) {
        map.setFilter(placeLayerIds.selected, ['==', ['id'], selectedPlaceId])
      }
      mapContainer.dataset.placeLayers = Object.values(placeLayerIds).join(',')
      mapContainer.dataset.searchLayers = Object.values(searchLayerIds).join(',')
      updateSearchContext()
      loadViewportPlaces()
    })
    map.on('moveend', () => {
      updateSearchContext()
      loadViewportPlaces()
    })
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
      const coordinates = feature?.geometry.type === 'Point'
        ? feature.geometry.coordinates as [number, number]
        : [0, 0] as [number, number]
      await selectPlace(placeId, coordinates, false)
    })
    map.on('click', searchLayerIds.points, async (event) => {
      const feature = event.features?.[0]
      const placeId = Number(feature?.properties?.id ?? feature?.id)
      const providerId = Number(feature?.properties?.provider_id)
      if (!Number.isFinite(placeId) || feature?.geometry.type !== 'Point') return
      const coordinates = feature.geometry.coordinates as [number, number]
      await selectPlace(
        placeId,
        coordinates,
        true,
        Number.isFinite(providerId) && providerId > 0 ? providerId : undefined,
      )
    })
    for (const layer of [placeLayerIds.clusters, placeLayerIds.points, searchLayerIds.points]) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
    }

    return () => {
      disposed = true
      if (viewportTimer) clearTimeout(viewportTimer)
      placesController?.abort()
      detailsController?.abort()
      providersController?.abort()
      providerProfileControllerRef.current?.abort()
      selectPlaceRef.current = () => undefined
      updateSearchResultsRef.current = () => undefined
      mapRef.current = null
      map.remove()
    }
  }, [config, openProvider])

  const closeDetails = () => {
    const map = mapRef.current
    if (map?.getLayer(placeLayerIds.selected)) {
      map.setFilter(placeLayerIds.selected, ['==', ['id'], -1])
    }
    if (map?.getLayer(searchLayerIds.selected)) {
      map.setFilter(searchLayerIds.selected, ['==', ['id'], -1])
    }
    if (containerRef.current) delete containerRef.current.dataset.selectedPlaceId
    if (containerRef.current) delete containerRef.current.dataset.searchSelectedPlaceId
    searchSelectionRef.current = false
    providerProfileControllerRef.current?.abort()
    setProviderView(null)
    setPlaceProviders([])
    setProvidersStatus('ready')
    setSelectedPlace(null)
  }

  const clearSearchSelection = () => {
    if (searchSelectionRef.current) closeDetails()
  }

  return (
    <>
      <div
        ref={containerRef}
        className="map-canvas"
        aria-label={`Interactive map of ${regionName}`}
        data-places-status={placesStatus}
      />
      <header className="top-bar">
        <div className="brand" aria-label="Map home">M</div>
        <SearchBox
          regionName={regionName}
          context={searchContext}
          onClear={clearSearchSelection}
          onResultsChange={handleSearchResultsChange}
          onSelect={(result) => selectPlaceRef.current(result)}
        />
      </header>
      {!searchActive && placesStatus === 'loading' && <div className="places-status" role="status">Loading places…</div>}
      {!searchActive && placesStatus === 'empty' && <div className="places-status">No places in this view</div>}
      {!searchActive && placesStatus === 'truncated' && (
        <div className="places-status places-status-guidance" role="status">
          Zoom in to see all places
        </div>
      )}
      {!searchActive && placesStatus === 'error' && <div className="places-status places-status-error" role="alert">Places are temporarily unavailable</div>}
      {selectedPlace && providerView?.status === 'ready' && (
        <ProviderProfilePanel
          provider={providerView.provider}
          services={providerView.services}
          onBack={() => setProviderView(null)}
          onClose={closeDetails}
        />
      )}
      {selectedPlace && providerView?.status === 'loading' && (
        <aside className="place-details provider-profile-state" role="dialog" aria-label="Provider profile">
          <button className="provider-back" type="button" onClick={() => setProviderView(null)}>← Place</button>
          <button className="place-details-close" type="button" onClick={closeDetails} aria-label="Close provider profile">×</button>
          <p role="status">Loading provider profile…</p>
        </aside>
      )}
      {selectedPlace && providerView?.status === 'error' && (
        <aside className="place-details provider-profile-state" role="dialog" aria-label="Provider profile">
          <button className="provider-back" type="button" onClick={() => setProviderView(null)}>← Place</button>
          <button className="place-details-close" type="button" onClick={closeDetails} aria-label="Close provider profile">×</button>
          <p role="alert">Provider profile is temporarily unavailable</p>
        </aside>
      )}
      {selectedPlace && providerView === null && (
        <PlaceDetailsPanel
          place={selectedPlace}
          providers={placeProviders}
          providersStatus={providersStatus}
          onOpenProvider={(providerId) => { void openProvider(providerId) }}
          onClose={closeDetails}
        />
      )}
    </>
  )
}
