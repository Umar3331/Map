import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { SearchBox } from './SearchBox'

const maxima = {
  id: 1080,
  name: 'Maxima',
  category: 'shopping' as const,
  subcategory: 'supermarket',
  latitude: 54.69,
  longitude: 25.28,
  address_line: 'Gedimino pr. 18',
  distance_m: 240,
}

const rimi = { ...maxima, id: 1081, name: 'Rimi', distance_m: 480 }

function response(results = [maxima]) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ query: 'maxima', results, meta: { returned: results.length } }),
  })
}

function renderSearch(onSelect = vi.fn(), onClear = vi.fn()) {
  render(
    <SearchBox
      regionName="Vilnius"
      context={null}
      onSelect={onSelect}
      onClear={onClear}
    />,
  )
  return { input: screen.getByRole('combobox'), onSelect, onClear }
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

it('renders loading, empty, error, and clear states without breaking the search control', async () => {
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => response([]))
    .mockRejectedValueOnce(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)
  const { input, onClear } = renderSearch()

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'nothing' } })
  expect(screen.getByText('Searching…')).toBeInTheDocument()
  await finishDebounce()
  expect(screen.getByText('No places found')).toBeInTheDocument()

  fireEvent.change(input, { target: { value: 'failure' } })
  await finishDebounce()
  expect(screen.getByRole('alert')).toHaveTextContent('Search is temporarily unavailable')

  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(input).toHaveValue('')
  expect(input).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByLabelText('Search results')).not.toBeInTheDocument()
  expect(onClear).toHaveBeenCalledOnce()
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
