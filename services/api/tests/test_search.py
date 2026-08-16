from difflib import SequenceMatcher
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.places import get_places_repository
from app.search import normalize_search_text, resolve_search_alias

SEARCH_PLACES = [
    {
        "id": 1,
        "name": "Maxima",
        "normalized_name": "maxima",
        "category": "shopping",
        "subcategory": "supermarket",
        "latitude": 54.687,
        "longitude": 25.280,
        "address_line": "Gedimino pr. 1",
        "status": "active",
    },
    {
        "id": 2,
        "name": "Maxima X",
        "normalized_name": "maxima x",
        "category": "shopping",
        "subcategory": "supermarket",
        "latitude": 54.700,
        "longitude": 25.300,
        "address_line": None,
        "status": "active",
    },
    {
        "id": 3,
        "name": "Švyturys",
        "normalized_name": "švyturys",
        "category": "food_drink",
        "subcategory": "restaurant",
        "latitude": 54.680,
        "longitude": 25.270,
        "address_line": "Pilies g. 2",
        "status": "active",
    },
    {
        "id": 4,
        "name": "Old Pharmacy",
        "normalized_name": "old pharmacy",
        "category": "health",
        "subcategory": "pharmacy",
        "latitude": 54.690,
        "longitude": 25.290,
        "address_line": None,
        "status": "inactive",
    },
    {
        "id": 5,
        "name": "Maxima",
        "normalized_name": "maxima",
        "category": "shopping",
        "subcategory": "supermarket",
        "latitude": 54.710,
        "longitude": 25.310,
        "address_line": "Test g. 5",
        "status": "active",
    },
]


class FakeSearchRepository:
    def search_places(self, **parameters: Any) -> list[dict[str, Any]]:
        query = parameters["query"]
        alias_category = parameters["alias_category"]
        alias_subcategory = parameters["alias_subcategory"]
        category = parameters["category"]
        origin = (parameters["latitude"], parameters["longitude"])
        matches = []
        for place in SEARCH_PLACES:
            if place["status"] != "active" or (category and place["category"] != category):
                continue
            name = place["normalized_name"]
            similarity = SequenceMatcher(None, name, query).ratio()
            alias_match = (
                alias_category == place["category"] or alias_subcategory == place["subcategory"]
            )
            if not (query in name or similarity >= 0.55 or alias_match):
                continue
            if name == query:
                relevance = 100
            elif name.startswith(query):
                relevance = 90
            elif similarity >= 0.55:
                relevance = 80
            elif alias_subcategory == place["subcategory"]:
                relevance = 70
            elif alias_category == place["category"]:
                relevance = 65
            else:
                relevance = 60
            distance = None
            if all(value is not None for value in origin):
                distance = round(
                    ((place["latitude"] - origin[0]) ** 2 + (place["longitude"] - origin[1]) ** 2)
                    ** 0.5
                    * 100_000
                )
            matches.append((relevance, similarity, distance, place))
        matches.sort(
            key=lambda item: (
                -item[0],
                -item[1],
                item[2] if item[2] is not None else float("inf"),
                item[3]["normalized_name"],
                item[3]["id"],
            )
        )
        return [
            {
                key: value
                for key, value in {**item[3], "distance_m": item[2]}.items()
                if key not in {"normalized_name", "status"}
            }
            for item in matches[: parameters["limit"]]
        ]


@pytest.fixture(autouse=True)
def fake_repository() -> None:
    repository = FakeSearchRepository()
    app.dependency_overrides[get_places_repository] = lambda: repository
    yield
    app.dependency_overrides.clear()


client = TestClient(app)


def test_search_rejects_missing_empty_short_and_oversized_queries() -> None:
    assert client.get("/api/v1/search").status_code == 422
    assert client.get("/api/v1/search?q=").status_code == 422
    assert client.get("/api/v1/search?q=x").status_code == 422
    assert client.get(f"/api/v1/search?q={'x' * 121}").status_code == 422


def test_search_normalizes_case_spacing_punctuation_and_preserves_diacritics() -> None:
    assert normalize_search_text("  MAXIMA---X  ") == "maxima x"
    assert normalize_search_text("  Švyturys  ") == "švyturys"
    response = client.get("/api/v1/search?q=%C5%A0VYTURYS")
    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Švyturys"


def test_exact_name_precedes_prefix_with_deterministic_order() -> None:
    response = client.get("/api/v1/search?q=maxima")
    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"][:3]] == [1, 5, 2]


def test_fuzzy_typo_returns_relevant_name() -> None:
    response = client.get("/api/v1/search?q=maxma")
    assert response.status_code == 200
    assert response.json()["results"][0]["name"] == "Maxima"


@pytest.mark.parametrize(
    ("query", "category", "subcategory"),
    [
        ("food", "food_drink", None),
        ("restaurant", None, "restaurant"),
        ("resturant", None, "restaurant"),
        ("pharmcy", None, "pharmacy"),
    ],
)
def test_category_aliases_and_alias_typos_resolve(
    query: str,
    category: str | None,
    subcategory: str | None,
) -> None:
    alias = resolve_search_alias(query)
    assert alias is not None
    assert alias.category == category
    assert alias.subcategory == subcategory


def test_category_alias_search_and_category_filter() -> None:
    response = client.get("/api/v1/search?q=restaurant&category=food_drink")
    assert response.status_code == 200
    assert [result["name"] for result in response.json()["results"]] == ["Švyturys"]
    assert client.get("/api/v1/search?q=maxima&category=health").json()["results"] == []
    assert client.get("/api/v1/search?q=maxima&category=invalid").status_code == 422


def test_limit_and_response_serialization_are_bounded() -> None:
    response = client.get("/api/v1/search?q=maxima&limit=1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "maxima"
    assert payload["meta"] == {"returned": 1}
    assert set(payload["results"][0]) == {
        "id",
        "name",
        "category",
        "subcategory",
        "latitude",
        "longitude",
        "address_line",
        "distance_m",
    }
    assert client.get("/api/v1/search?q=maxima&limit=26").status_code == 422


def test_geographic_bias_breaks_equivalent_text_ties_without_overriding_exact_match() -> None:
    response = client.get("/api/v1/search?q=maxima&latitude=54.710&longitude=25.310")
    assert response.status_code == 200
    results = response.json()["results"]
    assert [result["id"] for result in results[:3]] == [5, 1, 2]
    assert results[0]["distance_m"] == 0


def test_optional_geography_requires_complete_valid_pairs() -> None:
    assert client.get("/api/v1/search?q=maxima&latitude=54.7").status_code == 422
    assert client.get("/api/v1/search?q=maxima&west=25.1").status_code == 422
    assert (
        client.get("/api/v1/search?q=maxima&west=25.5&south=54.5&east=25.1&north=54.8").status_code
        == 422
    )


def test_no_results_and_inactive_places_are_excluded() -> None:
    assert client.get("/api/v1/search?q=zzzzzz").json()["results"] == []
    assert client.get("/api/v1/search?q=old%20pharmacy").json()["results"] == []
