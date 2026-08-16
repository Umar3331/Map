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
