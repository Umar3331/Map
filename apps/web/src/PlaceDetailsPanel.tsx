import type { PlaceDetails } from './places'
import { placeCategoryLabel, placeSubcategoryLabel } from './places'

type PlaceDetailsPanelProps = {
  place: PlaceDetails
  onClose: () => void
}

export function PlaceDetailsPanel({ place, onClose }: PlaceDetailsPanelProps) {
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
      <p className="place-attribution">{place.attribution}</p>
    </aside>
  )
}
