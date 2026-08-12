# Local development

The normal full stack runs in Docker:

```powershell
.\scripts\setup.ps1
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
```

Use `.\scripts\map-data.ps1 -Download` to create an ignored Vilnius PBF from the current Lithuania
extract. Do not commit geographic downloads or output.
