# Roadmap

No milestone has an arbitrary date.

1. **Milestone 1 — Vilnius PWA mapping foundation.** Acceptance requires Windows setup, Vilnius map
   rendering, desktop and mobile Safari interaction, iPhone Home Screen installation, healthy API,
   working PostGIS, and documented tile architecture. See `docs/ACCEPTANCE.md`.
2. **Milestone 1.1 — Fully self-hosted Vilnius basemap.** Replace
   `https://tile.openstreetmap.org/...` with locally processed and served Vilnius OSM data. Target
   flow: `OSM extract → filtered Vilnius data → local processing → PostGIS/vector tiles → Martin →
   MapLibre`. Acceptance requires the detailed Vilnius basemap to keep rendering when public OSM tile
   access is unavailable.
3. **Milestone 2 — Custom places and local business data.** Define provenance, ingestion, and a
   minimal place model.
4. **Milestone 3 — Search/discovery.** Geographic and textual discovery over trusted place data.
5. **Milestone 4 — Service-provider profiles.** Model providers and offered services.
6. **Milestone 5 — Availability/booking foundation.** Evaluate availability semantics and actions.
7. **Milestone 6 — Routing/navigation evaluation.** Assess needs and open data/tooling.
8. **Milestone 7 — AI natural-language geographic queries.** Add grounded query interpretation.
9. **Milestone 8 — Accounts/authentication.** Introduce identity only when workflows require it.
10. **Milestone 9 — Production AWS architecture.** Design production deployment and operations.
11. **Milestone 10 — Lithuania.** Expand only after Vilnius quality is demonstrated.
12. **Milestone 11 — Baltics.** Expand regionally with measured data quality.

Native clients remain optional future evaluations, not blockers or assumed near-term milestones.
