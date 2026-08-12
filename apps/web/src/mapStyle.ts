import type { StyleSpecification } from 'maplibre-gl'

export const vilniusStyle: StyleSpecification = {
  version: 8,
  name: 'Map Vilnius development style',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
    vilnius: {
      type: 'vector',
      tiles: ['/tiles/vilnius_boundary/{z}/{x}/{y}'],
      minzoom: 0,
      maxzoom: 14,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm' },
    {
      id: 'vilnius-area',
      type: 'fill',
      source: 'vilnius',
      'source-layer': 'vilnius_boundary',
      paint: { 'fill-color': '#387765', 'fill-opacity': 0.05 },
    },
    {
      id: 'vilnius-outline',
      type: 'line',
      source: 'vilnius',
      'source-layer': 'vilnius_boundary',
      paint: { 'line-color': '#265c4e', 'line-width': 1.5, 'line-opacity': 0.65 },
    },
  ],
}
