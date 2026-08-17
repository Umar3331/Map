# Availability foundation

Milestone 5 answers a read-only question: when is one provider service available at one provider
location? It does not create bookings and it does not claim to publish real business schedules.

## Domain model

- `app.bookable_offerings` binds a provider, provider location, and provider service. Composite
  foreign keys ensure all three belong to the same provider. Duration, slot interval, capacity,
  timezone, status, and demo provenance live on the offering.
- `app.availability_rules` stores recurring local-time windows per ISO weekday. Several windows
  support split days.
- `app.availability_exceptions` marks a local date `closed` or `override`.
- `app.availability_exception_windows` stores replacement windows for an override.

An exception replaces the weekly schedule for its date. Business opening hours are not scheduling
availability, and Map does not derive these rules from OSM `opening_hours`.

## Development fixtures

```powershell
.\scripts\availability-data.ps1
.\scripts\validate-availability.ps1
```

The idempotent seed selects one deterministic active provider for each of `vehicle_repair`,
`haircut`, `dental_checkup`, `massage`, and `group_fitness`. It installs five offerings, 33 weekly
windows, four exceptions, and two override windows. Fixtures cover split days, closures, shortened
overrides, different durations and intervals, and capacity greater than one. Every row is marked
`is_demo = true` with source `development_fixture`. These are development examples, not hours
supplied or verified by the named businesses.

## Read-only API

- `GET /api/v1/providers/{provider_id}/offerings` lists active configured offerings.
- `GET /api/v1/offerings/{offering_id}/availability?date=2026-08-20` returns one day.
- `GET /api/v1/offerings/{offering_id}/availability?from=2026-08-20&to=2026-08-26`
  returns an inclusive range of at most 31 days.

```json
{
  "offering": {
    "id": 10,
    "service": {"code": "vehicle_repair", "name": "Vehicle repair"},
    "duration_minutes": 60,
    "slot_interval_minutes": 30,
    "capacity": 1,
    "is_demo": true
  },
  "timezone": "Europe/Vilnius",
  "from": "2026-08-20",
  "to": "2026-08-20",
  "days": [{
    "date": "2026-08-20",
    "status": "scheduled",
    "slots": [{
      "starts_at": "2026-08-20T09:00:00+03:00",
      "ends_at": "2026-08-20T10:00:00+03:00",
      "starts_at_utc": "2026-08-20T06:00:00Z",
      "ends_at_utc": "2026-08-20T07:00:00Z",
      "capacity": 1
    }]
  }],
  "demo_notice": "Development availability only — not real provider scheduling data."
}
```

The API validates dates and offering IDs, uses parameterized SQL, excludes inactive domain links,
and executes a fixed three-query read regardless of range length. It exposes no write route.

## Timezone and slot generation

Rules use the IANA `Europe/Vilnius` timezone, never a fixed offset. Slots advance by the configured
interval and must fit their full real elapsed duration inside the local window. A timezone round-trip
rejects nonexistent spring-forward wall times. Ambiguous autumn wall times use the earlier fold
consistently, preventing duplicate local starts. Responses include offset-aware local timestamps and
UTC instants.

Warm production API measurements on 2026-08-17 were 4.36 ms median for one day, 7.14 ms for seven
days, and 14.01 ms for the 31-day maximum. Exact timings vary by machine and Docker state.

## UI and limitations

Configured services show **View availability**. The responsive sheet loads seven dates, renders
slots as touch targets, distinguishes closed/no-schedule/no-availability states, and supports back
and close. Selecting a slot only highlights it; no booking is created. Services without fixtures
say no schedule is configured.

A future reservation boundary should store UTC `tstzrange` intervals, lifecycle status, capacity
consumption, idempotency keys, and auditable transitions. A GiST exclusion constraint can prevent
overlapping active reservations for capacity-one offerings. No reservation table or public write is
included until authentication, personal-data, cancellation, idempotency, and notifications are
designed. Staff, rooms, equipment, external calendars, and real provider schedule management are
also deferred.
