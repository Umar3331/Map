# Search and discovery

Milestone 3 provides local Vilnius place discovery over the application-owned `app.places` table.
It never queries the replaceable `osm.*` basemap tables or an external search provider.

## API

`GET /api/v1/search` accepts:

- `q` — required, 2–120 normalized characters;
- `limit` — optional, default 10 and maximum 25;
- `category` — optional Map category filter;
- `west`, `south`, `east`, `north` — optional all-or-none viewport ranking context;
- `latitude`, `longitude` — optional all-or-none map-centre distance context.

Bounds are not a hard filter. A user can find a place elsewhere inside the imported Vilnius scope.
The compact response contains `id`, name, category, subcategory, coordinates, optional address, and
optional rounded distance. Full details and provenance remain at `GET /api/v1/places/{id}`.

```json
{
  "query": "coffee",
  "results": [
    {
      "id": 123,
      "name": "Coffee Inn",
      "category": "food_drink",
      "subcategory": "cafe",
      "latitude": 54.687,
      "longitude": 25.28,
      "address_line": "Gedimino pr. 1",
      "distance_m": 240
    }
  ],
  "meta": { "returned": 1, "intent": "category" }
}
```

## Normalization

Canonical names and Lithuanian diacritics are preserved. Import-time `normalized_name` and API query
normalization lowercase text, trim outer whitespace, collapse repeated whitespace, and replace
punctuation/separator runs with one space. For example, `  MAXIMA---X ` becomes `maxima x`, while
`Švyturys` remains `švyturys`. SQL inputs are always parameters, and the API rejects oversized or
structurally incomplete geographic parameters.

## Intent and ranking

The response reports `meta.intent` as `name` or `category`.

Ordinary name/brand intent uses exact normalized name, prefix, strong trigram similarity, substring,
and weaker trigram tiers. Viewport membership and distance break equivalent text ties, followed by
normalized name and stable ID. A nearby weak match cannot outrank an exact brand. `Lemon Gym` is
therefore name intent.

An exact or conservatively typo-resolved alias uses category intent. Its mapped subcategory or
category is the candidate set; the name does not need to contain the query. Exact normalized-name
relationships can improve results inside that taxonomy, then viewport, distance, normalized name,
and ID provide deterministic ordering. A literal `+` is treated as meaningful brand punctuation,
so `Gym+` stays name intent instead of becoming generic `gym` discovery.

## Category aliases and typos

The explicit alias set is intentionally small:

| Query | Target |
| --- | --- |
| `bank` | subcategory `bank` |
| `cafe`, `coffee` | subcategory `cafe` |
| `car repair` | subcategory `car_repair` |
| `food` | category `food_drink` |
| `groceries`, `supermarket` | subcategory `supermarket` |
| `gym` | subcategory `fitness_centre` |
| `hair`, `hairdresser` | subcategory `hairdresser` |
| `hotel` | subcategory `hotel` |
| `pharmacy` | subcategory `pharmacy` |
| `restaurant` | subcategory `restaurant` |

Name typos use PostgreSQL trigram similarity. Alias terms of four or more characters also accept a
conservative similarity ratio of 0.78, enabling examples such as `resturant` and `pharmcy` without a
large synonym engine.

## Indexes and performance

The idempotent places schema enables `pg_trgm` and maintains:

- partial B-tree `places_normalized_name_prefix_idx`;
- partial GIN `places_normalized_name_trgm_idx` with `gin_trgm_ops`;
- partial B-tree `places_subcategory_idx`;
- the existing active category and GiST geometry indexes.

On the Windows reference database with 4,724 active places, warm `EXPLAIN ANALYZE` execution measured:

| Query shape | DB execution | Representative index |
| --- | ---: | --- |
| exact `Maxima` | 0.111 ms | normalized-name prefix B-tree |
| prefix `Rim` | 0.206 ms | normalized-name prefix B-tree |
| typo `maxma` | 1.184 ms | normalized-name trigram GIN |
| category `restaurant` | 0.273 ms | indexed ordered scan/filter |
| category-intent `gym` candidate set | 0.221 ms | subcategory B-tree |
| centre-biased `cafe` | 9.442 ms | subcategory B-tree plus distance sort |

Warm same-origin API medians through Caddy at `127.0.0.1:5173` were 14.17–16.52 ms across exact,
prefix, fuzzy, category, and viewport-biased queries. Measurements vary with hardware, Docker state,
cache warmth, and network name resolution.
The intent-aware, centre-biased `gym` endpoint measured a 3.49 ms median over 20 additional warm
same-origin requests (3.30 ms minimum and 5.99 ms maximum).

## Browser behavior

The combobox waits 250 ms, aborts the previous request when input changes, and prevents a stale
response from replacing newer results. Desktop supports Arrow Down, Arrow Up, Enter, and Escape.
Mobile uses the same accessible list in a bounded overlay with touch targets at least 68 px tall.
Meaningful results populate the unclustered `app-search-results` GeoJSON source and make
`app-search-result-points` visible while normal clustered/category place layers are hidden. The
selected result receives its own `app-search-result-selected` highlight. Selection closes the list,
eases the map to zoom 16, loads the existing detail entity, and opens the responsive details UI.
Clear or dismiss empties search results, removes its highlight, and restores normal place layers
without reloading or permanently filtering the underlying viewport data. Normal viewport loading,
empty, error, and truncation messages are suppressed while search results own the map context.

## Known limitations

- Search is limited to the imported Vilnius `app.places` snapshot and its current names/categories.
- There is no transliteration, Lithuanian stemming, multilingual synonym corpus, autocomplete
  analytics, personalization, ratings, recommendations, or semantic/AI interpretation.
- Trigram matching is deliberately conservative and may miss severe misspellings.
- Distance is straight-line spherical distance, not travel time or routing distance.
- Results are bounded to 25; pagination and a full category browser are deferred.
- Search-result markers show only the returned ranked set and never claim to be a total category
  count.
