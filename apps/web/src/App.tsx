import { useEffect, useState } from 'react'

import { loadConfig, type MapConfig } from './config'
import { MapView } from './MapView'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; config: MapConfig }
  | { status: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    loadConfig(controller.signal)
      .then((config) => setState({ status: 'ready', config }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Map configuration is unavailable',
        })
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="app-shell">
      {state.status === 'ready' && <MapView config={state.config} />}
      <header className="top-bar">
        <div className="brand" aria-label="Map home">M</div>
        <div className="search-shell" role="search" aria-label="Search is coming in a future milestone">
          <span className="search-icon" aria-hidden="true" />
          <span>Search Vilnius</span>
          <span className="coming-soon">Soon</span>
        </div>
      </header>
      {state.status === 'loading' && (
        <section className="status-card" role="status">
          <span className="status-pulse" />
          Preparing Vilnius…
        </section>
      )}
      {state.status === 'error' && (
        <section className="status-card status-error" role="alert">
          <strong>Map could not start</strong>
          <span>{state.message}</span>
        </section>
      )}
    </main>
  )
}
