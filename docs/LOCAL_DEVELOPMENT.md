# Local development

The normal full stack runs in Docker:

```powershell
.\scripts\setup.ps1
.\scripts\map-data.ps1
.\scripts\places-data.ps1
.\scripts\start.ps1
.\scripts\health.ps1
docker compose ps
docker compose logs -f web api tiles db
.\scripts\stop.ps1
```

Map is at `http://localhost:5173`; API documentation is at `http://localhost:8000/docs`. Requests to
`/api` and `/tiles` on the Map origin are proxied internally. Postgres and Martin are not exposed to
other LAN devices.

For frontend-only iteration, keep backend services running and use:

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev
```

Vite binds to `0.0.0.0` and proxies to local Docker ports. The installable service worker is generated
and exercised by the production Docker build, not Vite's development server.

Checks:

```powershell
cd apps\web
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:build
npm.cmd run test:e2e
cd ..\..
docker compose config --quiet
.\scripts\validate-rsa-pki.ps1
```

## Vilnius basemap data

Run once after setup and whenever the PostGIS volume is new:

```powershell
.\scripts\map-data.ps1
```

The command checks Docker/Compose, downloads the current Geofabrik Lithuania extract if absent,
validates the PBF, extracts the buffered Vilnius bounds, imports the `osm` schema, verifies every
table is non-empty, and restarts Martin. Use `.\scripts\map-data.ps1 -Update` to deliberately replace
the source download and rebuild the extract/import. An interrupted download remains a `.download`
file and cannot replace the previously validated PBF.

Current local measurements on the Windows ASUS development machine (2026-08-13): Lithuania PBF
211.7 MiB, Vilnius PBF 17.9 MiB, imported `osm` tables and indexes 67.6 MiB, and osm2pgsql import
about 7 seconds. The running containers used approximately 298 MiB combined at idle (PostGIS 215,
API 42, Martin 24, Caddy 17 MiB). Downloads vary over time and resource use varies by workload.

After images and data are present, Internet is not needed at runtime. To validate manually, disable
the laptop's Internet access without disabling the local Wi-Fi/LAN, keep Docker running, reload Map,
and check city centre, a residential district, a major interchange, a park, and the Neris. Confirm
roads, buildings, water/green areas, labels, pan/zoom, `/health`, and `/tiles/*` continue working.
Browser developer tools must show no public tile, glyph, sprite, Mapbox, or CDN request. A physical
iPhone must remain on the same LAN; only the user can complete that final device/offline check.

The production PWA uses Workbox automatic updates. Its hashed MapLibre worker is emitted by Vite,
validated after every production build, and included in the precache. Caddy never applies the SPA
fallback under `/assets/*`; missing worker or bundle URLs return 404. The Playwright production smoke
test checks all eight vector sources, pan/zoom, geolocation, the worker MIME type, and same-origin-only
runtime requests against a running stack.

After rebuilding the web image, an already-open tab or installed iPhone PWA can briefly run the
previous cached application shell while the new
service worker activates. For a one-time verification, reload the browser twice; on iPhone, fully
close and reopen the installed PWA. Do not remove the service worker or disable caching.

Transportation uses a zoom-aware PostGIS tile function. On the Windows reference dataset it reduced
representative road tiles from 1,321,811 to 43,611 bytes at z11 and from 651,187 to 29,446 bytes at
z12. z13 and z14 examples measured 27,923 and 44,906 bytes. Run `map-data.ps1` after changing the SQL
function so Martin discovers the current definition.

## Application place data

Run the application-owned place import after `map-data.ps1` and whenever the PostGIS volume is new:

```powershell
.\scripts\places-data.ps1
```

The command reuses the validated, buffered Vilnius PBF, imports disposable candidates with
osm2pgsql flex, and upserts them into stable `app.places` identities. It is safe to rerun: unchanged
source objects retain their place IDs, and objects absent from the new snapshot become inactive
instead of disappearing. Use `-Update` to refresh the Lithuania download and Vilnius extract first.
Import history and skip counts are recorded in `app.place_import_runs`.

Validate the latest two imports with:

```powershell
.\scripts\validate-places.ps1
```

The map requests only the visible bounding box. The list endpoint is
`GET /api/v1/places?west=...&south=...&east=...&north=...&category=...&limit=...`; category is
optional and limit is capped at 500. `GET /api/v1/places/{id}` returns optional details and source
provenance. The FeatureCollection `meta` object reports `returned`, `total`, and `truncated`. A broad
truncated viewport displays zoom guidance instead of incomplete clusters; zoom in until the response
is complete to inspect and select places. See `docs/PLACES_DATA.md` for taxonomy, attribution, and
licensing details.
