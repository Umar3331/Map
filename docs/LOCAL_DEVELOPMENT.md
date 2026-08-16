# Local development

The normal full stack runs in Docker:

```powershell
.\scripts\setup.ps1
.\scripts\map-data.ps1
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

The production PWA uses Workbox automatic updates. After rebuilding the web image, an already-open
tab or installed iPhone PWA can briefly run the previous cached application shell while the new
service worker activates. For a one-time verification, reload the browser twice; on iPhone, fully
close and reopen the installed PWA. Do not remove the service worker or disable caching.

Before Milestone 1.1 is merged, add zoom-dependent filtering/generalization for oversized vector
tiles. The current transportation source is approximately 1.32 MiB at z11 and 652 KiB at z12. This
does not block the URL-resolution rendering fix, but it is too large for polished mobile performance.
