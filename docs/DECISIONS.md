# Architecture decisions

Each accepted decision applies until superseded by a later ADR.

## ADR-001 — Vilnius-only initial geography
**Status:** Accepted. **Context:** A bounded prototype reduces data and operational complexity.
**Decision:** Milestone 1 covers only Vilnius. **Consequences:** Global assumptions and planet-scale
imports are prohibited; expansion requires later milestones.

## ADR-002 — iOS is initial consumer platform
**Status:** Accepted. **Context:** The first intended consumer experience is on iPhone. **Decision:**
Prioritize native iOS. **Consequences:** Android and web clients are out of scope.

## ADR-003 — Windows is primary development environment
**Status:** Accepted. **Context:** The primary machine runs Windows 11. **Decision:** PowerShell and
Docker Desktop are the default workflow. **Consequences:** WSL may be optional, never mandatory.

## ADR-004 — SwiftUI native iOS client
**Status:** Accepted. **Context:** A modern Apple-native interface is desired. **Decision:** Use
SwiftUI. **Consequences:** Native platform expertise and a Mac are required for final builds.

## ADR-005 — MapLibre
**Status:** Accepted. **Context:** The client needs an open map renderer with vector support.
**Decision:** Use MapLibre Native. **Consequences:** We maintain style and data-source configuration.

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
**Status:** Accepted. **Context:** Native Apple tooling does not run on Windows. **Decision:** Maintain
source on Windows and build/sign on macOS. **Consequences:** Windows validation cannot claim a build.

## ADR-014 — Avoid Google Maps dependency
**Status:** Accepted. **Context:** Local data control is a core architectural goal. **Decision:** Do not
depend on Google Maps. **Consequences:** We own MapLibre styles, tiles, and OSM compliance.

## ADR-015 — Martin serves local vector tiles
**Status:** Accepted. **Context:** Milestone 1 needs a small PostGIS-to-vector-tile path. **Decision:**
Use Martin with PostGIS table discovery. **Consequences:** Operations stay simple; richer cartography
will require curated OSM import tables and styles later.
