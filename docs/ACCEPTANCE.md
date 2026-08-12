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

## Milestone 1.1 draft acceptance

- [x] Validated Lithuania PBF is extracted to the buffered Vilnius bounds with containerized Osmium.
- [x] osm2pgsql flex import creates eight non-empty feature tables in the separate `osm` schema.
- [x] Martin publishes and serves non-empty road, building, water, landuse, and place vector tiles.
- [x] MapLibre style has no public OSM raster, Mapbox, glyph-provider, sprite-provider, or CDN URL.
- [x] Frontend/API automated guards reject runtime external basemap URLs.
- [x] Connected Windows full-stack health and local tile requests pass.
- [ ] With laptop Internet disconnected but LAN active, visually verify five representative Vilnius
  areas, labels, pan/zoom, API, and tiles in a desktop browser.
- [ ] User verifies the self-hosted map on the physical iPhone with Internet unavailable but local
  Wi-Fi/LAN active. Do not mark this passed based on desktop or automated testing.
