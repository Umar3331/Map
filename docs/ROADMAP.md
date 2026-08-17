# Roadmap

No milestone has an arbitrary date.

1. **Milestone 1 — Vilnius PWA mapping foundation (complete).** Windows setup, Vilnius rendering,
   physical-iPhone Safari interaction and trusted HTTPS, PWA installation, API, PostGIS, and the tile
   architecture passed acceptance on 2026-08-13. See `docs/ACCEPTANCE.md`.
2. **Milestone 1.1 — Fully self-hosted Vilnius basemap (complete).** The local pipeline and style are
   implemented as `Geofabrik PBF → Osmium → osm2pgsql flex → PostGIS → Martin → MapLibre`, with no
   runtime public basemap or font/sprite CDN. The production worker, strict static-asset routing,
   browser smoke test, and zoom-aware transportation tiles are implemented. Physical-iPhone offline
   acceptance passed on 2026-08-16. See `docs/ACCEPTANCE.md`.
3. **Milestone 2 — Custom places and local business data (complete).** Application-owned places,
   OSM provenance, a curated taxonomy, idempotent Windows import, bounded spatial API with explicit
   truncation metadata, non-misleading broad-viewport guidance, native category markers, viewport
   loading, and responsive place details are implemented. Physical-iPhone place interaction and
   layout acceptance passed on 2026-08-17. See `docs/ACCEPTANCE.md`.
4. **Milestone 3 — Search/discovery (complete).** PostgreSQL-backed exact, prefix, partial, typo, and
   category-alias discovery over trusted `app.places` is implemented with distinct name/category
   intent, taxonomy-complete category candidates, bounded search-result map layers, accessible
   desktop/mobile results, map focus, and existing detail-panel reuse. Automated, Windows
   production-browser, and physical-iPhone re-acceptance passed on 2026-08-17.
5. **Milestone 4 — Service-provider profiles (complete).** Separate provider identity, provider
   locations, normalized services, provenance, read-only APIs, and responsive profile UI are
   implemented. Controlled service-intent discovery connects normalized offerings to the existing
   search/map/profile flow. Automated, Windows production-browser, and physical-iPhone
   re-acceptance passed on 2026-08-17.
6. **Milestone 5 — Availability foundation (in progress).** Location-specific offerings, recurring
   rules, date exceptions, Europe/Vilnius-aware dynamic slots, deterministic demo schedules,
   read-only APIs, and responsive availability UI are implemented for draft acceptance. No booking
   write, real provider schedule, account, staff, or resource calendar is included.
7. **Milestone 6 — Routing/navigation evaluation.** Assess needs and open data/tooling.
8. **Milestone 7 — AI natural-language geographic queries.** Add grounded query interpretation.
9. **Milestone 8 — Accounts/authentication.** Introduce identity only when workflows require it.
10. **Milestone 9 — Production AWS architecture.** Design production deployment and operations.
11. **Milestone 10 — Lithuania.** Expand only after Vilnius quality is demonstrated.
12. **Milestone 11 — Baltics.** Expand regionally with measured data quality.

Native clients remain optional future evaluations, not blockers or assumed near-term milestones.
