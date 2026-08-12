# Architecture

## Local system

Docker Compose runs four services on one private network:

- `web`: Caddy serving the built PWA on HTTP 5173 and optional local HTTPS 8443;
- `api`: FastAPI on 8000;
- `tiles`: Martin reading spatial tables from PostGIS;
- `db`: PostgreSQL 17 with PostGIS 3.5 and a persistent volume.

The browser uses one origin. Caddy serves static PWA files, proxies `/api/*` and `/health` to FastAPI,
and strips `/tiles` before proxying to Martin. Thus a request to `http://WINDOWS_LAN_IP:5173` never
causes the iPhone to call its own `localhost`. FastAPI, Martin, and Postgres host ports bind only to
Windows loopback. Only Caddy's HTTP 5173 and HTTPS 8443 ports bind to the LAN.

## Map data

The target is `OSM Lithuania extract → Vilnius filter → PostGIS → Martin → MapLibre GL JS`. The
reproducible filter is `scripts/map-data.ps1`; PBFs, caches, and generated tiles are ignored. The
current local vector proof serves the seeded Vilnius boundary. Detailed basemap tiles come from the
public OSM raster endpoint as a **TEMPORARY DEVELOPMENT DEPENDENCY** until curated OSM import and
styling are implemented. Attribution is mandatory.

## PWA and HTTPS

Vite PWA tooling generates the manifest and Workbox service worker. Browsers treat `localhost` as a
secure development context, but a plain LAN IP is not a secure context. Caddy therefore also offers
local HTTPS using its private CA. A physical iPhone must explicitly install and trust that CA before
using the HTTPS endpoint; no browser security is disabled and no certificate/private key is committed.
See `docs/IPHONE_INSTALLATION.md`.

Caddy issues the HTTPS leaf certificate for the exact `MAP_HOST` value. Its public CA certificate is
available only at the exact `/local-ca.crt` route; that route rewrites to `root.crt` and never exposes
the CA private key. CA and leaf-key state live under `/data` in the persistent `caddy-data` volume, so
container recreation preserves trust. No Caddy state is bind-mounted into the repository.

## Configuration and persistence

`.env` owns ports and `MAP_HOST`; it is never committed. `setup.ps1` detects an active LAN address
when possible. PostGIS and Caddy CA state use named Docker volumes. Geolocation is handled entirely by
the browser, requested only through MapLibre's control, not continuously tracked, stored, or sent.

## Future cloud boundaries

Cloud work remains deferred. Candidate mappings—not commitments—include PostGIS to RDS, FastAPI and
the web gateway to container hosting, and generated map assets to object storage/CDN. AWS, Terraform,
Kubernetes, authentication, routing, and marketplace workflows are outside Milestone 1.
