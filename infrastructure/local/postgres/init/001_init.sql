CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS vilnius_boundary (
    id integer PRIMARY KEY,
    name text NOT NULL,
    geom geometry(Polygon, 4326) NOT NULL
);

INSERT INTO vilnius_boundary (id, name, geom)
VALUES (
    1,
    'Vilnius development area',
    ST_MakeEnvelope(25.10, 54.55, 25.50, 54.85, 4326)
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS vilnius_boundary_geom_idx
ON vilnius_boundary USING GIST (geom);
