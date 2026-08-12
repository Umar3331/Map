# Local development

From the repository root in PowerShell:

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
.\scripts\health.ps1
docker compose ps
docker compose logs -f api
.\scripts\stop.ps1
```

Run backend checks without a host Python installation:

```powershell
docker build -f services/api/Dockerfile -t map-api-test services/api
docker run --rm -v "${PWD}/services/api/tests:/app/tests:ro" map-api-test `
  sh -c "pip install -r /app/requirements-dev.txt && pytest && ruff check app tests"
```

Key URLs are `/health`, `/api/v1/config`, `/api/v1/map/style.json`, and `/docs` on port 8000.
Martin's catalog is on port 3000. The style endpoint intentionally mirrors the request hostname.

To prepare a clipped OSM extract, run `.\scripts\map-data.ps1 -Download`. This downloads a large,
changeable external file and writes ignored data under `data/`.
