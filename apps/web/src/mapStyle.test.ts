import { describe, expect, it } from 'vitest'

import { createVilniusStyle } from './mapStyle'

const origins = [
  'http://localhost:5173',
  'https://192.168.8.237:8443',
]

describe.each(origins)('createVilniusStyle(%s)', (origin) => {
  it('uses only absolute same-origin runtime basemap resources', () => {
    const style = createVilniusStyle(origin)
    const serialized = JSON.stringify(style).toLowerCase()

    expect(serialized).not.toContain('tile.openstreetmap.org')
    expect(serialized).not.toContain('mapbox://')
    expect(serialized).not.toContain('localhost:3000')
    expect(serialized).not.toContain('glyphs')
    expect(serialized).not.toContain('sprite')

    const sourceUrls = Object.values(style.sources)
      .flatMap((source) => ('tiles' in source && source.tiles ? source.tiles : []))
    expect(sourceUrls.length).toBeGreaterThan(0)
    for (const sourceUrl of sourceUrls) {
      const resolvedUrl = new URL(sourceUrl.replace('{z}', '11').replace('{x}', '1167').replace('{y}', '650'))
      expect(resolvedUrl.origin).toBe(origin)
      expect(sourceUrl).toMatch(new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/tiles/`))
    }

    const transportation = style.sources.transportation
    expect('tiles' in transportation ? transportation.tiles : undefined).toEqual([
      `${origin}/tiles/transportation/{z}/{x}/{y}`,
    ])
  })
})

it('normalizes a supplied URL to its origin', () => {
  const style = createVilniusStyle('https://192.168.8.237:8443/some/path?ignored=true')
  const transportation = style.sources.transportation

  expect('tiles' in transportation ? transportation.tiles : undefined).toEqual([
    'https://192.168.8.237:8443/tiles/transportation/{z}/{x}/{y}',
  ])
})
