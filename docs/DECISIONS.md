# Architecture decisions

Each accepted decision applies until superseded by a later ADR.

## ADR-001 — Vilnius-only initial geography
**Status:** Accepted. **Context:** A bounded prototype reduces data and operational complexity.
**Decision:** Milestone 1 covers only Vilnius. **Consequences:** Global assumptions and planet-scale
imports are prohibited; expansion requires later milestones.

## ADR-002 — iOS is initial consumer platform
**Status:** Superseded by ADR-016. **Context:** The first intended consumer experience was an iPhone
binary. **Decision:** Initially prioritize native iOS. **Consequences:** The prototype is preserved in
`archive/ios-prototype`; it is not part of the active Milestone 1 build.

## ADR-003 — Windows is primary development environment
**Status:** Accepted. **Context:** The primary machine runs Windows 11. **Decision:** PowerShell and
Docker Desktop are the default workflow. **Consequences:** WSL may be optional, never mandatory.

## ADR-004 — SwiftUI native iOS client
**Status:** Superseded by ADR-016. **Context:** A modern Apple-native interface was initially desired.
**Decision:** The first prototype used SwiftUI. **Consequences:** Source is archived for possible
future evaluation; no native Swift work belongs to Milestone 1 unless explicitly requested.

## ADR-005 — MapLibre
**Status:** Accepted. **Context:** The client needs an open map renderer with vector support.
**Decision:** Use the MapLibre ecosystem; the active PWA uses MapLibre GL JS. **Consequences:** We
maintain style and data-source configuration without a Google Maps dependency.

## ADR-006 — OpenStreetMap
**Status:** Accepted. **Context:** Open geographic source data supports local control. **Decision:**
Use OSM-derived map data. **Consequences:** ODbL obligations and attribution must be respected.

## ADR-007 — PostgreSQL/PostGIS
**Status:** Accepted. **Context:** Geographic queries need a durable spatial store. **Decision:** Use
PostgreSQL with PostGIS. **Consequences:** Spatial migrations, indexes, and operations matter.

## ADR-008 — FastAPI
**Status:** Accepted. **Context:** A small typed API is needed. **Decision:** Use Python/FastAPI.
**Consequences:** Keep the initial API small and test endpoint contracts.

## ADR-009 — Docker Compose
**Status:** Accepted. **Context:** Local services must be repeatable on Windows. **Decision:** Use
Compose. **Consequences:** Docker Desktop is the principal runtime prerequisite.

## ADR-010 — Local-first
**Status:** Accepted. **Context:** Milestone 1 is a laptop-hosted proof of concept. **Decision:** Run
API, data, and tiles locally. **Consequences:** LAN configuration is explicit; production concerns wait.

## ADR-011 — AWS intentionally deferred
**Status:** Accepted. **Context:** Cloud design now would be speculative. **Decision:** Do not deploy or
provision AWS in Milestone 1. **Consequences:** Preserve portable boundaries without locking services.

## ADR-012 — Monorepo
**Status:** Accepted. **Context:** API, infrastructure, client, and docs evolve together. **Decision:**
Keep them in one repository. **Consequences:** Directory boundaries and shared documentation matter.

## ADR-013 — Physical iOS builds require macOS/Xcode
**Status:** Accepted, no longer a Milestone 1 blocker. **Context:** Native Apple tooling does not run
on Windows. **Decision:** Native builds still require macOS if revisited. **Consequences:** The active
PWA has no Xcode requirement.

## ADR-014 — Avoid Google Maps dependency
**Status:** Accepted. **Context:** Local data control is a core architectural goal. **Decision:** Do not
depend on Google Maps. **Consequences:** We own MapLibre styles, tiles, and OSM compliance.

## ADR-015 — Martin serves local vector tiles
**Status:** Accepted. **Context:** Milestone 1 needs a small PostGIS-to-vector-tile path. **Decision:**
Use Martin with PostGIS table discovery. **Consequences:** Operations stay simple; richer cartography
will require curated OSM import tables and styles later.

## ADR-016 — PWA is the initial Map client
**Status:** Accepted. **Context:** The complete active client must be developed, built, tested, and
served from the Windows 11 primary machine while remaining installable on iPhone. **Decision:** Use
React, TypeScript, Vite, MapLibre GL JS, and PWA web standards for Map v0.1. **Consequences:** The
client is fully Windows-buildable, browser-testable, installable from iPhone Safari, and independent
of Xcode. It is not a native App Store binary and some native APIs remain restricted. A native client
can be introduced later without replacing the backend and geographic platform.

## ADR-017 — Same-origin local web gateway
**Status:** Accepted. **Context:** Hardcoded localhost URLs fail from physical phones and cross-origin
configuration adds needless local complexity. **Decision:** Serve the PWA and proxy `/api` and
`/tiles` through Caddy on one origin. **Consequences:** LAN setup is predictable; internal services
remain isolated, while optional locally trusted HTTPS enables secure-context PWA features.

## ADR-018 — Dedicated RSA local development PKI
**Status:** Accepted. **Context:** A physical iPhone could not establish TLS with Caddy's otherwise
valid default ECC local chain after the root and intermediate were installed and the root was fully
trusted. **Decision:** Use a dedicated persistent RSA-2048 root, RSA-2048 intermediate, and RSA-2048
Caddy leaf for local iPhone HTTPS. Keep public certificates and private keys in separate Docker named
volumes, configure a distinct Caddy CA ID, and select the `MAP_HOST` certificate through Caddy's
`default_sni` and `fallback_sni` options. **Consequences:** Existing ECC profiles must be removed
before installing the RSA profile. IP clients that omit SNI receive the active IP-SAN leaf. Private
keys remain local and uncommitted; this compatibility choice applies only to local development and
does not define future production PKI.

## ADR-019 — Curated osm2pgsql flex schema for the Vilnius basemap
**Status:** Accepted. **Context:** Milestone 1's public OSM raster endpoint prevented offline runtime
and the full OpenMapTiles stack would add unnecessary services and operational weight for one city.
**Decision:** Download Geofabrik's Lithuania PBF only at preparation/update time, extract a buffered
Vilnius bounding box with containerized Osmium, and import selected map features through an
osm2pgsql flex configuration into a dedicated `osm` schema. Martin publishes those PostGIS tables
as vector sources and MapLibre owns the local style. Labels use MapLibre GL JS local browser fonts;
no glyph URL or sprite is configured. **Consequences:** Runtime has no public basemap dependency and
the normal Windows workflow stays PowerShell plus Docker. Cartography is intentionally lightweight,
the extract is rectangular rather than an exact municipal polygon, data updates are manual with
`map-data.ps1 -Update`, and OSM attribution/ODbL obligations remain. Client tile templates are
absolute URLs derived from the current browser origin; direct Martin URLs and fixed host/port values
are prohibited. Transportation tiles require deliberate zoom-dependent filtering and generalization
rather than serving the raw road table at every zoom.

## ADR-020 — Explicit MapLibre worker bundling and zoom-aware road tiles
**Status:** Accepted. **Context:** MapLibre GL JS 6 resolved its default worker to a file that Vite had
not emitted. Caddy's SPA fallback returned `index.html` with HTTP 200 at that JavaScript URL, causing
a worker MIME/module failure and a blank map. Raw transportation tiles also measured about 1.32 MiB
at z11 and 652 KiB at z12. **Decision:** Import the MapLibre worker with Vite's `?worker&url` loader,
set its URL before constructing the map, serve `/assets/*` without SPA fallback, and precache the
hashed worker. Publish transportation through a PostGIS tile function that selects zoom-appropriate
road classes and simplification while preserving the existing public URL and layer name.
**Consequences:** Missing assets now return 404, the production worker is a real same-origin
JavaScript bundle, updates activate through Workbox, and representative road tiles are tens of KiB
rather than hundreds of KiB or MiB. The lightweight road policy is explicit and can evolve with
cartographic testing.

## ADR-021 — Application-owned places are separate from OSM import tables
**Status:** Accepted. **Context:** The replaceable `osm.*` tables are optimized for basemap rendering
and cannot provide durable application identity, provenance, lifecycle, or future provider links.
**Decision:** Persist product places in `app.places`, normalize a small Map taxonomy, and retain a
required source plus source-specific external ID. Use disposable `app_import.*` tables to transform
the local OSM snapshot, then validate and upsert into `app.*`. Serve product places through bounded
FastAPI GeoJSON, not Martin basemap tiles, and render them as MapLibre-native clustered layers.
**Consequences:** Basemap refreshes cannot silently redefine application identity; repeated OSM
imports remain idempotent; attribution and licensing remain traceable; future sources can be added
without discarding OSM IDs. Cross-source fuzzy deduplication, provider claims, search, rankings, and
editing workflows remain deferred.

## ADR-022 — PostgreSQL search before a dedicated search service
**Status:** Accepted. **Context:** Milestone 3 searches approximately 4,700 application-owned Vilnius
places. A separate search cluster would add deployment, synchronization, security, and Windows
operational complexity without a demonstrated scale or relevance need. **Decision:** Implement
deterministic local search in PostgreSQL using canonical names, a punctuation/whitespace-normalized
search form, B-tree prefix and subcategory indexes, and a GIN `pg_trgm` index. Keep aliases small and
explicit in FastAPI. Rank textual quality before viewport/distance bias and return at most 25 compact
results. **Consequences:** Search remains transactional with `app.places`, fully local, and simple to
operate. Typo tolerance is deliberately lightweight; multilingual stemming, semantic search,
recommendations, and a dedicated search service remain deferred until measured product needs justify
them.

## ADR-023 — Intent-aware taxonomy discovery and explicit search map mode
**Status:** Accepted. **Context:** Treating every query as name-first caused a recognized term such
as `gym` to over-rank Gym-branded rows and obscure fitness centres whose names lacked that word.
Showing normal viewport POIs alongside a bounded search result set also made the selected search
context visually ambiguous. **Decision:** Classify only recognized aliases as category intent and
use their mapped application taxonomy as the primary candidate set; retain name-first ranking for
brands, including meaningful punctuation such as `Gym+`. Render active results in a separate,
unclustered MapLibre GeoJSON source while hiding normal place layers, then restore browsing layers
on clear or dismiss. **Consequences:** Category discovery is complete with respect to its explicit
taxonomy mapping but still bounded to 25 ranked results. Search markers represent returned results,
not a total category count. Alias mappings require tests against the imported taxonomy.

## ADR-024 — Separate place, provider, location, and service domains
**Status:** Accepted. **Context:** A geographic POI is not a durable business identity, and a provider
may eventually operate at multiple places or offer multiple normalized services. Adding provider
fields directly to `app.places` would couple replaceable OSM location data to future provider and
booking workflows. **Decision:** Keep `app.providers`, `app.provider_locations`, `app.service_types`,
`app.provider_services`, `app.provider_sources`, and `app.provider_import_runs` as explicit
application-owned boundaries. Seed only selected local-service taxonomies from `app.places`, using
exact source identity and one provider per source place until reliable entity resolution exists.
**Consequences:** Address and geometry stay on places; provider provenance and lifecycle are durable;
multi-location grouping is structurally possible but deliberately not inferred from names. Prices,
durations, verification, claims, availability, booking, and provider management remain unimplemented.

## ADR-025 — Controlled service intent extends local search
**Status:** Accepted. **Context:** Once normalized provider offerings exist, a short query such as
`spa` is usually service intent; treating it as a weak place-name substring ranks unrelated names
such as `Lietuvos spauda`. **Decision:** Keep the existing endpoint and classify exact terms into
place/brand, place-category, or service intent. Service aliases map only to existing service-type
codes and query active providers, offerings, locations, and places with parameterized SQL. Known but
unsupported services return an empty service result instead of falling back to name substrings.
**Consequences:** Search remains local and deterministic, service results explain why they matched,
and selection reuses the existing map and provider profile. The alias catalogue is intentionally
small; general provider full-text search and service inference remain deferred.
