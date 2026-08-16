import type { SourceSpecification, StyleSpecification } from 'maplibre-gl'

const attribution = '© OpenStreetMap contributors'

function vectorSource(origin: string, name: string, maxzoom = 19): SourceSpecification {
  return {
    type: 'vector',
    tiles: [`${origin}/tiles/${name}/{z}/{x}/{y}`],
    minzoom: 0,
    maxzoom,
    attribution,
  }
}

export function createVilniusStyle(origin: string): StyleSpecification {
  const sameOrigin = new URL(origin).origin

  return {
  version: 8,
  name: 'Map self-hosted Vilnius',
  sources: {
    landuse: vectorSource(sameOrigin, 'landuse'),
    water: vectorSource(sameOrigin, 'water'),
    buildings: vectorSource(sameOrigin, 'buildings'),
    waterways: vectorSource(sameOrigin, 'waterways'),
    boundaries: vectorSource(sameOrigin, 'boundaries'),
    railways: vectorSource(sameOrigin, 'railways'),
    transportation: vectorSource(sameOrigin, 'transportation'),
    places: vectorSource(sameOrigin, 'places'),
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f5f2ea' } },
    {
      id: 'landuse', type: 'fill', source: 'landuse', 'source-layer': 'landuse',
      paint: {
        'fill-color': [
          'match', ['get', 'class'],
          ['forest', 'wood'], '#b8d8b4',
          ['park', 'garden', 'nature_reserve', 'grass', 'meadow', 'recreation_ground'], '#cde5bf',
          ['industrial', 'commercial', 'retail'], '#e6ded4',
          ['cemetery'], '#c5d8c0',
          '#e9e4d8',
        ],
        'fill-opacity': 0.72,
      },
    },
    {
      id: 'water', type: 'fill', source: 'water', 'source-layer': 'water',
      paint: { 'fill-color': '#9dc9df', 'fill-outline-color': '#83b7d0' },
    },
    {
      id: 'buildings', type: 'fill', source: 'buildings', 'source-layer': 'buildings', minzoom: 13,
      paint: { 'fill-color': '#d5cec3', 'fill-outline-color': '#bdb4a7', 'fill-opacity': 0.9 },
    },
    {
      id: 'administrative-boundaries', type: 'line', source: 'boundaries', 'source-layer': 'boundaries',
      paint: { 'line-color': '#78868b', 'line-width': 1, 'line-dasharray': [4, 3], 'line-opacity': 0.65 },
    },
    {
      id: 'waterways', type: 'line', source: 'waterways', 'source-layer': 'waterways', minzoom: 11,
      paint: { 'line-color': '#83b7d0', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 17, 3] },
    },
    {
      id: 'railways', type: 'line', source: 'railways', 'source-layer': 'railways', minzoom: 11,
      paint: { 'line-color': '#918b86', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 17, 2] },
    },
    {
      id: 'roads-casing', type: 'line', source: 'transportation', 'source-layer': 'transportation',
      paint: {
        'line-color': '#c8c2b9',
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 1, 12, 2.5, 16, 9, 19, 25],
      },
    },
    {
      id: 'roads', type: 'line', source: 'transportation', 'source-layer': 'transportation',
      paint: {
        'line-color': [
          'match', ['get', 'class'],
          ['motorway', 'motorway_link'], '#e8a56c',
          ['trunk', 'trunk_link', 'primary', 'primary_link'], '#f1c786',
          ['secondary', 'secondary_link'], '#f4dfaa',
          '#ffffff',
        ],
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.5, 12, 1.5, 16, 7, 19, 22],
      },
    },
    {
      id: 'road-labels', type: 'symbol', source: 'transportation', 'source-layer': 'transportation', minzoom: 12,
      filter: ['has', 'name'],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 17, 13],
        'text-max-angle': 30,
      },
      paint: { 'text-color': '#4c4a46', 'text-halo-color': '#fffdf7', 'text-halo-width': 1.25 },
    },
    {
      id: 'waterway-labels', type: 'symbol', source: 'waterways', 'source-layer': 'waterways', minzoom: 12,
      filter: ['has', 'name'],
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 11 },
      paint: { 'text-color': '#477f9c', 'text-halo-color': '#f5f2ea', 'text-halo-width': 1 },
    },
    {
      id: 'place-labels', type: 'symbol', source: 'places', 'source-layer': 'places', minzoom: 8,
      filter: ['has', 'name'],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['match', ['get', 'class'], 'city', 17, ['town', 'suburb'], 14, 11],
        'text-padding': 4,
      },
      paint: { 'text-color': '#343b3c', 'text-halo-color': '#fffdf7', 'text-halo-width': 1.5 },
    },
  ],
  }
}
