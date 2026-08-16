# Vilnius place data

Map derives its initial business and point-of-interest catalogue from the same locally stored
OpenStreetMap snapshot used for the basemap. OpenStreetMap is the upstream source; `app.places` is
the application's own, stable read model and API contract. The disposable `app_import` tables and
the renderer-oriented `osm` schema are deliberately not exposed to clients.

## Import and refresh

```powershell
.\scripts\places-data.ps1
.\scripts\validate-places.ps1
```

The importer reads `data/osm/generated/vilnius-buffered.osm.pbf` through containerized osm2pgsql,
classifies named objects, converts areas to interior points, and upserts by OSM object type and ID.
An existing application ID survives refreshes. Objects missing from a later snapshot are marked
inactive. `-Update` refreshes the downloaded Lithuania extract before importing. Generated PBFs,
database files, and all other local import state remain ignored by Git.

Each run records its start/end time, source file, counts before and after, candidates, inserts,
updates, deactivations, and skip reasons in `app.place_import_runs`. `app.place_sources` records the
OpenStreetMap attribution, licence, source URL, and most recent successful import time.

## Curated taxonomy

The initial taxonomy is intentionally compact and may be superseded by a later ADR as product needs
become clearer:

| Category | Representative source tags |
| --- | --- |
| `food_drink` | restaurant, cafe, bar, pub, fast food, ice cream |
| `shopping` | named shops not assigned to a more specific category |
| `health` | healthcare, pharmacy, clinic, hospital, medical supplies |
| `automotive` | fuel, car wash, vehicle sales/repair/tyres, motorcycle |
| `beauty` | hairdresser, beauty, cosmetics, massage |
| `fitness` | fitness centre, sports centre, swimming pool, pitch |
| `finance` | bank, ATM, bureau de change |
| `accommodation` | hotel, hostel, guest house, apartment, motel, camp site |
| `services` | selected named offices and crafts useful to consumers |
| `other` | cinema, theatre, veterinary, post office, museum, attraction |

The original classification keys and values are retained as JSON provenance, while optional address,
opening-hours, phone, website, and description fields remain nullable. Missing optional data is not
invented or rendered as an empty placeholder.

## API and performance boundary

`GET /api/v1/places` requires west/south/east/north bounds, accepts one optional curated category,
and returns a compact GeoJSON FeatureCollection. The limit defaults to 250 and cannot exceed 500.
The query uses the GiST geometry index before exact intersection filtering. Details and provenance
are loaded on demand from `GET /api/v1/places/{id}`.

The browser replaces the MapLibre GeoJSON source after a debounced map movement. MapLibre performs
clustering in its worker; the API does not ship the entire city catalogue. Selecting an unclustered
point fetches its detail record. Place API failures show a small status message but leave the local
vector basemap interactive.

On the Windows reference import made on 2026-08-16, 5,023 named candidates produced 4,724 active
places. Repeating the import preserved all 4,724 active identities and produced no duplicate source
IDs. A representative city-centre bounds query used the spatial index and completed inside Postgres
in about 2.5 ms; its 500-feature response was about 95 KB. Host-to-container HTTP timing was roughly
0.21-0.25 seconds on that machine. Measurements vary with hardware, bounds, cache state, and source
snapshot.

## Attribution and licence

Place data is © OpenStreetMap contributors and is available under the Open Database License (ODbL).
The map continues to show OpenStreetMap attribution, and every detail response identifies the source
and links to the upstream OSM object. Derived database use and distribution must comply with the
[OpenStreetMap copyright and licence terms](https://www.openstreetmap.org/copyright).
