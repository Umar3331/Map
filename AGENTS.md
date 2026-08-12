# Agent guidance

Map is an eventual AI-native local-services geographic platform. The current milestone is only the
Vilnius local mapping foundation. Before architectural changes, read `README.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/ROADMAP.md`.

## Working rules

- Treat Windows 11, PowerShell, and Docker Desktop as the primary environment; do not require WSL.
- iOS source lives in `apps/ios`; native compilation, signing, simulation, and device installation
  require macOS/Xcode. Never claim a Windows iOS build succeeded.
- API code/tests live in `services/api`; local infrastructure lives in `infrastructure/local`;
  operational scripts live in `scripts`; large local artifacts belong under ignored `data` paths.
- Standard commands are `.\scripts\setup.ps1`, `.\scripts\start.ps1`,
  `.\scripts\health.ps1`, and `.\scripts\stop.ps1`.
- Keep Milestone 1 Vilnius-only. Do not add AWS, authentication, payment, booking, AI, routing,
  Android, web UI, Kubernetes, Terraform, or premature microservices.
- Test changed endpoint contracts, validate Compose after infrastructure changes, and verify docs
  against the commands that actually exist.
- Update documentation when behavior, setup, or architecture changes. Add or supersede a lightweight
  ADR for material architectural decisions.
- Never commit `.env`, credentials, tokens, private keys, large OSM/PBF files, generated tiles,
  database files, or caches. Use `.env.example` with non-secret placeholders.
- Keep modules and APIs explicit and logically separated for future codebase-memory tooling; such
  tooling is development support, never application runtime, and must not be installed unrequested.
