from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import get_providers_repository


class FakeProvidersRepository:
    def get_provider(self, provider_id: int) -> dict[str, Any] | None:
        if provider_id != 21:
            return None
        return {
            "id": 21,
            "display_name": "Lemon Gym",
            "legal_name": None,
            "description": None,
            "phone": None,
            "email": None,
            "website": "https://example.test",
            "locations": [
                {
                    "place_id": 11,
                    "place_name": "Lemon Gym",
                    "address_line": "Konstitucijos pr. 7A",
                    "postal_code": None,
                    "city": "Vilnius",
                    "longitude": 25.2701,
                    "latitude": 54.6962,
                    "is_primary": True,
                }
            ],
            "sources": [
                {
                    "source": "openstreetmap",
                    "source_name": "OpenStreetMap",
                    "external_id": "n11",
                    "attribution": "© OpenStreetMap contributors",
                    "license_name": "Open Database License 1.0",
                    "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
                    "source_url": "https://www.openstreetmap.org/",
                    "imported_at": "2026-08-17T12:00:00Z",
                }
            ],
        }

    def list_place_providers(self, place_id: int) -> list[dict[str, Any]]:
        if place_id != 11:
            return []
        return [
            {
                "id": 21,
                "display_name": "Lemon Gym",
                "description": None,
                "is_primary": True,
                "service_count": 2,
            }
        ]

    def list_provider_services(self, provider_id: int) -> list[dict[str, Any]] | None:
        if provider_id != 21:
            return None
        return [
            {
                "id": 1,
                "code": "gym_membership",
                "name": "Gym membership",
                "category": "fitness",
                "display_name": None,
                "description": None,
                "price_amount": None,
                "price_currency": None,
                "duration_minutes": None,
            },
            {
                "id": 2,
                "code": "group_fitness",
                "name": "Group fitness",
                "category": "fitness",
                "display_name": None,
                "description": None,
                "price_amount": None,
                "price_currency": None,
                "duration_minutes": None,
            },
        ]


@pytest.fixture(autouse=True)
def fake_repository() -> None:
    app.dependency_overrides[get_providers_repository] = lambda: FakeProvidersRepository()
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


def test_provider_detail_includes_locations_and_provenance() -> None:
    response = client.get("/api/v1/providers/21")
    assert response.status_code == 200
    payload = response.json()
    assert payload["display_name"] == "Lemon Gym"
    assert payload["locations"][0]["place_id"] == 11
    assert payload["sources"][0]["source"] == "openstreetmap"
    assert payload["sources"][0]["attribution"] == "© OpenStreetMap contributors"


def test_provider_not_found() -> None:
    assert client.get("/api/v1/providers/999").status_code == 404
    assert client.get("/api/v1/providers/999/services").status_code == 404


def test_place_provider_summary_is_compact() -> None:
    response = client.get("/api/v1/places/11/providers")
    assert response.status_code == 200
    assert response.json() == {
        "place_id": 11,
        "providers": [
            {
                "id": 21,
                "display_name": "Lemon Gym",
                "description": None,
                "is_primary": True,
                "service_count": 2,
            }
        ],
        "meta": {"returned": 1},
    }


def test_place_without_provider_returns_empty_collection() -> None:
    response = client.get("/api/v1/places/12/providers")
    assert response.status_code == 200
    assert response.json()["providers"] == []
    assert response.json()["meta"] == {"returned": 0}


def test_provider_services_serialize_null_commercial_fields() -> None:
    response = client.get("/api/v1/providers/21/services")
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"] == {"returned": 2}
    assert [service["code"] for service in payload["services"]] == [
        "gym_membership",
        "group_fitness",
    ]
    assert payload["services"][0]["price_amount"] is None
    assert payload["services"][0]["duration_minutes"] is None
