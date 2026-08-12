import { expect, it } from 'vitest'

import { vilniusStyle } from './mapStyle'

it('uses only same-origin runtime basemap resources', () => {
  const serialized = JSON.stringify(vilniusStyle).toLowerCase()

  expect(serialized).not.toContain('tile.openstreetmap.org')
  expect(serialized).not.toContain('mapbox://')
  expect(serialized).not.toMatch(/https?:\/\//)
  expect(serialized).not.toContain('glyphs')
  expect(serialized).not.toContain('sprite')

  const sourceUrls = Object.values(vilniusStyle.sources)
    .flatMap((source) => ('tiles' in source && source.tiles ? source.tiles : []))
  expect(sourceUrls.length).toBeGreaterThan(0)
  expect(sourceUrls.every((url) => url.startsWith('/tiles/'))).toBe(true)
})
