import os
from collections.abc import Iterator
from typing import Any, Protocol

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

router = APIRouter(prefix="/api/v1/places", tags=["places"])

PLACE_CATEGORIES = (
    "food_drink",
    "shopping",
    "health",
    "automotive",
    "beauty",
    "fitness",
    "finance",
    "accommodation",
    "services",
    "other",
)

_pool: ConnectionPool | None = None


def open_places_pool() -> None:
    global _pool
    database_url = os.getenv("DATABASE_URL")
    if database_url and _pool is None:
        _pool = ConnectionPool(database_url, min_size=1, max_size=5, timeout=5)
        _pool.wait()


def close_places_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


class PlacesRepository(Protocol):
    def count_places(
        self,
        *,
        west: float,
        south: float,
        east: float,
        north: float,
        category: str | None,
    ) -> int: ...

    def list_places(
        self,
        *,
        west: float,
        south: float,
        east: float,
        north: float,
        category: str | None,
        limit: int,
    ) -> list[dict[str, Any]]: ...

    def get_place(self, place_id: int) -> dict[str, Any] | None: ...


class PostgresPlacesRepository:
    def __init__(self, connection: psycopg.Connection) -> None:
        self.connection = connection

    def list_places(
        self,
        *,
        west: float,
        south: float,
        east: float,
        north: float,
        category: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        category_clause = "AND place.category = %(category)s" if category else ""
        query = f"""
            SELECT
                place.id,
                place.name,
                place.category,
                place.subcategory,
                ST_X(place.geom) AS longitude,
                ST_Y(place.geom) AS latitude
            FROM app.places AS place
            WHERE place.status = 'active'
              AND place.geom && ST_MakeEnvelope(
                  %(west)s, %(south)s, %(east)s, %(north)s, 4326
              )
              AND ST_Intersects(
                  place.geom,
                  ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
              )
              {category_clause}
            ORDER BY place.category, place.name, place.id
            LIMIT %(limit)s
        """
        parameters = {
            "west": west,
            "south": south,
            "east": east,
            "north": north,
            "category": category,
            "limit": limit,
        }
        with self.connection.cursor(row_factory=dict_row) as cursor:
            rows = cursor.execute(query, parameters).fetchall()
        return [
            {
                "type": "Feature",
                "id": row["id"],
                "geometry": {
                    "type": "Point",
                    "coordinates": [row["longitude"], row["latitude"]],
                },
                "properties": {
                    "id": row["id"],
                    "name": row["name"],
                    "category": row["category"],
                    "subcategory": row["subcategory"],
                },
            }
            for row in rows
        ]

    def count_places(
        self,
        *,
        west: float,
        south: float,
        east: float,
        north: float,
        category: str | None,
    ) -> int:
        category_clause = "AND place.category = %(category)s" if category else ""
        query = f"""
            SELECT count(*) AS total
            FROM app.places AS place
            WHERE place.status = 'active'
              AND place.geom && ST_MakeEnvelope(
                  %(west)s, %(south)s, %(east)s, %(north)s, 4326
              )
              AND ST_Intersects(
                  place.geom,
                  ST_MakeEnvelope(%(west)s, %(south)s, %(east)s, %(north)s, 4326)
              )
              {category_clause}
        """
        parameters = {
            "west": west,
            "south": south,
            "east": east,
            "north": north,
            "category": category,
        }
        with self.connection.cursor() as cursor:
            row = cursor.execute(query, parameters).fetchone()
        return int(row[0]) if row else 0

    def get_place(self, place_id: int) -> dict[str, Any] | None:
        query = """
            SELECT
                place.id,
                place.name,
                place.category,
                place.subcategory,
                place.description,
                place.address_line,
                place.postal_code,
                place.city,
                place.country_code,
                place.phone,
                place.website,
                place.email,
                place.opening_hours_raw,
                place.raw_classification,
                ST_X(place.geom) AS longitude,
                ST_Y(place.geom) AS latitude,
                source.code AS source,
                source.display_name AS source_name,
                source.attribution,
                source.license_name,
                source.license_url,
                place.external_id,
                place.source_updated_at
            FROM app.places AS place
            JOIN app.place_sources AS source ON source.id = place.source_id
            WHERE place.id = %(place_id)s AND place.status = 'active'
        """
        with self.connection.cursor(row_factory=dict_row) as cursor:
            row = cursor.execute(query, {"place_id": place_id}).fetchone()
        return dict(row) if row else None


def get_places_repository() -> Iterator[PlacesRepository]:
    if _pool is None:
        open_places_pool()
    if _pool is None:
        raise RuntimeError("DATABASE_URL is required for places")
    with _pool.connection() as connection:
        yield PostgresPlacesRepository(connection)


def _feature_collection(
    features: list[dict[str, Any]], total: int
) -> dict[str, Any]:
    returned = len(features)
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "returned": returned,
            "total": total,
            "truncated": total > returned,
        },
    }


@router.get("")
def list_places(
    west: float = Query(ge=-180, le=180),
    south: float = Query(ge=-90, le=90),
    east: float = Query(ge=-180, le=180),
    north: float = Query(ge=-90, le=90),
    category: str | None = Query(default=None),
    limit: int = Query(default=250, ge=1, le=500),
    repository: PlacesRepository = Depends(get_places_repository),
) -> dict[str, Any]:
    if west >= east or south >= north:
        raise HTTPException(status_code=422, detail="Invalid bounding box")
    if category is not None and category not in PLACE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown place category")
    query = {
        "west": west,
        "south": south,
        "east": east,
        "north": north,
        "category": category,
    }
    total = repository.count_places(**query)
    features = repository.list_places(
        **query,
        limit=limit,
    )
    return _feature_collection(features, total)


@router.get("/{place_id}")
def place_details(
    place_id: int,
    repository: PlacesRepository = Depends(get_places_repository),
) -> dict[str, Any]:
    place = repository.get_place(place_id)
    if place is None:
        raise HTTPException(status_code=404, detail="Place not found")
    return place
