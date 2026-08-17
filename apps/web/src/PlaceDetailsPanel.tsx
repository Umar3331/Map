import type { PlaceDetails } from './places'
import { placeCategoryLabel, placeSubcategoryLabel } from './places'
import type { ProviderSummary } from './providers'

type PlaceDetailsPanelProps = {
  place: PlaceDetails
  providers?: ProviderSummary[]
  providersStatus?: 'loading' | 'ready' | 'error'
  onOpenProvider?: (providerId: number) => void
  onClose: () => void
}

export function PlaceDetailsPanel({
  place,
  providers = [],
  providersStatus = 'ready',
  onOpenProvider = () => undefined,
  onClose,
}: PlaceDetailsPanelProps) {
  const address = [place.address_line, place.postal_code, place.city].filter(Boolean).join(', ')

  return (
    <aside className="place-details" role="dialog" aria-label="Place details">
      <button className="place-details-close" type="button" onClick={onClose} aria-label="Close place details">
        ×
      </button>
      <span className={`place-category place-category-${place.category}`}>
        {placeCategoryLabel(place.category)}
      </span>
      <h1>{place.name}</h1>
      <p className="place-subcategory">{placeSubcategoryLabel(place.subcategory)}</p>
      {place.description && <p className="place-description">{place.description}</p>}
      <dl>
        {address && <><dt>Address</dt><dd>{address}</dd></>}
        {place.opening_hours_raw && <><dt>Hours</dt><dd>{place.opening_hours_raw}</dd></>}
        {place.phone && <><dt>Phone</dt><dd><a href={`tel:${place.phone}`}>{place.phone}</a></dd></>}
        {place.website && <><dt>Website</dt><dd><a href={place.website} rel="noreferrer">Visit website</a></dd></>}
      </dl>
      {(providersStatus === 'loading' || providers.length > 0) && (
        <section className="place-providers" aria-labelledby="place-providers-heading">
          <h2 id="place-providers-heading">Provider</h2>
          {providersStatus === 'loading' && <p role="status">Loading provider…</p>}
          {providers.map((provider) => (
            <button
              className="provider-summary"
              type="button"
              key={provider.id}
              onClick={() => onOpenProvider(provider.id)}
            >
              <span>
                <strong>{provider.display_name}</strong>
                <small>{provider.service_count} {provider.service_count === 1 ? 'service' : 'services'}</small>
              </span>
              <span aria-hidden="true">View →</span>
            </button>
          ))}
        </section>
      )}
      {providersStatus === 'error' && (
        <p className="provider-inline-error" role="status">Provider information is temporarily unavailable</p>
      )}
      <p className="place-attribution">{place.attribution}</p>
    </aside>
  )
}
