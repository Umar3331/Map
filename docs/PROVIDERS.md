# Providers and services

Milestone 4 introduces application-owned service-provider profiles without changing the meaning of a
place or implementing availability and booking.

## Domain boundaries

- **Place:** geographic location or physical POI in `app.places`; owns address and geometry.
- **Provider:** durable business/entity identity in `app.providers`.
- **Provider location:** `app.provider_locations` links a provider to a place without copying location
  fields. The unique `(provider_id, place_id)` pair supports future multi-location providers.
- **Service type:** normalized catalogue entry in `app.service_types`.
- **Provider service:** `app.provider_services` says that a provider offers a service type.

`price_amount`, `price_currency`, and `duration_minutes` exist for future trustworthy data. The OSM
seed does not populate them, and the UI omits them when null. There are no booking buttons.

## Initial seed and provenance

Run after the place import:

```powershell
.\scripts\provider-data.ps1
.\scripts\validate-providers.ps1
```

The script installs the idempotent schema, selects active service-oriented places, creates or updates
providers, links their places, assigns curated services, records provenance/import metrics, and runs
database validation. If place data is empty it invokes the existing place import first.

Every imported provider has an `app.provider_sources` record containing the original place source ID,
external ID, originating place, and import time. Attribution, licence, and source URL remain in the
referenced `app.place_sources` record and are returned by the provider API.

The initial identity rule is deliberately conservative: one source place maps to one provider. Exact
source identity makes repeat runs stable. Repeated names such as Lemon Gym, Gym+, Maxima, or Rimi are
not merged, because a normalized name alone cannot prove common ownership. The schema supports later
entity-resolution and multi-location consolidation without changing place identity.

## Curated service mapping

The 27-type catalogue covers selected beauty/hair, automotive, fitness, health/dental, professional,
and local-service verticals. Representative mappings include:

| Place subcategory | Service types |
| --- | --- |
| `hairdresser` | `haircut`, `hair_styling` |
| `beauty` | `beauty_treatment` |
| `car_repair` | `vehicle_repair` |
| `tyres` | `tyre_service` |
| `fitness_centre` | `gym_membership`, `group_fitness` |
| `sports_centre` | `sports_facility_access` |
| `dentist` | `dental_checkup`, `teeth_cleaning` |
| `clinic`, `doctors` | `medical_consultation` |
| `lawyer` | `legal_consultation` |
| `tailor` | `alterations` |
| `laundry`, `dry_cleaning` | `laundry_service` |

Food and general retail are intentionally excluded. The mapping is a taxonomy-level statement, not
a claim about price, duration, availability, or the complete menu of an individual provider.

## Read-only API

- `GET /api/v1/places/{place_id}/providers` returns compact provider summaries and service counts.
- `GET /api/v1/providers/{provider_id}` returns profile fields, active locations, and provenance.
- `GET /api/v1/providers/{provider_id}/services` returns active normalized offerings.

Inactive providers, locations, places, services, and service types are excluded. Provider detail and
service responses intentionally do not duplicate place geometry or full place provenance.

## UI behavior

Provider-backed place details show a compact Provider section. Opening a summary replaces the place
view with a provider profile in the same desktop card or mobile bottom sheet. Back returns to the
place; close dismisses the whole detail flow. Only available contact fields render. Services are
grouped by category, and locations retain their source place names and addresses.

Ordinary brand/place and category searches continue to search `app.places`. A small exact alias map
classifies known service terms and joins active service types, provider offerings, provider locations,
and places. Service results explain the matched service and open the existing provider profile at the
selected location; they do not create a second profile UI. This is controlled service discovery, not
general provider/service full-text search.

The current catalogue has `massage` but no dedicated spa/wellness service. Consequently `spa` maps
narrowly to `massage`. It never falls through to arbitrary place-name substrings such as `spauda` or
`Spartuko`; unsupported known service terms return an honest empty result.

## Validation and current measurements

The validator checks required tables and indexes, foreign keys, uniqueness, non-empty names, valid
references, provenance, inactive-link consistency, idempotent recent imports, and absence of seeded
commercial data. On the current Vilnius snapshot the seed creates 940 active providers, 940 active
provider locations, and 1,249 active service assignments across 27 service types; 3,784 places are
outside the selected service taxonomy.

Representative PostgreSQL execution times on the Windows development machine are below 0.2 ms for
provider lookup, provider services, and place providers. Warm same-origin API calls are typically
about 2–4 ms locally.

## Known limitations

- Initial providers are source-place identities, not resolved legal companies or grouped brands.
- OSM contact fields can be incomplete or stale; profiles are explicitly unverified.
- Service assignments are curated taxonomy mappings, not provider-authored catalogues.
- No provider editing, claiming, verification, account, real schedule management, calendar,
  booking, payment, review, rating, or recommendation workflow exists. Milestone 5 adds only
  read-only, explicitly demo availability for selected provider offerings; see
  `docs/AVAILABILITY.md`.
