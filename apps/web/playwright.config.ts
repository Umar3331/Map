import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.MAP_E2E_BASE_URL ?? 'http://localhost:5173',
    geolocation: { latitude: 54.6872, longitude: 25.2797 },
    permissions: ['geolocation'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
