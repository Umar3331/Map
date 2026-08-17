import os
from collections.abc import Iterator
from typing import Any, Protocol

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

router = APIRouter(prefix="/api/v1", tags=["providers"])

_pool: ConnectionPool | None = None


def open_providers_pool() -> None:
    global _pool
    database_url = os.getenv("DATABASE_URL")
    if database_url and _pool is None:
        _pool = ConnectionPool(database_url, min_size=1, max_size=3, timeout=5)
        _pool.wait()


def close_providers_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


class ProvidersRepository(Protocol):
    def get_provider(self, provider_id: int) -> dict[str, Any] | None: ...

    def list_place_providers(self, place_id: int) -> list[dict[str, Any]]: ...

    def list_provider_services(self, provider_id: int) -> list[dict[str, Any]] | None: ...

    def search_provider_services(
        self,
        *,
        query: str,
        service_codes: tuple[str, ...],
        category: str | None,
        west: float | None,
        south: float | None,
        east: float | None,
        north: float | None,
        latitude: float | None,
        longitude: float | None,
        limit: int,
    ) -> list[dict[str, Any]]: ...


class PostgresProvidersRepository:
    def __init__(self, connection: psycopg.Connection) -> None:
        self.connection = connection

    def get_provider(self, provider_id: int) -> dict[str, Any] | None:
        provider_query = """
            SELECT
                provider.id,
                provider.display_name,
                provider.legal_name,
                provider.description,
                provider.phone,
                provider.email,
                provider.website
            FROM app.providers AS provider
            WHERE provider.id = %(provider_id)s AND provider.status = 'active'
        """
        locations_query = """
            SELECT
                place.id AS place_id,
                place.name AS place_name,
                place.address_line,
                place.postal_code,
                place.city,
                ST_X(place.geom) AS longitude,
                ST_Y(place.geom) AS latitude,
                location.is_primary
            FROM app.provider_locations AS location
            JOIN app.places AS place ON place.id = location.place_id
            WHERE location.provider_id = %(provider_id)s
              AND location.status = 'active'
              AND place.status = 'active'
            ORDER BY location.is_primary DESC, place.name, place.id
        """
        sources_query = """
            SELECT
                place_source.code AS source,
                place_source.display_name AS source_name,
                provider_source.external_id,
                place_source.attribution,
                place_source.license_name,
                place_source.license_url,
                place_source.source_url,
                provider_source.imported_at
            FROM app.provider_sources AS provider_source
            JOIN app.place_sources AS place_source ON place_source.id = provider_source.source_id
            WHERE provider_source.provider_id = %(provider_id)s
            ORDER BY place_source.code, provider_source.external_id
        """
        parameters = {"provider_id": provider_id}
        with self.connection.cursor(row_factory=dict_row) as cursor:
            provider = cursor.execute(provider_query, parameters).fetchone()
            if provider is None:
                return None
            locations = cursor.execute(locations_query, parameters).fetchall()
            sources = cursor.execute(sources_query, parameters).fetchall()
        return {
            **dict(provider),
            "locations": [dict(location) for location in locations],
            "sources": [dict(source) for source in sources],
        }

    def list_place_providers(self, place_id: int) -> list[dict[str, Any]]:
        query = """
            SELECT
                provider.id,
                provider.display_name,
                provider.description,
                location.is_primary,
                count(offering.id)::integer AS service_count
            FROM app.provider_locations AS location
            JOIN app.providers AS provider ON provider.id = location.provider_id
            JOIN app.places AS place ON place.id = location.place_id
            LEFT JOIN app.provider_services AS offering
              ON offering.provider_id = provider.id AND offering.status = 'active'
            WHERE location.place_id = %(place_id)s
              AND location.status = 'active'
              AND provider.status = 'active'
              AND place.status = 'active'
            GROUP BY provider.id, location.is_primary
            ORDER BY location.is_primary DESC, provider.normalized_name, provider.id
        """
        with self.connection.cursor(row_factory=dict_row) as cursor:
            rows = cursor.execute(query, {"place_id": place_id}).fetchall()
        return [dict(row) for row in rows]

    def list_provider_services(self, provider_id: int) -> list[dict[str, Any]] | None:
        exists_query = """
            SELECT 1 FROM app.providers
            WHERE id = %(provider_id)s AND status = 'active'
        """
        services_query = """
            SELECT
                service_type.id,
                offering.id AS provider_service_id,
                service_type.code,
                service_type.name,
                service_type.category,
                offering.display_name,
                offering.description,
                offering.price_amount,
                offering.price_currency,
                offering.duration_minutes
            FROM app.provider_services AS offering
            JOIN app.service_types AS service_type ON service_type.id = offering.service_type_id
            WHERE offering.provider_id = %(provider_id)s
              AND offering.status = 'active'
              AND service_type.status = 'active'
            ORDER BY service_type.category, service_type.name, service_type.id
        """
        parameters = {"provider_id": provider_id}
        with self.connection.cursor(row_factory=dict_row) as cursor:
            if cursor.execute(exists_query, parameters).fetchone() is None:
                return None
            rows = cursor.execute(services_query, parameters).fetchall()
        return [dict(row) for row in rows]

    def search_provider_services(
        self,
        *,
        query: str,
        service_codes: tuple[str, ...],
        category: str | None,
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
            WITH candidates AS (
                SELECT
                    place.id AS place_id,
                    provider.id AS provider_id,
                    provider.display_name,
                    provider.normalized_name,
                    place.name AS place_name,
                    place.category,
                    place.subcategory,
                    place.address_line,
                    ST_X(place.geom) AS longitude,
                    ST_Y(place.geom) AS latitude,
                    service_type.code AS service_code,
                    service_type.name AS service_name,
                    array_position(
                        CAST(%(service_codes)s AS text[]), service_type.code
                    ) AS service_rank,
                    CASE
                        WHEN provider.normalized_name = %(query)s THEN 2
                        WHEN provider.normalized_name LIKE %(query)s || '%%' THEN 1
                        ELSE 0
                    END AS provider_relevance,
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
                FROM app.provider_services AS offering
                JOIN app.service_types AS service_type
                  ON service_type.id = offering.service_type_id
                JOIN app.providers AS provider ON provider.id = offering.provider_id
                JOIN app.provider_locations AS location ON location.provider_id = provider.id
                JOIN app.places AS place ON place.id = location.place_id
                WHERE offering.status = 'active'
                  AND service_type.status = 'active'
                  AND provider.status = 'active'
                  AND location.status = 'active'
                  AND place.status = 'active'
                  AND service_type.code = ANY(CAST(%(service_codes)s AS text[]))
                  AND (CAST(%(category)s AS text) IS NULL
                    OR place.category = CAST(%(category)s AS text))
            ),
            deduplicated AS (
                SELECT DISTINCT ON (provider_id, place_id)
                    *
                FROM candidates
                ORDER BY provider_id, place_id, service_rank, service_code
            )
            SELECT
                place_id AS id,
                provider_id,
                place_id,
                display_name AS name,
                place_name,
                category,
                subcategory,
                address_line,
                longitude,
                latitude,
                distance_m,
                service_code,
                service_name
            FROM deduplicated
            ORDER BY
                service_rank,
                provider_relevance DESC,
                in_viewport DESC,
                distance_m ASC NULLS LAST,
                normalized_name,
                provider_id,
                place_id
            LIMIT %(limit)s
        """
        parameters = {
            "query": query,
            "service_codes": list(service_codes),
            "category": category,
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
                "id": row["id"],
                "provider_id": row["provider_id"],
                "place_id": row["place_id"],
                "name": row["name"],
                "place_name": row["place_name"],
                "category": row["category"],
                "subcategory": row["subcategory"],
                "address_line": row["address_line"],
                "longitude": row["longitude"],
                "latitude": row["latitude"],
                "distance_m": (
                    round(float(row["distance_m"])) if row["distance_m"] is not None else None
                ),
                "result_type": "provider_service",
                "matched_service": {
                    "code": row["service_code"],
                    "name": row["service_name"],
                },
            }
            for row in rows
        ]


def get_providers_repository() -> Iterator[ProvidersRepository]:
    if _pool is None:
        open_providers_pool()
    if _pool is None:
        raise RuntimeError("DATABASE_URL is required for providers")
    with _pool.connection() as connection:
        yield PostgresProvidersRepository(connection)


@router.get("/providers/{provider_id}")
def provider_details(
    provider_id: int,
    repository: ProvidersRepository = Depends(get_providers_repository),
) -> dict[str, Any]:
    provider = repository.get_provider(provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.get("/providers/{provider_id}/services")
def provider_services(
    provider_id: int,
    repository: ProvidersRepository = Depends(get_providers_repository),
) -> dict[str, Any]:
    services = repository.list_provider_services(provider_id)
    if services is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {
        "provider_id": provider_id,
        "services": services,
        "meta": {"returned": len(services)},
    }


@router.get("/places/{place_id}/providers")
def place_providers(
    place_id: int,
    repository: ProvidersRepository = Depends(get_providers_repository),
) -> dict[str, Any]:
    providers = repository.list_place_providers(place_id)
    return {
        "place_id": place_id,
        "providers": providers,
        "meta": {"returned": len(providers)},
    }
