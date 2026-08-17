from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response

from app import mobileconfig, places, providers, search


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    places.open_places_pool()
    providers.open_providers_pool()
    try:
        yield
    finally:
        providers.close_providers_pool()
        places.close_places_pool()


app = FastAPI(title="Map API", version="0.1.0", lifespan=lifespan)
app.include_router(places.router)
app.include_router(search.router)
app.include_router(providers.router)

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
def map_style() -> dict:
    """Return a same-origin local style with no public basemap dependency."""
    center = VILNIUS["center"]
    region_name = str(VILNIUS["region"]).title()
    source_names = (
        "landuse",
        "water",
        "buildings",
        "waterways",
        "boundaries",
        "railways",
        "transportation",
        "places",
    )
    return {
        "version": 8,
        "name": f"Map Local {region_name}",
        "center": [center["longitude"], center["latitude"]],
        "zoom": 10,
        "sources": {
            name: {
                "type": "vector",
                "tiles": [f"/tiles/{name}/{{z}}/{{x}}/{{y}}"],
                "minzoom": 0,
                "maxzoom": 19,
                "attribution": "© OpenStreetMap contributors",
            }
            for name in source_names
        },
        "layers": [
            {"id": "background", "type": "background", "paint": {"background-color": "#eef3f1"}},
            {
                "id": "landuse",
                "type": "fill",
                "source": "landuse",
                "source-layer": "landuse",
                "paint": {"fill-color": "#cde5bf", "fill-opacity": 0.7},
            },
            {
                "id": "roads",
                "type": "line",
                "source": "transportation",
                "source-layer": "transportation",
                "paint": {"line-color": "#ffffff", "line-width": 2},
            },
        ],
    }
