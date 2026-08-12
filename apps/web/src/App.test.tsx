import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('./MapView', () => ({
  MapView: () => <div aria-label="Interactive map of Vilnius" />,
}))

afterEach(() => vi.unstubAllGlobals())

it('renders the Vilnius map after configuration loads', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        region: 'vilnius',
        country: 'LT',
        center: { latitude: 54.6872, longitude: 25.2797 },
        bounding_box: { south: 54.55, west: 25.1, north: 54.85, east: 25.5 },
      }),
    }),
  )

  const { default: App } = await import('./App')
  render(<App />)

  await waitFor(() => expect(screen.getByText('Search Vilnius')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByLabelText('Interactive map of Vilnius')).toBeInTheDocument())
})
