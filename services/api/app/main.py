import os
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request, Response

from app import mobileconfig

app = FastAPI(title="Map API", version="0.1.0")

VILNIUS = {
    "region": "vilnius",
    "country": "LT",
    "center": {"latitude": 54.6872, "longitude": 25.2797},
    "bounding_box": {
        "south": 54.55,
        "west": 25.10,
        "north": 54.85,
        "east": 25.50,
    },
}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "map-api"}


@app.get("/api/v1/config")
def config() -> dict:
    return VILNIUS


@app.get("/local-ca.mobileconfig")
def local_ca_mobileconfig() -> Response:
    """Return an Apple profile containing Caddy's current public CA chain."""
    try:
        root_der, intermediate_der = mobileconfig.load_ca_certificates_der()
    except (OSError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail="Local CA certificates are not ready",
        ) from error

    return Response(
        content=mobileconfig.build_mobileconfig(root_der, intermediate_der),
        media_type="application/x-apple-aspen-config",
        headers={
            "Content-Disposition": 'attachment; filename="map-local-ca.mobileconfig"',
            "Cache-Control": "no-store",
        },
    )


@app.get("/api/v1/map/style.json")
def map_style(request: Request) -> dict:
    """Return a minimal local style whose tile host follows the API request host."""
    hostname = urlsplit(str(request.base_url)).hostname or "localhost"
    tile_port = os.getenv("TILE_PUBLIC_PORT", "3000")
    tiles = f"http://{hostname}:{tile_port}/vilnius_boundary/{{z}}/{{x}}/{{y}}"
    center = VILNIUS["center"]
    region_name = str(VILNIUS["region"]).title()
    return {
        "version": 8,
        "name": f"Map Local {region_name}",
        "center": [center["longitude"], center["latitude"]],
        "zoom": 10,
        "sources": {
            "vilnius": {
                "type": "vector",
                "tiles": [tiles],
                "minzoom": 0,
                "maxzoom": 14,
                "attribution": "© OpenStreetMap contributors",
            }
        },
        "layers": [
            {"id": "background", "type": "background", "paint": {"background-color": "#eef3f1"}},
            {
                "id": "vilnius-area",
                "type": "fill",
                "source": "vilnius",
                "source-layer": "vilnius_boundary",
                "paint": {"fill-color": "#4f8f7b", "fill-opacity": 0.18},
            },
            {
                "id": "vilnius-outline",
                "type": "line",
                "source": "vilnius",
                "source-layer": "vilnius_boundary",
                "paint": {"line-color": "#2d6658", "line-width": 2},
            },
        ],
    }
