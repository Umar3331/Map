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
    {
        "id": 6,
        "name": "Atletų kalvė",
        "normalized_name": "atletų kalvė",
        "category": "fitness",
        "subcategory": "fitness_centre",
        "latitude": 54.720,
        "longitude": 25.320,
        "address_line": None,
        "status": "active",
    },
    {
        "id": 7,
        "name": "Gym+",
        "normalized_name": "gym",
        "category": "fitness",
        "subcategory": "fitness_centre",
        "latitude": 54.700,
        "longitude": 25.300,
        "address_line": None,
        "status": "active",
    },
    {
        "id": 8,
        "name": "Lemon Gym",
        "normalized_name": "lemon gym",
        "category": "fitness",
        "subcategory": "fitness_centre",
        "latitude": 54.710,
        "longitude": 25.310,
        "address_line": None,
        "status": "active",
    },
    {
        "id": 9,
        "name": "Pool Arena",
        "normalized_name": "pool arena",
        "category": "fitness",
        "subcategory": "sports_centre",
        "latitude": 54.705,
        "longitude": 25.305,
        "address_line": None,
        "status": "active",
    },
]


class FakeSearchRepository:
    def search_places(self, **parameters: Any) -> list[dict[str, Any]]:
        query = parameters["query"]
        category_intent = parameters["category_intent"]
        alias_category = parameters["alias_category"]
        alias_subcategories = parameters["alias_subcategories"]
        category = parameters["category"]
        origin = (parameters["latitude"], parameters["longitude"])
        matches = []
        for place in SEARCH_PLACES:
            if place["status"] != "active" or (category and place["category"] != category):
                continue
            name = place["normalized_name"]
            similarity = SequenceMatcher(None, name, query).ratio()
            taxonomy_relevance = (
                2 if place["subcategory"] in alias_subcategories
                else 1 if alias_category == place["category"]
                else 0
            )
            name_match = query in name or similarity >= 0.55
            if (category_intent and not taxonomy_relevance) or (
                not category_intent and not name_match
            ):
                continue
            if name == query:
                relevance = 100
            elif name.startswith(query):
                relevance = 90
            elif similarity >= 0.55:
                relevance = 80
            else:
                relevance = 60
            distance = None
            if all(value is not None for value in origin):
                distance = round(
                    ((place["latitude"] - origin[0]) ** 2 + (place["longitude"] - origin[1]) ** 2)
                    ** 0.5
                    * 100_000
                )
            matches.append((taxonomy_relevance, relevance, similarity, distance, place))
        matches.sort(
            key=lambda item: (
                -item[0] if category_intent else -item[1],
                -(item[4]["normalized_name"] == query) if category_intent else 0,
                item[3] if item[3] is not None else float("inf"),
                -item[2] if not category_intent else 0,
                item[4]["normalized_name"],
                item[4]["id"],
            )
        )
        return [
            {
                key: value
                for key, value in {**item[4], "distance_m": item[3]}.items()
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
    ("query", "category", "subcategories"),
    [
        ("food", "food_drink", ()),
        ("restaurant", None, ("restaurant",)),
        ("resturant", None, ("restaurant",)),
        ("pharmcy", None, ("pharmacy",)),
    ],
)
def test_category_aliases_and_alias_typos_resolve(
    query: str,
    category: str | None,
    subcategories: tuple[str, ...],
) -> None:
    alias = resolve_search_alias(query)
    assert alias is not None
    assert alias.category == category
    assert alias.subcategories == subcategories


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
    assert payload["meta"] == {"returned": 1, "intent": "name"}
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


def test_category_intent_includes_taxonomy_matches_without_name_match() -> None:
    response = client.get("/api/v1/search?q=gym")
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["intent"] == "category"
    assert {result["id"] for result in payload["results"]} == {6, 7, 8}
    assert any("gym" not in result["name"].lower() for result in payload["results"])
    assert all(result["subcategory"] == "fitness_centre" for result in payload["results"])


def test_specific_brand_query_does_not_become_generic_category_intent() -> None:
    gym_plus = client.get("/api/v1/search?q=Gym%2B").json()
    lemon_gym = client.get("/api/v1/search?q=Lemon%20Gym").json()
    assert gym_plus["meta"]["intent"] == "name"
    assert gym_plus["results"][0]["name"] == "Gym+"
    assert all(result["id"] != 6 for result in gym_plus["results"])
    assert lemon_gym["meta"]["intent"] == "name"
    assert lemon_gym["results"][0]["name"] == "Lemon Gym"


def test_category_geography_breaks_taxonomy_ties_deterministically() -> None:
    response = client.get("/api/v1/search?q=gym&latitude=54.710&longitude=25.310")
    results = response.json()["results"]
    assert [result["id"] for result in results] == [7, 8, 6]
    assert results[1]["distance_m"] == 0


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
