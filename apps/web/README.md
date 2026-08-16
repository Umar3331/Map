# Map web client

The active Milestone 1 client is a React, TypeScript, Vite, MapLibre GL JS PWA. It loads configuration
from `/api` and renders the fully self-hosted Vilnius OSM vector basemap from `/tiles`. The Docker
gateway keeps the API, tiles, production worker, and PWA on the same origin.

Run checks with `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:build`. With the production stack running, `npm run test:e2e` exercises the rendered
map in Chromium. The repository PowerShell scripts are the normal full-stack workflow.
