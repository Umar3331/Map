# Agent guidance

Map is an eventual local-services geographic platform. The active milestone is **Map v0.1 — Vilnius
PWA**. Before architectural changes, read `README.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and `docs/ROADMAP.md`.

## Working rules

- Primary machine: Windows 11 ASUS ROG. Use PowerShell and Docker Desktop; never require WSL.
- Active client: `apps/web` using React, TypeScript, Vite, PWA standards, and MapLibre GL JS.
- Do not perform native Swift/iOS work unless explicitly requested. The old prototype is archived.
- Backend: FastAPI. Spatial store: PostgreSQL/PostGIS. Map data: OpenStreetMap. Tiles: Martin.
- Keep Milestone 1 Vilnius-only. Do not add AWS, auth, payments, booking, AI, routing, Android,
  Kubernetes, Terraform, or premature microservices.
- Standard full-stack commands are `.\scripts\setup.ps1`, `.\scripts\start.ps1`,
  `.\scripts\health.ps1`, and `.\scripts\stop.ps1`.
- Run frontend lint, type checks, tests, and production build; run backend tests; validate Compose and
  changed live endpoints. Never claim physical-iPhone verification unless actually performed.
- Update documentation with behavior/setup changes and add or supersede a lightweight ADR for
  architectural decisions. Never rewrite accepted history silently.
- Never commit `.env`, credentials, certificates/private keys, PBFs, tiles, databases, caches,
  `node_modules`, or build output. Use non-secret examples.
- Keep APIs and modules explicit for future codebase-memory tooling; it is development support only.
