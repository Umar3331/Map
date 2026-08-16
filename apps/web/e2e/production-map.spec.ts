import { expect, test } from '@playwright/test'

const expectedSources = [
  'boundaries',
  'buildings',
  'landuse',
  'places',
  'railways',
  'transportation',
  'water',
  'waterways',
]

test('production MapLibre worker and local vector basemap render', async ({ page }, testInfo) => {
  const responses: Array<{ contentType: string; status: number; url: string }> = []
  const runtimeUrls: string[] = []
  const runtimeErrors: string[] = []

  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) runtimeUrls.push(request.url())
  })
  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('/assets/maplibre-gl-worker-') || url.includes('/tiles/')) {
      responses.push({
        contentType: response.headers()['content-type'] ?? '',
        status: response.status(),
        url,
      })
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('/', { waitUntil: 'load' })

  const map = page.locator('.map-canvas')
  await expect(map).toBeVisible()
  await expect.poll(async () => (await map.getAttribute('data-loaded-sources'))?.split(',')).toEqual(expectedSources)

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Map canvas has no rendered bounds')
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()

  for (const source of expectedSources) {
    await expect.poll(() => responses.some((response) => response.url.includes(`/tiles/${source}/`) && response.status === 200)).toBe(true)
  }

  await page.getByRole('button', { name: 'Find my location' }).click()

  const worker = responses.find((response) => response.url.includes('/assets/maplibre-gl-worker-'))
  expect(worker, 'MapLibre worker response').toBeDefined()
  expect(worker?.status).toBe(200)
  expect(worker?.contentType).toMatch(/(?:application|text)\/javascript/i)

  expect(runtimeErrors.filter((message) => /maplibre|mime|module script|worker/i.test(message))).toEqual([])

  const mapOrigin = new URL(page.url()).origin
  expect([...new Set(runtimeUrls.map((url) => new URL(url).origin))]).toEqual([mapOrigin])

  const screenshot = await map.screenshot({ path: testInfo.outputPath('vilnius-basemap.png') })
  expect(screenshot.byteLength).toBeGreaterThan(50_000)
})
