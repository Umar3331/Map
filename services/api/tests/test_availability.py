from datetime import date, time
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.availability import generate_availability, get_availability_repository
from app.main import app


def offering() -> dict[str, Any]:
    return {
        "id": 51,
        "provider_id": 21,
        "provider_service_id": 31,
        "provider_location_id": 41,
        "provider_name": "12Boksas",
        "service_code": "vehicle_repair",
        "service_name": "Vehicle repair",
        "place_id": 11,
        "place_name": "12Boksas",
        "address_line": None,
        "city": "Vilnius",
        "duration_minutes": 60,
        "slot_interval_minutes": 30,
        "capacity": 1,
        "timezone": "Europe/Vilnius",
        "is_demo": True,
        "data_source": "development_fixture",
    }


def rule(day: int, start: time, end: time) -> dict[str, Any]:
    return {
        "day_of_week": day,
        "start_local_time": start,
        "end_local_time": end,
        "valid_from": None,
        "valid_until": None,
    }


def schedule(
    *,
    rules: list[dict[str, Any]] | None = None,
    exceptions: dict[date, dict[str, Any]] | None = None,
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "offering": {**offering(), **(overrides or {})},
        "rules": rules or [],
        "exceptions": exceptions or {},
    }


class FakeAvailabilityRepository:
    def list_provider_offerings(self, provider_id: int) -> list[dict[str, Any]] | None:
        if provider_id == 999:
            return None
        if provider_id != 21:
            return []
        item = offering()
        return [{key: value for key, value in item.items() if key != "data_source"}]

    def get_offering_schedule(
        self, offering_id: int, from_date: date, to_date: date
    ) -> dict[str, Any] | None:
        del from_date, to_date
        if offering_id != 51:
            return None
        return schedule(
            rules=[
                rule(1, time(9), time(12)),
                rule(1, time(13), time(17)),
                rule(2, time(9), time(17)),
            ],
            exceptions={
                date(2026, 8, 24): {"kind": "closed", "note": "Demo closure", "windows": []},
                date(2026, 8, 25): {
                    "kind": "override",
                    "note": "Demo override",
                    "windows": [(time(10), time(14))],
                },
            },
        )


@pytest.fixture(autouse=True)
def fake_repository() -> None:
    app.dependency_overrides[get_availability_repository] = lambda: FakeAvailabilityRepository()
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


def test_weekly_schedule_multiple_windows_duration_and_interval() -> None:
    payload = generate_availability(
        schedule(rules=[rule(1, time(9), time(12)), rule(1, time(13), time(15))]),
        date(2026, 8, 17),
        date(2026, 8, 17),
    )
    starts = [slot["starts_at"][11:16] for slot in payload["slots"]]
    assert starts == ["09:00", "09:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00"]
    assert payload["slots"][0]["ends_at"][11:16] == "10:00"
    assert payload["status"] == "scheduled"


def test_closed_weekday_and_no_schedule_are_distinct() -> None:
    closed = generate_availability(
        schedule(rules=[rule(1, time(9), time(12))]),
        date(2026, 8, 18),
        date(2026, 8, 18),
    )
    missing = generate_availability(schedule(), date(2026, 8, 18), date(2026, 8, 18))
    assert closed["status"] == "closed"
    assert missing["status"] == "no_schedule"
    assert closed["slots"] == missing["slots"] == []


def test_date_closure_takes_precedence_over_weekly_rule() -> None:
    payload = generate_availability(
        schedule(
            rules=[rule(1, time(9), time(17))],
            exceptions={date(2026, 8, 17): {"kind": "closed", "note": None, "windows": []}},
        ),
        date(2026, 8, 17),
        date(2026, 8, 17),
    )
    assert payload["status"] == "closed"
    assert payload["slots"] == []


def test_date_override_replaces_weekly_rule() -> None:
    payload = generate_availability(
        schedule(
            rules=[rule(2, time(9), time(17))],
            exceptions={
                date(2026, 8, 18): {
                    "kind": "override",
                    "note": None,
                    "windows": [(time(10), time(12))],
                }
            },
        ),
        date(2026, 8, 18),
        date(2026, 8, 18),
    )
    assert payload["status"] == "override"
    assert [slot["starts_at"][11:16] for slot in payload["slots"]] == ["10:00", "10:30", "11:00"]


def test_timezone_serialization_and_capacity() -> None:
    payload = generate_availability(
        schedule(
            rules=[rule(1, time(9), time(10))],
            overrides={"duration_minutes": 30, "capacity": 12},
        ),
        date(2026, 1, 5),
        date(2026, 1, 5),
    )
    assert payload["timezone"] == "Europe/Vilnius"
    assert payload["slots"][0]["starts_at"].endswith("+02:00")
    assert payload["slots"][0]["starts_at_utc"].endswith("Z")
    assert payload["slots"][0]["capacity"] == 12


def test_spring_forward_skips_nonexistent_local_starts() -> None:
    payload = generate_availability(
        schedule(
            rules=[rule(7, time(1), time(6))],
            overrides={"duration_minutes": 30, "slot_interval_minutes": 30},
        ),
        date(2026, 3, 29),
        date(2026, 3, 29),
    )
    starts = [slot["starts_at"] for slot in payload["slots"]]
    assert not any("T03:00" in start or "T03:30" in start for start in starts)
    assert any(start.endswith("+02:00") for start in starts)
    assert any(start.endswith("+03:00") for start in starts)


def test_autumn_fallback_has_no_duplicate_local_start() -> None:
    payload = generate_availability(
        schedule(
            rules=[rule(7, time(1), time(6))],
            overrides={"duration_minutes": 30, "slot_interval_minutes": 30},
        ),
        date(2026, 10, 25),
        date(2026, 10, 25),
    )
    local_starts = [slot["starts_at"][:16] for slot in payload["slots"]]
    assert len(local_starts) == len(set(local_starts))
    assert any(slot["starts_at"].endswith("+03:00") for slot in payload["slots"])
    assert any(slot["starts_at"].endswith("+02:00") for slot in payload["slots"])


def test_provider_offerings_are_compact_and_demo_labelled() -> None:
    response = client.get("/api/v1/providers/21/offerings")
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"] == {"returned": 1}
    assert payload["offerings"][0]["is_demo"] is True
    assert payload["offerings"][0]["service_code"] == "vehicle_repair"


def test_provider_and_inactive_offering_not_found() -> None:
    assert client.get("/api/v1/providers/999/offerings").status_code == 404
    assert client.get("/api/v1/offerings/999/availability?date=2026-08-17").status_code == 404


def test_single_date_api_serializes_slots_deterministically() -> None:
    response = client.get("/api/v1/offerings/51/availability?date=2026-08-17")
    assert response.status_code == 200
    payload = response.json()
    assert payload["date"] == "2026-08-17"
    assert payload["status"] == "scheduled"
    assert payload["offering"]["service_name"] == "Vehicle repair"
    assert payload["demo_notice"].startswith("Development schedule")
    assert payload["slots"] == sorted(payload["slots"], key=lambda slot: slot["starts_at_utc"])


def test_range_boundary_and_maximum_range() -> None:
    valid = client.get("/api/v1/offerings/51/availability?from=2026-08-01&to=2026-08-31")
    assert valid.status_code == 200
    assert len(valid.json()["days"]) == 31
    too_long = client.get("/api/v1/offerings/51/availability?from=2026-08-01&to=2026-09-01")
    assert too_long.status_code == 400


@pytest.mark.parametrize(
    "query",
    [
        "date=2026-08-17&from=2026-08-17&to=2026-08-18",
        "from=2026-08-17",
        "to=2026-08-17",
        "from=2026-08-18&to=2026-08-17",
    ],
)
def test_invalid_date_range_combinations(query: str) -> None:
    assert client.get(f"/api/v1/offerings/51/availability?{query}").status_code == 400
