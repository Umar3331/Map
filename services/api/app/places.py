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
    def search_places(
        self,
        *,
        query: str,
        category: str | None,
        alias_category: str | None,
        alias_subcategory: str | None,
        west: float | None,
        south: float | None,
        east: float | None,
        north: float | None,
        latitude: float | None,
        longitude: float | None,
        limit: int,
    ) -> list[dict[str, Any]]: ...

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

    def search_places(
        self,
        *,
        query: str,
        category: str | None,
        alias_category: str | None,
        alias_subcategory: str | None,
        west: float | None,
        south: float | None,
        east: float | None,
        north: float | None,
        latitude: float | None,
        longitude: float | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        has_viewport = all(value is not None for value in (west, south, east, north))
        has_origin = latitude is not None and longitude is not None
        sql = """
            WITH ranked AS (
                SELECT
                    place.id,
                    place.name,
                    place.normalized_name,
                    place.category,
                    place.subcategory,
                    place.address_line,
                    ST_X(place.geom) AS longitude,
                    ST_Y(place.geom) AS latitude,
                    similarity(place.normalized_name, %(query)s) AS name_similarity,
                    CASE
                        WHEN place.normalized_name = %(query)s THEN 100
                        WHEN place.normalized_name LIKE %(query)s || '%%' THEN 90
                        WHEN similarity(place.normalized_name, %(query)s) >= 0.55 THEN 80
                        WHEN CAST(%(alias_subcategory)s AS text) IS NOT NULL
                          AND place.subcategory = CAST(%(alias_subcategory)s AS text) THEN 70
                        WHEN CAST(%(alias_category)s AS text) IS NOT NULL
                          AND place.category = CAST(%(alias_category)s AS text) THEN 65
                        WHEN place.normalized_name LIKE '%%' || %(query)s || '%%' THEN 60
                        ELSE 50
                    END AS relevance,
                    CASE WHEN CAST(%(has_viewport)s AS boolean) THEN
                        ST_Intersects(
                            place.geom,
                            ST_MakeEnvelope(
                                CAST(%(west)s AS double precision),
                                CAST(%(south)s AS double precision),
                                CAST(%(east)s AS double precision),
                                CAST(%(north)s AS double precision),
                                4326
                            )
                        )
                    ELSE false END AS in_viewport,
                    CASE WHEN CAST(%(has_origin)s AS boolean) THEN
                        ST_DistanceSphere(
                            place.geom,
                            ST_SetSRID(
                                ST_MakePoint(
                                    CAST(%(longitude)s AS double precision),
                                    CAST(%(latitude)s AS double precision)
                                ),
                                4326
                            )
                        )
                    END AS distance_m
                FROM app.places AS place
                WHERE place.status = 'active'
                  AND (CAST(%(category)s AS text) IS NULL
                    OR place.category = CAST(%(category)s AS text))
                  AND (
                    place.normalized_name = %(query)s
                    OR place.normalized_name LIKE %(query)s || '%%'
                    OR place.normalized_name LIKE '%%' || %(query)s || '%%'
                    OR place.normalized_name %% %(query)s
                    OR (CAST(%(alias_category)s AS text) IS NOT NULL
                        AND place.category = CAST(%(alias_category)s AS text))
                    OR (CAST(%(alias_subcategory)s AS text) IS NOT NULL
                        AND place.subcategory = CAST(%(alias_subcategory)s AS text))
                  )
            )
            SELECT
                id, name, category, subcategory, address_line,
                longitude, latitude, distance_m
            FROM ranked
            ORDER BY
                relevance DESC,
                name_similarity DESC,
                in_viewport DESC,
                distance_m ASC NULLS LAST,
                normalized_name,
                id
            LIMIT %(limit)s
        """
        parameters = {
            "query": query,
            "category": category,
            "alias_category": alias_category,
            "alias_subcategory": alias_subcategory,
            "has_viewport": has_viewport,
            "west": west,
            "south": south,
            "east": east,
            "north": north,
            "has_origin": has_origin,
            "latitude": latitude,
            "longitude": longitude,
            "limit": limit,
        }
        with self.connection.cursor(row_factory=dict_row) as cursor:
            rows = cursor.execute(sql, parameters).fetchall()
        return [
            {
                **dict(row),
                "distance_m": (
                    round(float(row["distance_m"])) if row["distance_m"] is not None else None
                ),
            }
            for row in rows
        ]

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


def _feature_collection(features: list[dict[str, Any]], total: int) -> dict[str, Any]:
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
