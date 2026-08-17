import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { SearchBox } from './SearchBox'
import type { SearchResult } from './search'

const maxima = {
  id: 1080,
  result_type: 'place' as const,
  provider_id: null,
  place_id: 1080,
  name: 'Maxima',
  category: 'shopping' as const,
  subcategory: 'supermarket',
  latitude: 54.69,
  longitude: 25.28,
  address_line: 'Gedimino pr. 18',
  distance_m: 240,
  matched_service: null,
}

const rimi = { ...maxima, id: 1081, place_id: 1081, name: 'Rimi', distance_m: 480 }

const repairProvider = {
  id: 220,
  result_type: 'provider_service' as const,
  provider_id: 120,
  place_id: 220,
  name: '12Boksas',
  place_name: '12Boksas',
  category: 'automotive' as const,
  subcategory: 'car_repair',
  latitude: 54.68,
  longitude: 25.27,
  address_line: 'Test g. 12',
  distance_m: 300,
  matched_service: { code: 'vehicle_repair', name: 'Vehicle repair' },
}

function response(
  results: SearchResult[] = [maxima],
  intent: 'name' | 'category' | 'service' = 'name',
) {
  return Promise.resolve({
    ok: true,
    json: async () => ({
      query: 'maxima',
      results,
      meta: { returned: results.length, intent },
    }),
  })
}

function renderSearch(onSelect = vi.fn(), onClear = vi.fn(), onResultsChange = vi.fn()) {
  render(
    <SearchBox
      regionName="Vilnius"
      context={null}
      onSelect={onSelect}
      onClear={onClear}
      onResultsChange={onResultsChange}
    />,
  )
  return { input: screen.getByRole('combobox'), onSelect, onClear, onResultsChange }
}

async function finishDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(250)
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('debounces search and does not request a one-character query', async () => {
  const fetchMock = vi.fn().mockImplementation(() => response())
  vi.stubGlobal('fetch', fetchMock)
  const { input } = renderSearch()

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'm' } })
  expect(screen.getByText('Type at least 2 characters')).toBeInTheDocument()
  await finishDebounce()
  expect(fetchMock).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: 'max' } })
  vi.advanceTimersByTime(249)
  expect(fetchMock).not.toHaveBeenCalled()
  await finishDebounce()
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(screen.getByRole('option', { name: /Maxima/ })).toBeInTheDocument()
})

it('aborts a stale request before a newer query can replace it', async () => {
  let staleSignal: AbortSignal | undefined
  const fetchMock = vi.fn()
    .mockImplementationOnce((_url: string, options: RequestInit) => {
      staleSignal = options.signal as AbortSignal
      return new Promise(() => undefined)
    })
    .mockImplementationOnce(() => response([rimi]))
  vi.stubGlobal('fetch', fetchMock)
  const { input } = renderSearch()

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'maxima' } })
  await finishDebounce()
  fireEvent.change(input, { target: { value: 'rimi' } })
  expect(staleSignal?.aborted).toBe(true)
  await finishDebounce()
  expect(screen.getByRole('option', { name: /Rimi/ })).toBeInTheDocument()
})

it('publishes only current results to map search mode and clears stale map results', async () => {
  let resolveStale: ((value: Awaited<ReturnType<typeof response>>) => void) | undefined
  const staleResponse = new Promise<Awaited<ReturnType<typeof response>>>((resolve) => {
    resolveStale = resolve
  })
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => staleResponse)
    .mockImplementationOnce(() => response([rimi]))
  vi.stubGlobal('fetch', fetchMock)
  const { input, onResultsChange } = renderSearch()

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'maxima' } })
  await finishDebounce()
  fireEvent.change(input, { target: { value: 'rimi' } })
  expect(onResultsChange).toHaveBeenLastCalledWith([])
  await finishDebounce()
  expect(onResultsChange).toHaveBeenLastCalledWith([rimi])
  await act(async () => resolveStale?.(await response([maxima])))
  expect(onResultsChange).toHaveBeenLastCalledWith([rimi])
})

it('renders loading, empty, error, and clear states without breaking the search control', async () => {
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => response([], 'service'))
    .mockRejectedValueOnce(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)
  const { input, onClear } = renderSearch()

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'nothing' } })
  expect(screen.getByText('Searching…')).toBeInTheDocument()
  await finishDebounce()
  expect(screen.getByText('No service providers found')).toBeInTheDocument()

  fireEvent.change(input, { target: { value: 'failure' } })
  await finishDebounce()
  expect(screen.getByRole('alert')).toHaveTextContent('Search is temporarily unavailable')

  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(input).toHaveValue('')
  expect(input).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByLabelText('Search results')).not.toBeInTheDocument()
  expect(onClear).toHaveBeenCalledOnce()
})

it('labels service results and selects the provider location result', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => response([repairProvider], 'service')))
  const onSelect = vi.fn()
  const { input } = renderSearch(onSelect)

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'car repair' } })
  await finishDebounce()
  const option = screen.getByRole('option', { name: /12Boksas/ })
  expect(option).toHaveAttribute('data-result-type', 'provider_service')
  expect(option).toHaveTextContent('Vehicle repair · Service provider')
  fireEvent.click(option)
  expect(onSelect).toHaveBeenCalledWith(repairProvider)
})

it('supports arrow keys, Enter selection, Escape, and result callbacks', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => response([maxima, rimi])))
  const onSelect = vi.fn()
  const { input } = renderSearch(onSelect)

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'market' } })
  await finishDebounce()
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  expect(screen.getByRole('option', { name: /Rimi/ })).toHaveAttribute('aria-selected', 'true')
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSelect).toHaveBeenCalledWith(rimi)
  expect(input).toHaveAttribute('aria-expanded', 'false')

  fireEvent.focus(input)
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input).toHaveAttribute('aria-expanded', 'false')
})
