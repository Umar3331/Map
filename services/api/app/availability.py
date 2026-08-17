import os
from collections.abc import Iterator
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Protocol
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

router = APIRouter(prefix="/api/v1", tags=["availability"])

MAX_AVAILABILITY_DAYS = 31
DEFAULT_TIMEZONE = "Europe/Vilnius"

_pool: ConnectionPool | None = None


def open_availability_pool() -> None:
    global _pool
    database_url = os.getenv("DATABASE_URL")
    if database_url and _pool is None:
        _pool = ConnectionPool(database_url, min_size=1, max_size=3, timeout=5)
        _pool.wait()


def close_availability_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


class AvailabilityRepository(Protocol):
    def list_provider_offerings(self, provider_id: int) -> list[dict[str, Any]] | None: ...

    def get_offering_schedule(
        self, offering_id: int, from_date: date, to_date: date
    ) -> dict[str, Any] | None: ...


class PostgresAvailabilityRepository:
    def __init__(self, connection: psycopg.Connection) -> None:
        self.connection = connection

    def list_provider_offerings(self, provider_id: int) -> list[dict[str, Any]] | None:
        exists_query = """
            SELECT 1 FROM app.providers
            WHERE id = %(provider_id)s AND status = 'active'
        """
        query = """
            SELECT
                offering.id,
                offering.provider_service_id,
                offering.provider_location_id,
                offering.duration_minutes,
                offering.slot_interval_minutes,
                offering.capacity,
                offering.timezone,
                offering.is_demo,
                service_type.code AS service_code,
                COALESCE(provider_service.display_name, service_type.name) AS service_name,
                service_type.category AS service_category,
                place.id AS place_id,
                place.name AS place_name,
                place.address_line,
                place.city
            FROM app.bookable_offerings AS offering
            JOIN app.provider_services AS provider_service
              ON provider_service.id = offering.provider_service_id
            JOIN app.service_types AS service_type
              ON service_type.id = provider_service.service_type_id
            JOIN app.provider_locations AS provider_location
              ON provider_location.id = offering.provider_location_id
            JOIN app.places AS place ON place.id = provider_location.place_id
            WHERE offering.provider_id = %(provider_id)s
              AND offering.status = 'active'
              AND provider_service.status = 'active'
              AND service_type.status = 'active'
              AND provider_location.status = 'active'
              AND place.status = 'active'
            ORDER BY service_type.category, service_type.name, place.name, offering.id
        """
        parameters = {"provider_id": provider_id}
        with self.connection.cursor(row_factory=dict_row) as cursor:
            if cursor.execute(exists_query, parameters).fetchone() is None:
                return None
            rows = cursor.execute(query, parameters).fetchall()
        return [dict(row) for row in rows]

    def get_offering_schedule(
        self, offering_id: int, from_date: date, to_date: date
    ) -> dict[str, Any] | None:
        offering_query = """
            SELECT
                offering.id,
                offering.provider_id,
                offering.provider_service_id,
                offering.provider_location_id,
                offering.duration_minutes,
                offering.slot_interval_minutes,
                offering.capacity,
                offering.timezone,
                offering.is_demo,
                offering.data_source,
                provider.display_name AS provider_name,
                service_type.code AS service_code,
                COALESCE(provider_service.display_name, service_type.name) AS service_name,
                place.id AS place_id,
                place.name AS place_name,
                place.address_line,
                place.city
            FROM app.bookable_offerings AS offering
            JOIN app.providers AS provider ON provider.id = offering.provider_id
            JOIN app.provider_services AS provider_service
              ON provider_service.id = offering.provider_service_id
            JOIN app.service_types AS service_type
              ON service_type.id = provider_service.service_type_id
            JOIN app.provider_locations AS provider_location
              ON provider_location.id = offering.provider_location_id
            JOIN app.places AS place ON place.id = provider_location.place_id
            WHERE offering.id = %(offering_id)s
              AND offering.status = 'active'
              AND provider.status = 'active'
              AND provider_service.status = 'active'
              AND service_type.status = 'active'
              AND provider_location.status = 'active'
              AND place.status = 'active'
        """
        rules_query = """
            SELECT day_of_week, start_local_time, end_local_time, valid_from, valid_until
            FROM app.availability_rules
            WHERE bookable_offering_id = %(offering_id)s
              AND status = 'active'
              AND (valid_from IS NULL OR valid_from <= %(to_date)s)
              AND (valid_until IS NULL OR valid_until >= %(from_date)s)
            ORDER BY day_of_week, start_local_time, end_local_time, id
        """
        exceptions_query = """
            SELECT
                exception.id,
                exception.local_date,
                exception.kind,
                exception.note,
                override_window.start_local_time,
                override_window.end_local_time
            FROM app.availability_exceptions AS exception
            LEFT JOIN app.availability_exception_windows AS override_window
              ON override_window.availability_exception_id = exception.id
            WHERE exception.bookable_offering_id = %(offering_id)s
              AND exception.status = 'active'
              AND exception.local_date BETWEEN %(from_date)s AND %(to_date)s
            ORDER BY exception.local_date,
                override_window.start_local_time,
                override_window.end_local_time
        """
        parameters = {
            "offering_id": offering_id,
            "from_date": from_date,
            "to_date": to_date,
        }
        with self.connection.cursor(row_factory=dict_row) as cursor:
            offering = cursor.execute(offering_query, parameters).fetchone()
            if offering is None:
                return None
            rules = cursor.execute(rules_query, parameters).fetchall()
            exception_rows = cursor.execute(exceptions_query, parameters).fetchall()

        exceptions: dict[date, dict[str, Any]] = {}
        for row in exception_rows:
            item = exceptions.setdefault(
                row["local_date"],
                {"kind": row["kind"], "note": row["note"], "windows": []},
            )
            if row["start_local_time"] is not None:
                item["windows"].append(
                    (row["start_local_time"], row["end_local_time"])
                )
        return {
            "offering": dict(offering),
            "rules": [dict(rule) for rule in rules],
            "exceptions": exceptions,
        }


def get_availability_repository() -> Iterator[AvailabilityRepository]:
    if _pool is None:
        open_availability_pool()
    if _pool is None:
        raise RuntimeError("DATABASE_URL is required for availability")
    with _pool.connection() as connection:
        yield PostgresAvailabilityRepository(connection)


def _local_instant(local_value: datetime, timezone: ZoneInfo) -> datetime | None:
    """Resolve one local wall time, skipping gaps and choosing the first fold deterministically."""
    candidates: list[datetime] = []
    for fold in (0, 1):
        aware = local_value.replace(tzinfo=timezone, fold=fold)
        utc_value = aware.astimezone(UTC)
        if utc_value.astimezone(timezone).replace(tzinfo=None) == local_value:
            if all(existing.astimezone(UTC) != utc_value for existing in candidates):
                candidates.append(aware)
    if not candidates:
        return None
    return min(candidates, key=lambda candidate: candidate.astimezone(UTC))


def _generate_window_slots(
    *,
    local_date: date,
    start_time: time,
    end_time: time,
    duration_minutes: int,
    interval_minutes: int,
    capacity: int,
    timezone: ZoneInfo,
) -> list[dict[str, Any]]:
    window_end = datetime.combine(local_date, end_time)
    candidate = datetime.combine(local_date, start_time)
    slots: list[dict[str, Any]] = []
    seen_starts: set[datetime] = set()
    while candidate + timedelta(minutes=duration_minutes) <= window_end:
        starts_at = _local_instant(candidate, timezone)
        if starts_at is not None:
            starts_at_utc = starts_at.astimezone(UTC)
            ends_at_utc = starts_at_utc + timedelta(minutes=duration_minutes)
            ends_at = ends_at_utc.astimezone(timezone)
            if (
                ends_at.date() == local_date
                and ends_at.replace(tzinfo=None) <= window_end
                and starts_at_utc not in seen_starts
            ):
                seen_starts.add(starts_at_utc)
                slots.append(
                    {
                        "starts_at": starts_at.isoformat(),
                        "ends_at": ends_at.isoformat(),
                        "starts_at_utc": starts_at_utc.isoformat().replace("+00:00", "Z"),
                        "ends_at_utc": ends_at_utc.isoformat().replace("+00:00", "Z"),
                        "capacity": capacity,
                    }
                )
        candidate += timedelta(minutes=interval_minutes)
    return slots


def generate_availability(
    schedule: dict[str, Any], from_date: date, to_date: date
) -> dict[str, Any]:
    offering = schedule["offering"]
    try:
        timezone = ZoneInfo(offering["timezone"])
    except ZoneInfoNotFoundError as error:
        raise ValueError("Offering timezone is invalid") from error

    has_schedule = bool(schedule["rules"] or schedule["exceptions"])
    days: list[dict[str, Any]] = []
    current_date = from_date
    while current_date <= to_date:
        exception = schedule["exceptions"].get(current_date)
        if exception is not None and exception["kind"] == "closed":
            windows: list[tuple[time, time]] = []
            status = "closed"
        elif exception is not None:
            windows = exception["windows"]
            status = "override"
        else:
            windows = [
                (rule["start_local_time"], rule["end_local_time"])
                for rule in schedule["rules"]
                if rule["day_of_week"] == current_date.isoweekday()
                and (rule["valid_from"] is None or rule["valid_from"] <= current_date)
                and (rule["valid_until"] is None or rule["valid_until"] >= current_date)
            ]
            status = "scheduled" if windows else ("closed" if has_schedule else "no_schedule")

        slots = [
            slot
            for start_time, end_time in windows
            for slot in _generate_window_slots(
                local_date=current_date,
                start_time=start_time,
                end_time=end_time,
                duration_minutes=offering["duration_minutes"],
                interval_minutes=offering["slot_interval_minutes"],
                capacity=offering["capacity"],
                timezone=timezone,
            )
        ]
        slots.sort(key=lambda slot: slot["starts_at_utc"])
        if windows and not slots:
            status = "no_availability"
        days.append({"date": current_date.isoformat(), "status": status, "slots": slots})
        current_date += timedelta(days=1)

    compact_offering = {
        key: offering[key]
        for key in (
            "id",
            "provider_id",
            "provider_service_id",
            "provider_location_id",
            "provider_name",
            "service_code",
            "service_name",
            "place_id",
            "place_name",
            "address_line",
            "city",
            "duration_minutes",
            "slot_interval_minutes",
            "capacity",
            "is_demo",
        )
    }
    response: dict[str, Any] = {
        "offering": compact_offering,
        "timezone": offering["timezone"],
        "from": from_date.isoformat(),
        "to": to_date.isoformat(),
        "days": days,
        "demo_notice": (
            "Development schedule only — not provider-supplied availability."
            if offering["is_demo"]
            else None
        ),
    }
    if from_date == to_date:
        response.update(
            {"date": days[0]["date"], "status": days[0]["status"], "slots": days[0]["slots"]}
        )
    return response


@router.get("/providers/{provider_id}/offerings")
def provider_offerings(
    provider_id: int,
    repository: AvailabilityRepository = Depends(get_availability_repository),
) -> dict[str, Any]:
    offerings = repository.list_provider_offerings(provider_id)
    if offerings is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {
        "provider_id": provider_id,
        "offerings": offerings,
        "meta": {"returned": len(offerings)},
    }


@router.get("/offerings/{offering_id}/availability")
def offering_availability(
    offering_id: int,
    requested_date: date | None = Query(default=None, alias="date"),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    repository: AvailabilityRepository = Depends(get_availability_repository),
) -> dict[str, Any]:
    if requested_date is not None and (from_date is not None or to_date is not None):
        raise HTTPException(status_code=400, detail="Use date or from/to, not both")
    if (from_date is None) != (to_date is None):
        raise HTTPException(status_code=400, detail="from and to must be provided together")
    if requested_date is not None:
        range_start = range_end = requested_date
    elif from_date is not None and to_date is not None:
        range_start, range_end = from_date, to_date
    else:
        range_start = range_end = datetime.now(ZoneInfo(DEFAULT_TIMEZONE)).date()
    if range_end < range_start:
        raise HTTPException(status_code=400, detail="to must be on or after from")
    if (range_end - range_start).days + 1 > MAX_AVAILABILITY_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Availability ranges are limited to {MAX_AVAILABILITY_DAYS} days",
        )

    schedule = repository.get_offering_schedule(offering_id, range_start, range_end)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Bookable offering not found")
    try:
        return generate_availability(schedule, range_start, range_end)
    except ValueError as error:
        raise HTTPException(
            status_code=500, detail="Availability configuration is invalid"
        ) from error
