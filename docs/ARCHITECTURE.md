# Architecture

## Local system

Docker Compose creates one private network containing `api`, `db`, and `tiles`. FastAPI is exposed on
port 8000, Martin on 3000, and PostgreSQL/PostGIS on 5432 (all configurable in `.env`). Only FastAPI
and Martin are application-facing. The database port is exposed for local tooling.

PostGIS uses a named Docker volume, so normal container recreation preserves data. Initialization
enables PostGIS and seeds a small Vilnius development boundary. Martin discovers spatial tables and
serves them as vector tiles. FastAPI's style endpoint derives the tile hostname from the incoming
request, allowing the same endpoint to work through `localhost` or the laptop's LAN IP.

The Martin image is pinned to `ghcr.io/maplibre/martin:1.11.0`, a published stable release, rather
than an unresolvable pre-1.0 tag. Its database URL is supplied through the container environment.

## Geographic data flow

The controlled target flow is:

`OpenStreetMap Lithuania extract → Vilnius bounding-box filter → PostGIS → Martin → MapLibre iOS`

`scripts/map-data.ps1` reproducibly clips only the Vilnius development box. Large PBFs and generated
outputs are ignored. The current proof of local vector serving uses the seeded boundary; importing a
curated set of OSM layers is the next data-pipeline increment. OSM attribution must remain visible.

## iOS connectivity

The SwiftUI client wraps MapLibre Native. `AppConfiguration` owns the API/style URL. The Windows
services bind to `0.0.0.0`; a future physical iPhone uses `http://WINDOWS_LAN_IP:8000` on the same
trusted Wi-Fi. The firewall should allow only the needed local TCP ports on private networks.

## Configuration and security

Compose reads database credentials and ports from `.env`, which is ignored. `.env.example` contains
development placeholders only. No credentials or API keys belong in Swift or committed files.

## Cloud boundaries

Cloud deployment is intentionally deferred. Clear candidate mappings exist without being decisions:

- local PostgreSQL/PostGIS → Amazon RDS PostgreSQL/PostGIS;
- FastAPI container → ECS/Fargate;
- generated map assets → S3/CloudFront.

Networking, secrets, observability, scaling, and cost must be designed before adopting these. The
monorepo and container boundaries should remain portable without prematurely introducing services.
