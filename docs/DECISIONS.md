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
