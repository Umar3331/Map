import { useEffect, useId, useRef, useState } from 'react'

import { placeCategoryLabel, placeSubcategoryLabel } from './places'
import {
  formatSearchDistance,
  loadSearch,
  type SearchContext,
  type SearchResult,
} from './search'

type SearchBoxProps = {
  regionName: string
  context: SearchContext | null
  onClear: () => void
  onResultsChange: (results: SearchResult[]) => void
  onSelect: (result: SearchResult) => void
}

type SearchStatus = 'idle' | 'short' | 'loading' | 'ready' | 'empty' | 'error'
type SearchIntent = 'name' | 'category' | 'service'

export function SearchBox({
  regionName,
  context,
  onClear,
  onResultsChange,
  onSelect,
}: SearchBoxProps) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [intent, setIntent] = useState<SearchIntent>('name')

  useEffect(() => {
    if (!open) return
    const normalizedQuery = query.trim().replace(/\s+/g, ' ')
    if (normalizedQuery.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadSearch(normalizedQuery, context, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return
          setResults(response.results)
          setIntent(response.meta.intent)
          onResultsChange(response.results)
          setActiveIndex(0)
          setStatus(response.results.length ? 'ready' : 'empty')
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setResults([])
          onResultsChange([])
          setStatus('error')
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [context, onResultsChange, open, query])

  const chooseResult = (result: SearchResult) => {
    setOpen(false)
    onSelect(result)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setStatus('idle')
    setIntent('name')
    setOpen(false)
    onResultsChange([])
    onClear()
    inputRef.current?.blur()
  }

  const closeSearch = () => {
    setOpen(false)
    onResultsChange([])
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
      return
    }
    if (!open || status !== 'ready' || !results.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      chooseResult(results[activeIndex])
    }
  }

  const expanded = open && status !== 'short'
  const activeDescendant = expanded && status === 'ready'
    ? `${listboxId}-option-${results[activeIndex]?.id}`
    : undefined

  return (
    <div className="search-container" role="search" aria-label={`Search ${regionName}`}>
      <div className="search-shell">
        <span className="search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={expanded}
          aria-activedescendant={activeDescendant}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={120}
          placeholder={`Search ${regionName}`}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value
            const normalizedQuery = nextQuery.trim().replace(/\s+/g, ' ')
            setQuery(nextQuery)
            setResults([])
            onResultsChange([])
            setStatus(!normalizedQuery ? 'idle' : normalizedQuery.length < 2 ? 'short' : 'loading')
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button className="search-clear" type="button" aria-label="Clear search" onClick={clearSearch}>
            ×
          </button>
        )}
      </div>
      {open && (
        <section className="search-panel" aria-label="Search results">
          <div className="search-panel-header">
            <span>{status === 'idle' ? 'Find places and businesses' : 'Search results'}</span>
            <button type="button" aria-label="Close search results" onClick={closeSearch}>Close</button>
          </div>
          {status === 'idle' && (
            <p className="search-hint">Try Maxima, cafe, pharmacy, gym, hotel, or bank.</p>
          )}
          {status === 'short' && <p className="search-message">Type at least 2 characters</p>}
          {status === 'loading' && <p className="search-message" role="status">Searching…</p>}
          {status === 'empty' && (
            <p className="search-message">
              {intent === 'service' ? 'No service providers found' : 'No places found'}
            </p>
          )}
          {status === 'error' && (
            <p className="search-message search-message-error" role="alert">
              Search is temporarily unavailable
            </p>
          )}
          {status === 'ready' && (
            <div id={listboxId} className="search-results" role="listbox">
              {results.map((result, index) => {
                const distance = formatSearchDistance(result.distance_m)
                return (
                  <button
                    id={`${listboxId}-option-${result.id}`}
                    key={result.id}
                    className={`search-result${index === activeIndex ? ' search-result-active' : ''}`}
                    type="button"
                    role="option"
                    data-result-type={result.result_type}
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseResult(result)}
                  >
                    <span className="search-result-name">{result.name}</span>
                    {result.result_type === 'provider_service' && result.matched_service ? (
                      <span className="search-result-meta search-result-service">
                        {result.matched_service.name} · Service provider
                      </span>
                    ) : (
                      <span className="search-result-meta">
                        {placeSubcategoryLabel(result.subcategory)}
                        {result.subcategory === result.category ? '' : ` · ${placeCategoryLabel(result.category)}`}
                      </span>
                    )}
                    {(result.address_line || distance) && (
                      <span className="search-result-detail">
                        {[result.address_line, distance].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
