import type { BookableOffering } from './availability'
import type { ProviderProfile, ProviderService } from './providers'
import { serviceCategoryLabel } from './providers'

type ProviderProfilePanelProps = {
  provider: ProviderProfile
  services: ProviderService[]
  offerings: BookableOffering[]
  onViewAvailability: (offering: BookableOffering) => void
  onBack: () => void
  onClose: () => void
}

export function ProviderProfilePanel({
  provider,
  services,
  offerings,
  onViewAvailability,
  onBack,
  onClose,
}: ProviderProfilePanelProps) {
  const serviceGroups = services.reduce<Map<string, ProviderService[]>>((groups, service) => {
    const categoryServices = groups.get(service.category) ?? []
    categoryServices.push(service)
    groups.set(service.category, categoryServices)
    return groups
  }, new Map())

  return (
    <aside className="place-details provider-profile" role="dialog" aria-label="Provider profile">
      <div className="provider-profile-actions">
        <button className="provider-back" type="button" onClick={onBack} aria-label="Back to place details">
          ← Place
        </button>
        <button className="place-details-close" type="button" onClick={onClose} aria-label="Close provider profile">
          ×
        </button>
      </div>
      <span className="provider-eyebrow">Service provider</span>
      <h1>{provider.display_name}</h1>
      {provider.legal_name && provider.legal_name !== provider.display_name && (
        <p className="place-subcategory">{provider.legal_name}</p>
      )}
      {provider.description && <p className="place-description">{provider.description}</p>}
      <dl>
        {provider.phone && <><dt>Phone</dt><dd><a href={`tel:${provider.phone}`}>{provider.phone}</a></dd></>}
        {provider.email && <><dt>Email</dt><dd><a href={`mailto:${provider.email}`}>{provider.email}</a></dd></>}
        {provider.website && <><dt>Website</dt><dd><a href={provider.website} rel="noreferrer">Visit website</a></dd></>}
      </dl>
      {services.length > 0 && (
        <section className="provider-services" aria-labelledby="provider-services-heading">
          <h2 id="provider-services-heading">Services</h2>
          {[...serviceGroups.entries()].map(([category, categoryServices]) => (
            <div className="service-group" key={category}>
              <h3>{serviceCategoryLabel(category)}</h3>
              <ul>
                {categoryServices.map((service) => (
                  <li key={service.id}>
                    <strong>{service.display_name ?? service.name}</strong>
                    {service.description && <span>{service.description}</span>}
                    {(service.price_amount || service.duration_minutes) && (
                      <small>
                        {service.price_amount && service.price_currency
                          ? `${service.price_amount} ${service.price_currency}`
                          : ''}
                        {service.price_amount && service.duration_minutes ? ' · ' : ''}
                        {service.duration_minutes ? `${service.duration_minutes} min` : ''}
                      </small>
                    )}
                    {offerings.filter((offering) => (
                      offering.provider_service_id === service.provider_service_id
                    )).map((offering) => (
                      <button
                        key={offering.id}
                        className="availability-link"
                        type="button"
                        onClick={() => onViewAvailability(offering)}
                      >
                        View availability
                        <small>{offering.place_name}</small>
                      </button>
                    ))}
                    {!offerings.some((offering) => (
                      offering.provider_service_id === service.provider_service_id
                    )) && (
                      <small className="availability-unconfigured">No schedule configured</small>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {provider.locations.length > 0 && (
        <section className="provider-locations" aria-labelledby="provider-locations-heading">
          <h2 id="provider-locations-heading">Locations</h2>
          <ul>
            {provider.locations.map((location) => {
              const address = [location.address_line, location.postal_code, location.city]
                .filter(Boolean).join(', ')
              return (
                <li key={location.place_id}>
                  <strong>{location.place_name}</strong>
                  {address && <span>{address}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {provider.sources[0] && (
        <p className="place-attribution">{provider.sources[0].attribution}</p>
      )}
    </aside>
  )
}
