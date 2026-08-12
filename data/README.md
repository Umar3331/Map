# Map data

Large source extracts, generated tiles, caches, and database files do not belong in Git.

`scripts/map-data.ps1` downloads the current Geofabrik Lithuania extract when absent, validates it,
and uses a containerized Osmium tool to clip the buffered Vilnius development box
(`25.10,54.55,25.50,54.85`) into `data/generated/vilnius.osm.pbf`. It then imports the curated local
basemap into the PostGIS `osm` schema. Use `scripts/map-data.ps1 -Update` for an explicit refresh.
All PBF and generated files remain ignored.

OpenStreetMap data is © OpenStreetMap contributors and available under the ODbL.
