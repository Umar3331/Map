import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Protocol
from unicodedata import category as unicode_category
from unicodedata import normalize as unicode_normalize

from fastapi import APIRouter, Depends, HTTPException, Query

from app.places import PLACE_CATEGORIES, get_places_repository

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@dataclass(frozen=True)
class SearchAlias:
    category: str | None = None
    subcategories: tuple[str, ...] = ()


SEARCH_ALIASES = {
    "bank": SearchAlias(subcategories=("bank",)),
    "cafe": SearchAlias(subcategories=("cafe",)),
    "coffee": SearchAlias(subcategories=("cafe",)),
    "car repair": SearchAlias(subcategories=("car_repair",)),
    "food": SearchAlias(category="food_drink"),
    "groceries": SearchAlias(subcategories=("supermarket",)),
    "gym": SearchAlias(subcategories=("fitness_centre",)),
    "hair": SearchAlias(subcategories=("hairdresser",)),
    "hairdresser": SearchAlias(subcategories=("hairdresser",)),
    "hotel": SearchAlias(subcategories=("hotel",)),
    "pharmacy": SearchAlias(subcategories=("pharmacy",)),
    "restaurant": SearchAlias(subcategories=("restaurant",)),
    "supermarket": SearchAlias(subcategories=("supermarket",)),
}


class SearchRepository(Protocol):
    def search_places(self, **parameters: Any) -> list[dict[str, Any]]: ...


def normalize_search_text(value: str) -> str:
    normalized = unicode_normalize("NFKC", value).lower()
    without_punctuation = "".join(
        " " if unicode_category(character)[0] in {"P", "Z"} else character
        for character in normalized
    )
    return re.sub(r"\s+", " ", without_punctuation).strip()


def resolve_search_alias(query: str) -> SearchAlias | None:
    direct = SEARCH_ALIASES.get(query)
    if direct is not None or len(query) < 4:
        return direct
    alias, ratio = max(
        (
            (candidate, SequenceMatcher(None, query, candidate).ratio())
            for candidate in SEARCH_ALIASES
        ),
        key=lambda item: item[1],
    )
    return SEARCH_ALIASES[alias] if ratio >= 0.78 else None


@router.get("")
def search_places(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=10, ge=1, le=25),
    category: str | None = Query(default=None),
    west: float | None = Query(default=None, ge=-180, le=180),
    south: float | None = Query(default=None, ge=-90, le=90),
    east: float | None = Query(default=None, ge=-180, le=180),
    north: float | None = Query(default=None, ge=-90, le=90),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    repository: SearchRepository = Depends(get_places_repository),
) -> dict[str, Any]:
    query = normalize_search_text(q)
    if len(query) < 2:
        raise HTTPException(
            status_code=422, detail="Search query must contain at least 2 characters"
        )
    if category is not None and category not in PLACE_CATEGORIES:
        raise HTTPException(status_code=422, detail="Unknown place category")

    bounds = (west, south, east, north)
    if any(value is not None for value in bounds):
        if not all(value is not None for value in bounds):
            raise HTTPException(status_code=422, detail="Search bounds must be provided together")
        if west is None or south is None or east is None or north is None:
            raise HTTPException(status_code=422, detail="Search bounds must be provided together")
        if west >= east or south >= north:
            raise HTTPException(status_code=422, detail="Invalid bounding box")
    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=422, detail="Search origin must include latitude and longitude"
        )

    # A literal plus is meaningful in local brands such as Gym+. Do not collapse
    # that brand query into the generic `gym` discovery alias after normalization.
    alias = None if "+" in q else resolve_search_alias(query)
    results = repository.search_places(
        query=query,
        category_intent=alias is not None,
        category=category,
        alias_category=alias.category if alias else None,
        alias_subcategories=alias.subcategories if alias else (),
        west=west,
        south=south,
        east=east,
        north=north,
        latitude=latitude,
        longitude=longitude,
        limit=limit,
    )
    return {
        "query": query,
        "results": results,
        "meta": {"returned": len(results), "intent": "category" if alias else "name"},
    }
