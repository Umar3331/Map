# Architecture

## Local system

Docker Compose runs four long-lived services plus a one-shot RSA PKI generator on one private network:

- `web`: Caddy serving the built PWA on HTTP 5173 and optional local HTTPS 8443;
- `api`: FastAPI on 8000;
- `tiles`: Martin reading spatial tables from PostGIS;
- `db`: PostgreSQL 17 with PostGIS 3.5 and a persistent volume.

The browser uses one origin. Caddy serves static PWA files, proxies `/api/*` and `/health` to FastAPI,
and strips `/tiles` before proxying to Martin. Thus a request to `http://WINDOWS_LAN_IP:5173` never
causes the iPhone to call its own `localhost`. FastAPI, Martin, and Postgres host ports bind only to
Windows loopback. Only Caddy's HTTP 5173 and HTTPS 8443 ports bind to the LAN.

## Map data

The implemented flow is `Geofabrik Lithuania PBF → Osmium buffered Vilnius extract → osm2pgsql flex
output → osm schema → Martin → MapLibre GL JS`. `scripts/map-data.ps1` orchestrates the Windows
workflow entirely through PowerShell and Docker. Downloaded PBFs and generated data are ignored.

The `osm` schema separates imported geographic data from application tables. It contains
`transportation`, `buildings`, `water`, `waterways`, `landuse`, `railways`, `boundaries`, and
`places`. Martin publishes those tables as same-named vector sources while retaining the seeded
`public.vilnius_boundary` source. Browser access remains only through Caddy's `/tiles/*` route.

The MapLibre style factory constructs absolute tile templates from `window.location.origin`. This
preserves the same origin for both `http://localhost:5173` and `https://LAN_IP:8443` without leaking
Martin's loopback-only port or creating mixed content. It intentionally omits a `glyphs` URL:
MapLibre GL JS 6 uses locally available browser fonts in that mode, so street and place labels do
not require a font CDN. No sprite is used. The only external basemap dependency is the one-time or
explicit-update Geofabrik download; runtime basemap dependencies are local. OSM attribution is
mandatory.

MapLibre GL JS 6's worker is bundled explicitly through Vite's `?worker&url` loader and configured
before map construction. The emitted hashed JavaScript worker is part of the Workbox precache.
Caddy serves `/assets/*` strictly, so a missing worker returns 404 instead of the SPA HTML shell.

Transportation tiles use the `osm.transportation_tiles(z, x, y)` PostGIS function. It retains only
class and name, simplifies geometry at lower zooms, and progressively adds minor roads through z14.
The public URL remains `/tiles/transportation/{z}/{x}/{y}` while Caddy maps it to the Martin function.

## PWA and HTTPS

Vite PWA tooling generates the manifest and Workbox service worker. Browsers treat `localhost` as a
secure development context, but a plain LAN IP is not a secure context. Caddy therefore also offers
local HTTPS using its private CA. A physical iPhone must explicitly install and trust that CA before
using the HTTPS endpoint; no browser security is disabled and no certificate/private key is committed.
See `docs/IPHONE_INSTALLATION.md`.

Caddy issues an RSA-2048 HTTPS leaf certificate for the exact `MAP_HOST` value through the dedicated
`map_rsa` internal CA. A one-shot Compose service creates a persistent RSA-2048 root and intermediate
in separate named volumes: `rsa-pki-public` contains only certificates, while `rsa-pki-private`
contains the CA keys and is mounted only by the generator and Caddy. The API receives only the public
volume. This separate CA ID and storage prevent Caddy's earlier default ECC CA or cached ECC leaf from
being selected.

Caddy uses `MAP_HOST` as both its default SNI for clients that omit SNI and its fallback SNI for
clients that send an unmatched connection hostname. Both paths select the same managed IP-SAN leaf;
this accommodates IP-literal Safari connections and makes published-port TLS checks deterministic.

The public root is available at the exact `/local-ca.crt` fallback route. The preferred
`/local-ca.mobileconfig` route is proxied to FastAPI, which reads the public `root.crt` and
`intermediate.crt` and dynamically creates an Apple certificate profile for the complete CA chain.
Stable profile and payload UUIDs derive from the public certificate fingerprints. Neither HTTP route
can read or expose a CA private key. Caddy's managed RSA leaf state remains under `/data` in the
persistent `caddy-data` volume, and no PKI state is bind-mounted into the repository.

## Application places

Basemap imports and product entities are separate boundaries. `osm.*` and `app_import.*` are
replaceable source/import structures; application behavior reads persistent `app.*` tables.
`app.places` uses a stable internal identity, an OSM source/external-ID uniqueness constraint, a
PostGIS point, normalized category fields, optional consumer details, lifecycle status, and import
timestamps. `app.place_sources` records attribution, licence, and source URLs, while
`app.place_import_runs` records validation metrics.

The Windows-first flow is `Vilnius PBF → places.lua → app_import staging → validated SQL upsert →
app.places`. Missing names, invalid/out-of-bounds geometry, non-Lithuanian records, and duplicate
source IDs are measured before application records become active. A complete refresh marks vanished
OSM records inactive instead of reassigning their internal IDs.

FastAPI exposes bounded read-only queries through `/api/v1/places` and full records through
`/api/v1/places/{id}`. The list query uses the `places_geom_idx` GiST index and returns compact
GeoJSON capped at 500 features plus returned/total/truncated metadata. A same-filter count query
makes the bounded response explicit. A small database connection pool avoids reconnecting during
map pans. The PWA debounces `moveend`, aborts stale requests, and updates one MapLibre GeoJSON source.
Native cluster, cluster-count, category circle, and selected-place layers remain above the basemap.
Clustering runs only for complete responses; truncated broad views clear partial features and show
zoom guidance. React renders only the details panel, never thousands of DOM markers.

## Search and discovery

`GET /api/v1/search` queries only active `app.places` rows. PostgreSQL performs normalized exact,
prefix, substring, and `pg_trgm` similarity matching, with optional category filtering. A small API
alias map converts common discovery terms such as `coffee`, `pharmacy`, and `car repair` into the
existing Map category/subcategory taxonomy; it does not alter stored names or provenance.

Ranking first classifies the normalized request as name or category intent. Ordinary names retain
exact, prefix, and trigram tiers before geographic signals. A recognized category alias instead
uses its exact mapped category/subcategory as the candidate set, so a fitness centre need not contain
`gym` in its name. Viewport and distance order equivalent taxonomy candidates. Meaningful brand
punctuation is retained for intent classification, so `Gym+` remains a name search even though its
stored normalized name is `gym`. Prefix, trigram GIN, subcategory, category, and spatial indexes keep
the query bounded at a maximum of 25 compact results.

The PWA debounces search by 250 ms and aborts stale requests. The accessible combobox/listbox works
with keyboard or touch. Meaningful results populate an unclustered `app-search-results` GeoJSON
source while all normal `app-places` layers are hidden. Search point and selected-result layers make
the bounded ranked set explicit without implying a total category count. Clear or dismiss empties
the search source and restores normal viewport clustering. Selecting a result eases MapLibre to zoom
16, highlights it in the search source, loads `/api/v1/places/{id}`, and opens the existing details
UI. Search remains entirely inside the same-origin local chain: browser → Caddy → FastAPI → PostgreSQL.

## Configuration and persistence

`.env` owns ports and `MAP_HOST`; it is never committed. `setup.ps1` detects an active LAN address
when possible. PostGIS, Caddy leaf state, and the separated public/private RSA CA state use named
Docker volumes. Geolocation is handled entirely by the browser, requested only through MapLibre's
control, not continuously tracked, stored, or sent.

## Future cloud boundaries

Cloud work remains deferred. Candidate mappings—not commitments—include PostGIS to RDS, FastAPI and
the web gateway to container hosting, and generated map assets to object storage/CDN. AWS, Terraform,
Kubernetes, authentication, routing, and marketplace workflows are outside Milestone 1.
