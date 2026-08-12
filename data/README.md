# Map data

Large source extracts, generated tiles, caches, and database files do not belong in Git.

`scripts/map-data.ps1 -Download` downloads the current Geofabrik Lithuania extract and uses an
`osmium-tool` container to clip the Milestone 1 development box (`25.10,54.55,25.50,54.85`) into
`data/generated/vilnius.osm.pbf`. The current stack proves local vector serving with a seeded
PostGIS development boundary. Importing filtered OSM features is the next data-pipeline task, not
an application runtime requirement.

OpenStreetMap data is © OpenStreetMap contributors and available under the ODbL.
