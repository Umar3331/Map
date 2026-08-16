# Milestone 1 acceptance

This checklist is the completed merge gate for **Map v0.1 — Vilnius PWA**. Automated checks were
recorded by CI and the Windows development run. The user confirmed the physical-device checks on a
real iPhone using `https://192.168.8.237:8443`.

## Automated and Windows checks

- [x] `scripts/setup.ps1` and `scripts/start.ps1` start the Windows stack successfully.
- [x] `scripts/health.ps1` verifies the same-origin API health and Vilnius config endpoints.
- [x] PostGIS reports its enabled version and the seeded Vilnius boundary exists.
- [x] Martin serves the `vilnius_boundary` vector tile.
- [x] The desktop PWA renders Vilnius and MapLibre pan/zoom controls work.
- [x] The responsive layout fits a mobile-size browser viewport and respects safe areas.
- [x] The manifest, service worker, Apple touch icon, and install icons are served.
- [x] OpenStreetMap attribution remains visible on the map.
- [x] Frontend lint, typecheck, tests, production build, backend lint/tests, and Compose validation pass.

## Manual LAN and physical-iPhone checks

- [x] HTTPS opens successfully from another device on the same LAN.
- [x] `/local-ca.mobileconfig` shows **Profile Downloaded** and **Map Local Development CA** can be
  installed and trusted on the iPhone.
- [x] The RSA root certificate has Full Trust enabled on the physical iPhone.
- [x] Map opens in iPhone Safari over the printed HTTPS URL without a certificate warning.
- [x] Safari successfully renders the Vilnius map on the physical iPhone.
- [x] Safari can add Map to the iPhone Home Screen with **Open as Web App** enabled.
- [x] The installed Map launches in standalone mode rather than normal Safari chrome.
- [x] Pan, pinch zoom, and rotation work on the physical iPhone.
- [x] One-shot geolocation permission works when allowed; location is not continuously tracked or sent.
- [x] OpenStreetMap attribution is visible on the physical iPhone.

The final TLS compatibility setting is Caddy's `default_sni {$MAP_HOST}` plus
`fallback_sni {$MAP_HOST}`. Both true no-SNI IP clients and clients with an unmatched connection
hostname receive the active RSA IP-SAN leaf. Milestone 1 acceptance passed on 2026-08-13.

## Milestone 1.1 acceptance

- [x] Validated Lithuania PBF is extracted to the buffered Vilnius bounds with containerized Osmium.
- [x] osm2pgsql flex import creates eight non-empty feature tables in the separate `osm` schema.
- [x] Martin publishes and serves non-empty road, building, water, landuse, and place vector tiles.
- [x] MapLibre style has no public OSM raster, Mapbox, glyph-provider, sprite-provider, or CDN URL.
- [x] Frontend/API automated guards reject runtime external basemap URLs.
- [x] Connected Windows full-stack health and local tile requests pass.
- [x] Production browser runtime reports content events for all eight same-origin vector sources
  using absolute URLs derived from the current browser origin.
- [x] Production MapLibre worker is emitted as hashed JavaScript, precached, served with a JavaScript
  MIME type, and missing `/assets/*` files return 404 instead of the SPA shell.
- [x] Windows Edge visibly renders Vilnius roads, buildings, water, green areas, and labels; its
  fresh console has no worker, module, MIME, or MapLibre error.
- [x] Playwright exercises pan/zoom and geolocation, receives 200 tiles for all eight sources, and
  proves all runtime HTTP requests stay on the Map origin.
- [x] Zoom-aware transportation tiles replace the oversized raw-table route; measured examples are
  43,611 bytes at z11 and 29,446 bytes at z12.
- [x] Windows production-browser validation rendered representative Vilnius features and proved every
  runtime HTTP request stays on the local Map origin, so external Internet is not required at runtime.
- [x] On 2026-08-16, the user confirmed on a physical iPhone with Internet unavailable and local
  Wi-Fi/LAN active that HTTPS opens, the self-hosted basemap renders roads, buildings, the Neris,
  parks/green areas, and labels, and pan/zoom work.

Milestone 1.1 physical-iPhone offline acceptance passed on 2026-08-16.

## Milestone 2 acceptance

- [x] A repeatable, Windows-first OSM importer populates application-owned `app.places` data.
- [x] Two consecutive imports preserve active place count and stable source identities.
- [x] Spatial, category, and normalized-name indexes exist and imported geometries remain inside the
  buffered Vilnius/Lithuania scope.
- [x] Bounded GeoJSON list and place-detail APIs expose provenance without exposing the raw OSM
  schema as the application contract.
- [x] MapLibre renders application places with native clustering and category-aware markers.
- [x] Selecting a marker loads a dismissible desktop card or mobile bottom sheet; absent optional
  fields are omitted cleanly.
- [x] Moving the map reloads only the visible viewport and a failed place request does not break the
  self-hosted basemap.
- [x] Bounded responses report total/returned/truncated metadata; broad truncated views suppress
  incomplete clusters and show unobtrusive zoom guidance.
- [x] Frontend unit tests, backend tests, Compose validation, live importer validation, and the
  production Playwright browser suite pass.
- [x] Playwright verifies real marker selection, detail rendering, dismissal, viewport reload, and a
  390-by-844 responsive layout with no horizontal overflow.
- [x] On 2026-08-17, the user confirmed on a physical iPhone that broad viewports show truncation
  guidance, zoomed-in complete clusters and markers render, markers are selectable, and selecting a
  different place updates the mobile bottom sheet with the correct details.
- [x] On the physical iPhone, the details sheet dismisses correctly, panning reloads places, the
  layout has no horizontal overflow, and the existing HTTPS/PWA behavior remains correct.

Milestone 2 physical-iPhone acceptance passed on 2026-08-17.

## Milestone 3 acceptance

- [x] Search reads only active `app.places` data and returns compact results without full provenance.
- [x] Exact, prefix, partial, category alias, and lightweight trigram typo searches are deterministic.
- [x] Search normalization handles case, outer/repeated whitespace, punctuation, and UTF-8 names
  without changing canonical names or removing Lithuanian diacritics.
- [x] PostgreSQL prefix, trigram GIN, category, subcategory, and spatial indexes are installed and
  representative `EXPLAIN ANALYZE` plans avoid inappropriate sequential scans.
- [x] Ordinary brand/name searches use exact, prefix, and fuzzy name relevance before geographic
  context; recognized aliases use exact application taxonomy as their candidate set.
- [x] `gym` includes `fitness_centre` records without `gym` in their names, while `Gym+` and
  `Lemon Gym` remain name-oriented brand searches.
- [x] Desktop results support Arrow Up/Down, Enter, Escape, clear, and accessible combobox/listbox
  semantics.
- [x] Result selection moves MapLibre to zoom 16, selects the place, and reuses the existing place
  details card or mobile bottom sheet.
- [x] Meaningful results activate dedicated unclustered search-result and selected-result layers,
  hide unrelated normal viewport POIs, and clear/dismiss restores normal clustering.
- [x] The 390-by-844 production layout has touch-friendly results, a clean search-to-details
  transition, and no horizontal overflow.
- [x] Live quality checks pass for Maxima, Rimi, cafe, restaurant, pharmacy, gym, hotel, bank, and
  representative prefix/typo queries.
- [x] Frontend/backend tests, production build, Compose/live validation, six Playwright production
  scenarios, and Windows Edge visual/console checks pass.
- [x] On 2026-08-17, physical-iPhone re-acceptance confirmed that `gym` discovers taxonomy-based
  `fitness_centre` results, including relevant brands such as Lemon Gym, while `Gym+` remains a
  name-oriented brand query.
- [x] On the physical iPhone, active search hides unrelated normal POIs while keeping search-result
  markers visible; selection focuses the map and opens the existing details bottom sheet.
- [x] Clearing or dismissing search restores normal viewport POIs, mobile keyboard behavior remains
  usable, and there is no horizontal overflow or broken layout.
- [x] Existing physical-iPhone HTTPS and installed-PWA behavior remains correct after the search
  ranking and MapLibre search-mode changes.

Milestone 3 physical-iPhone acceptance passed on 2026-08-17.
