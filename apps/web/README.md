# Map web client

The active Milestone 1 client is a React, TypeScript, Vite, MapLibre GL JS PWA. It loads configuration
from `/api`, local vector overlays from `/tiles`, and currently uses OpenStreetMap raster tiles as a
temporary development basemap. The Docker gateway keeps API and local tiles on the same origin.

Run checks with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The repository
PowerShell scripts are the normal full-stack workflow.
