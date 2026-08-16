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
  await expect.poll(async () => (await map.getAttribute('data-loaded-sources'))?.split(',')).toEqual(
    expect.arrayContaining(expectedSources),
  )

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

test('application places load by viewport and open responsive details', async ({ page }, testInfo) => {
  const placeRequests: string[] = []
  const runtimeErrors: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/places?')) placeRequests.push(request.url())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('/', { waitUntil: 'load' })
  const map = page.locator('.map-canvas')
  await expect(map).toHaveAttribute('data-places-truncated', 'true')
  await expect(page.getByText('Zoom in to see all places')).toBeVisible()
  await expect(map).toHaveAttribute('data-place-count', '0')
  await expect.poll(async () => Number(await map.getAttribute('data-place-total'))).toBeGreaterThan(500)
  await expect(map).not.toHaveAttribute('data-place-click-x', /\d/)
  await expect(map).toHaveAttribute('data-place-layers', /app-place-points/)

  const broadResponse = await page.request.get(placeRequests.at(-1) as string)
  const broadCollection = await broadResponse.json() as {
    features: unknown[]
    meta: { returned: number; total: number; truncated: boolean }
  }
  expect(broadCollection.meta).toEqual({
    returned: broadCollection.features.length,
    total: broadCollection.meta.total,
    truncated: true,
  })
  expect(broadCollection.meta.total).toBeGreaterThan(broadCollection.meta.returned)

  for (let index = 0; index < 4; index += 1) {
    const requestCount = placeRequests.length
    const completedCount = Number(await map.getAttribute('data-viewport-request-count'))
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(() => placeRequests.length).toBeGreaterThan(requestCount)
    await expect.poll(async () => Number(await map.getAttribute('data-viewport-request-count')))
      .toBeGreaterThan(completedCount)
  }
  await expect(map).toHaveAttribute('data-places-truncated', 'false')
  await expect(page.getByText('Zoom in to see all places')).not.toBeVisible()
  await expect.poll(async () => Number(await map.getAttribute('data-place-count'))).toBeGreaterThan(1)

  const viewportResponse = await page.request.get(placeRequests.at(-1) as string)
  expect(viewportResponse.status()).toBe(200)
  const collection = await viewportResponse.json() as {
    features: Array<{ id: number; geometry: { coordinates: [number, number] }; properties: { name: string } }>
    meta: { returned: number; total: number; truncated: boolean }
  }
  expect(collection.features.length).toBeGreaterThan(1)
  expect(collection.meta).toEqual({
    returned: collection.features.length,
    total: collection.features.length,
    truncated: false,
  })

  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Map canvas has no rendered bounds')
  await expect(map).toHaveAttribute('data-place-click-x', /\d/)
  const clickX = Number(await map.getAttribute('data-place-click-x'))
  const clickY = Number(await map.getAttribute('data-place-click-y'))
  await page.mouse.click(box.x + clickX, box.y + clickY)
  const selectedId = await map.getAttribute('data-selected-place-id')
  expect(selectedId).not.toBeNull()
  const detailsResponse = await page.request.get(`/api/v1/places/${selectedId}`)
  const details = await detailsResponse.json() as { name: string }
  const panel = page.getByRole('dialog', { name: 'Place details' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText(details.name)

  const requestCountBeforePan = placeRequests.length
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => placeRequests.length).toBeGreaterThan(requestCountBeforePan)

  await page.getByRole('button', { name: 'Close place details' }).click()
  await expect(panel).not.toBeVisible()
  expect(runtimeErrors).toEqual([])

  const screenshot = await page.screenshot({ path: testInfo.outputPath('vilnius-places.png') })
  expect(screenshot.byteLength).toBeGreaterThan(50_000)
})

test('place details use an iPhone-sized bottom sheet', async ({ page }) => {
  const placeRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/places?')) placeRequests.push(request.url())
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'load' })
  const map = page.locator('.map-canvas')
  await expect(map).toHaveAttribute('data-places-truncated', 'true')
  await expect(page.getByText('Zoom in to see all places')).toBeVisible()
  for (let index = 0; index < 4; index += 1) {
    const requestCount = placeRequests.length
    const completedCount = Number(await map.getAttribute('data-viewport-request-count'))
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(() => placeRequests.length).toBeGreaterThan(requestCount)
    await expect.poll(async () => Number(await map.getAttribute('data-viewport-request-count')))
      .toBeGreaterThan(completedCount)
  }
  await expect(map).toHaveAttribute('data-places-truncated', 'false')
  await expect.poll(async () => Number(await map.getAttribute('data-place-count'))).toBeGreaterThan(1)
  await expect(map).toHaveAttribute('data-place-click-x', /\d/)
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Map canvas has no rendered bounds')
  const clickX = Number(await map.getAttribute('data-place-click-x'))
  const clickY = Number(await map.getAttribute('data-place-click-y'))
  await page.mouse.click(box.x + clickX, box.y + clickY)
  const panel = page.getByRole('dialog', { name: 'Place details' })
  await expect(panel).toBeVisible()
  const panelBox = await panel.boundingBox()
  if (!panelBox) throw new Error('Place details panel has no rendered bounds')
  expect(panelBox.y + panelBox.height).toBeGreaterThan(820)
  expect(panelBox.width).toBeGreaterThan(350)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('desktop search ranks, navigates, opens existing details, and clears', async ({ page }, testInfo) => {
  const searchRequests: string[] = []
  const runtimeUrls: string[] = []
  const runtimeErrors: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) runtimeUrls.push(request.url())
    if (request.url().includes('/api/v1/search?')) searchRequests.push(request.url())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('/', { waitUntil: 'load' })
  const map = page.locator('.map-canvas')
  await expect(map).toHaveAttribute('data-map-center', /,/)
  const input = page.getByRole('combobox', { name: 'Search Vilnius' })
  await input.fill('Maxima')
  await expect.poll(() => searchRequests.length).toBeGreaterThan(0)
  const options = page.getByRole('option')
  await expect(options.first()).toContainText('Maxima')
  await expect(options.first()).toContainText(/Supermarket/i)

  const centerBefore = await map.getAttribute('data-map-center')
  await input.press('ArrowDown')
  await input.press('ArrowUp')
  await input.press('Enter')
  const panel = page.getByRole('dialog', { name: 'Place details' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText('Maxima')
  await expect(map).toHaveAttribute('data-search-selected-place-id', /\d+/)
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThanOrEqual(16)
  await expect.poll(async () => await map.getAttribute('data-map-center')).not.toBe(centerBefore)

  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(input).toHaveValue('')
  await expect(page.getByLabel('Search results')).not.toBeVisible()
  await expect(panel).not.toBeVisible()
  await expect(map).not.toHaveAttribute('data-search-selected-place-id', /\d+/)

  await input.fill('Rim')
  await expect(page.getByRole('option').first()).toContainText(/Rimi/i)
  await input.fill('restaurant')
  await expect(page.getByRole('option').first()).toContainText(/Restaurant/i)
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')

  expect(runtimeErrors).toEqual([])
  const origin = new URL(page.url()).origin
  expect([...new Set(runtimeUrls.map((url) => new URL(url).origin))]).toEqual([origin])
  const screenshot = await page.screenshot({ path: testInfo.outputPath('vilnius-search-desktop.png') })
  expect(screenshot.byteLength).toBeGreaterThan(50_000)
})

test('desktop gym discovery uses taxonomy and an uncluttered search map mode', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('/', { waitUntil: 'load' })
  const map = page.locator('.map-canvas')
  await expect(map).toHaveAttribute('data-map-center', /,/)
  const input = page.getByRole('combobox', { name: 'Search Vilnius' })
  const searchResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/search?')
      && new URL(response.url()).searchParams.get('q')?.toLowerCase() === 'gym'
  ))
  await input.fill('gym')
  const payload = await (await searchResponse).json() as {
    results: Array<{ id: number; name: string; subcategory: string }>
    meta: { returned: number; intent: string }
  }
  expect(payload.meta.intent).toBe('category')
  expect(payload.results.length).toBeGreaterThan(2)
  expect(payload.results.every((result) => result.subcategory === 'fitness_centre')).toBe(true)
  const taxonomyOnlyIndex = payload.results.findIndex((result) => !/gym/i.test(result.name))
  expect(taxonomyOnlyIndex).toBeGreaterThanOrEqual(0)

  await expect(map).toHaveAttribute('data-search-mode', 'active')
  await expect(map).toHaveAttribute('data-normal-places-visible', 'false')
  await expect(map).toHaveAttribute('data-search-result-count', String(payload.results.length))
  await expect(map).toHaveAttribute('data-search-layers', /app-search-result-points/)
  await expect(page.getByText('Zoom in to see all places')).not.toBeVisible()
  const activeScreenshot = await page.screenshot({
    path: testInfo.outputPath('vilnius-gym-search-active-desktop.png'),
  })
  expect(activeScreenshot.byteLength).toBeGreaterThan(50_000)

  const chosen = payload.results[taxonomyOnlyIndex]
  await page.getByRole('option').nth(taxonomyOnlyIndex).click()
  await expect(map).toHaveAttribute('data-search-selected-place-id', String(chosen.id))
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThanOrEqual(16)
  const panel = page.getByRole('dialog', { name: 'Place details' })
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText(chosen.name)
  const selectedScreenshot = await page.screenshot({
    path: testInfo.outputPath('vilnius-gym-search-selected-desktop.png'),
  })
  expect(selectedScreenshot.byteLength).toBeGreaterThan(50_000)

  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(map).toHaveAttribute('data-search-mode', 'inactive')
  await expect(map).toHaveAttribute('data-search-result-count', '0')
  await expect(map).toHaveAttribute('data-normal-places-visible', 'true')
  await expect(panel).not.toBeVisible()
  expect(runtimeErrors).toEqual([])

  const screenshot = await page.screenshot({ path: testInfo.outputPath('vilnius-gym-search-mode-desktop.png') })
  expect(screenshot.byteLength).toBeGreaterThan(50_000)
})

test('mobile search transitions cleanly into the existing details sheet', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'load' })
  const map = page.locator('.map-canvas')
  await expect(map).toHaveAttribute('data-map-center', /,/)
  const input = page.getByRole('combobox', { name: 'Search Vilnius' })
  const searchResponse = page.waitForResponse((response) => (
    response.url().includes('/api/v1/search?')
      && new URL(response.url()).searchParams.get('q')?.toLowerCase() === 'gym'
  ))
  await input.fill('gym')
  const payload = await (await searchResponse).json() as {
    results: Array<{ id: number; name: string; subcategory: string }>
    meta: { intent: string }
  }
  expect(payload.meta.intent).toBe('category')
  const taxonomyOnlyIndex = payload.results.findIndex((result) => !/gym/i.test(result.name))
  expect(taxonomyOnlyIndex).toBeGreaterThanOrEqual(0)
  await expect(map).toHaveAttribute('data-search-mode', 'active')
  await expect(map).toHaveAttribute('data-normal-places-visible', 'false')
  await expect(page.getByText('Zoom in to see all places')).not.toBeVisible()
  const activeScreenshot = await page.screenshot({
    path: testInfo.outputPath('vilnius-gym-search-active-mobile.png'),
  })
  expect(activeScreenshot.byteLength).toBeGreaterThan(50_000)
  const firstResult = page.getByRole('option').nth(taxonomyOnlyIndex)
  await expect(firstResult).toBeVisible()
  await expect(firstResult).toContainText(/Fitness Centre/i)
  const resultBox = await firstResult.boundingBox()
  if (!resultBox) throw new Error('Mobile search result has no rendered bounds')
  expect(resultBox.height).toBeGreaterThanOrEqual(68)
  expect(resultBox.x).toBeGreaterThanOrEqual(0)
  expect(resultBox.x + resultBox.width).toBeLessThanOrEqual(390)

  await firstResult.click()
  const panel = page.getByRole('dialog', { name: 'Place details' })
  await expect(panel).toBeVisible()
  await expect(page.getByLabel('Search results')).not.toBeVisible()
  const panelBox = await panel.boundingBox()
  if (!panelBox) throw new Error('Mobile place details panel has no rendered bounds')
  expect(panelBox.y + panelBox.height).toBeGreaterThan(820)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const selectedScreenshot = await page.screenshot({
    path: testInfo.outputPath('vilnius-gym-search-selected-mobile.png'),
  })
  expect(selectedScreenshot.byteLength).toBeGreaterThan(50_000)

  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(panel).not.toBeVisible()
  await expect(map).toHaveAttribute('data-search-mode', 'inactive')
  await expect(map).toHaveAttribute('data-normal-places-visible', 'true')
  expect(runtimeErrors).toEqual([])
  const screenshot = await page.screenshot({ path: testInfo.outputPath('vilnius-search-mobile.png') })
  expect(screenshot.byteLength).toBeGreaterThan(50_000)
})

test('provider-backed places open service profiles and return to place details', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  const runtimeUrls: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) runtimeUrls.push(request.url())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('/', { waitUntil: 'load' })
  const input = page.getByRole('combobox', { name: 'Search Vilnius' })
  await input.fill('gym')
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.getByRole('option').first().click()

  const placePanel = page.getByRole('dialog', { name: 'Place details' })
  await expect(placePanel).toBeVisible()
  await expect(placePanel.getByRole('heading', { name: 'Provider' })).toBeVisible()
  const gymProvider = placePanel.locator('.provider-summary').first()
  await expect(gymProvider).toContainText(/2 services/i)
  await gymProvider.click()

  const providerPanel = page.getByRole('dialog', { name: 'Provider profile' })
  await expect(providerPanel).toBeVisible()
  await expect(providerPanel.getByRole('heading', { name: 'Services' })).toBeVisible()
  await expect(providerPanel.getByText('Gym membership')).toBeVisible()
  await expect(providerPanel.getByText('Group fitness')).toBeVisible()
  await expect(providerPanel.getByRole('heading', { name: 'Locations' })).toBeVisible()
  expect(await providerPanel.getByText(/\b(?:EUR|min)\b/).count()).toBe(0)

  const gymScreenshot = await page.screenshot({
    path: testInfo.outputPath('vilnius-provider-profile-desktop.png'),
  })
  expect(gymScreenshot.byteLength).toBeGreaterThan(50_000)

  await page.getByRole('button', { name: 'Back to place details' }).click()
  await expect(placePanel).toBeVisible()
  await page.getByRole('button', { name: 'Close place details' }).click()
  await page.getByRole('button', { name: 'Clear search' }).click()

  await input.fill('car repair')
  await expect(page.getByRole('option').first()).toContainText(/Car Repair/i)
  await page.getByRole('option').first().click()
  const secondPlacePanel = page.getByRole('dialog', { name: 'Place details' })
  await expect(secondPlacePanel.getByRole('heading', { name: 'Provider' })).toBeVisible()
  await secondPlacePanel.locator('.provider-summary').first().click()
  const secondProviderPanel = page.getByRole('dialog', { name: 'Provider profile' })
  await expect(secondProviderPanel.getByText('Vehicle repair')).toBeVisible()
  await page.getByRole('button', { name: 'Close provider profile' }).click()
  await expect(secondProviderPanel).not.toBeVisible()

  expect(runtimeErrors).toEqual([])
  const origin = new URL(page.url()).origin
  expect([...new Set(runtimeUrls.map((url) => new URL(url).origin))]).toEqual([origin])
})

test('provider profile is usable in an iPhone-sized bottom sheet', async ({ page }, testInfo) => {
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'load' })
  const input = page.getByRole('combobox', { name: 'Search Vilnius' })
  await input.fill('gym')
  await expect(page.getByRole('option').first()).toBeVisible()
  await page.getByRole('option').first().click()
  const placePanel = page.getByRole('dialog', { name: 'Place details' })
  await expect(placePanel.locator('.provider-summary').first()).toBeVisible()
  await placePanel.locator('.provider-summary').first().click()

  const providerPanel = page.getByRole('dialog', { name: 'Provider profile' })
  await expect(providerPanel.getByText('Gym membership')).toBeVisible()
  const panelBox = await providerPanel.boundingBox()
  if (!panelBox) throw new Error('Mobile provider profile has no rendered bounds')
  expect(panelBox.x).toBeGreaterThanOrEqual(0)
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390)
  expect(panelBox.y + panelBox.height).toBeGreaterThan(820)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  const screenshot = await page.screenshot({
    path: testInfo.outputPath('vilnius-provider-profile-mobile.png'),
  })
  expect(screenshot.byteLength).toBeGreaterThan(50_000)

  await page.getByRole('button', { name: 'Back to place details' }).click()
  await expect(placePanel).toBeVisible()
  await page.getByRole('button', { name: 'Close place details' }).click()
  expect(runtimeErrors).toEqual([])
})
