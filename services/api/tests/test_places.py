from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.places import get_places_repository

SAMPLE_PLACES = [
    {
        "id": 11,
        "name": "Vilnius Cafe",
        "category": "food_drink",
        "subcategory": "cafe",
        "longitude": 25.2797,
        "latitude": 54.6872,
        "address_line": "Gedimino pr. 1",
        "opening_hours_raw": "Mo-Su 08:00-20:00",
        "phone": "+37000000000",
        "website": "https://example.test",
    },
    {
        "id": 12,
        "name": "Vilnius Pharmacy",
        "category": "health",
        "subcategory": "pharmacy",
        "longitude": 25.30,
        "latitude": 54.70,
        "address_line": None,
        "opening_hours_raw": None,
        "phone": None,
        "website": None,
    },
    {
        "id": 13,
        "name": "Outside Shop",
        "category": "shopping",
        "subcategory": "convenience",
        "longitude": 25.45,
        "latitude": 54.80,
        "address_line": None,
        "opening_hours_raw": None,
        "phone": None,
        "website": None,
    },
]


class FakePlacesRepository:
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
        matches = [
            place
            for place in SAMPLE_PLACES
            if west <= place["longitude"] <= east
            and south <= place["latitude"] <= north
            and (category is None or place["category"] == category)
        ][:limit]
        return [
            {
                "type": "Feature",
                "id": place["id"],
                "geometry": {
                    "type": "Point",
                    "coordinates": [place["longitude"], place["latitude"]],
                },
                "properties": {
                    key: place[key]
                    for key in ("id", "name", "category", "subcategory")
                },
            }
            for place in matches
        ]

    def get_place(self, place_id: int) -> dict[str, Any] | None:
        place = next((item for item in SAMPLE_PLACES if item["id"] == place_id), None)
        if place is None:
            return None
        return {
            **place,
            "description": None,
            "postal_code": None,
            "city": "Vilnius",
            "country_code": "LT",
            "email": None,
            "raw_classification": {"key": "amenity", "value": place["subcategory"]},
            "source": "openstreetmap",
            "source_name": "OpenStreetMap",
            "attribution": "© OpenStreetMap contributors",
            "license_name": "Open Database License 1.0",
            "license_url": "https://opendatacommons.org/licenses/odbl/1-0/",
            "external_id": f"n{place_id}",
            "source_updated_at": "2026-08-16T20:00:00Z",
        }


@pytest.fixture(autouse=True)
def fake_repository() -> None:
    repository = FakePlacesRepository()
    app.dependency_overrides[get_places_repository] = lambda: repository
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


def test_place_list_is_geojson_and_filtered_by_bounds() -> None:
    response = client.get(
        "/api/v1/places?west=25.20&south=54.60&east=25.35&north=54.75"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "FeatureCollection"
    assert [feature["properties"]["name"] for feature in payload["features"]] == [
        "Vilnius Cafe",
        "Vilnius Pharmacy",
    ]
    assert payload["features"][0]["geometry"] == {
        "type": "Point",
        "coordinates": [25.2797, 54.6872],
    }


def test_place_list_filters_category() -> None:
    response = client.get(
        "/api/v1/places?west=25.20&south=54.60&east=25.35&north=54.75&category=health"
    )
    assert response.status_code == 200
    assert [item["properties"]["category"] for item in response.json()["features"]] == [
        "health"
    ]


def test_place_list_enforces_limit() -> None:
    response = client.get(
        "/api/v1/places?west=25.10&south=54.55&east=25.50&north=54.85&limit=1"
    )
    assert response.status_code == 200
    assert len(response.json()["features"]) == 1
    assert client.get(
        "/api/v1/places?west=25.10&south=54.55&east=25.50&north=54.85&limit=501"
    ).status_code == 422


def test_place_details_include_provenance() -> None:
    response = client.get("/api/v1/places/11")
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Vilnius Cafe"
    assert payload["source"] == "openstreetmap"
    assert payload["attribution"] == "© OpenStreetMap contributors"
    assert payload["external_id"] == "n11"


def test_place_details_returns_404() -> None:
    assert client.get("/api/v1/places/999").status_code == 404


def test_place_list_rejects_invalid_bounds_and_category() -> None:
    assert client.get(
        "/api/v1/places?west=25.4&south=54.6&east=25.2&north=54.7"
    ).status_code == 422
    assert client.get(
        "/api/v1/places?west=25.2&south=54.6&east=25.4&north=54.7&category=unknown"
    ).status_code == 422
