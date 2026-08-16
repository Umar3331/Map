CREATE SCHEMA IF NOT EXISTS osm;

CREATE OR REPLACE FUNCTION osm.transportation_tiles(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql
STABLE
STRICT
PARALLEL SAFE
AS $function$
DECLARE
    mvt bytea;
BEGIN
    WITH bounds AS (
        SELECT ST_TileEnvelope(z, x, y) AS geom
    ),
    features AS (
        SELECT
            roads.class,
            roads.name,
            ST_AsMVTGeom(
                CASE
                    WHEN z <= 9 THEN ST_Simplify(roads.geom, 40)
                    WHEN z <= 11 THEN ST_Simplify(roads.geom, 15)
                    WHEN z = 12 THEN ST_Simplify(roads.geom, 5)
                    WHEN z = 13 THEN ST_Simplify(roads.geom, 2)
                    ELSE roads.geom
                END,
                bounds.geom,
                4096,
                64,
                true
            ) AS geom
        FROM osm.transportation AS roads
        CROSS JOIN bounds
        WHERE roads.geom && ST_Expand(
            bounds.geom,
            (ST_XMax(bounds.geom) - ST_XMin(bounds.geom)) * 64 / 4096
        )
          AND (
              z >= 14
              OR (z = 13 AND roads.class = ANY (ARRAY[
                  'motorway', 'motorway_link', 'trunk', 'trunk_link',
                  'primary', 'primary_link', 'secondary', 'secondary_link',
                  'tertiary', 'tertiary_link', 'unclassified', 'residential',
                  'living_street', 'pedestrian'
              ]))
              OR (z = 12 AND roads.class = ANY (ARRAY[
                  'motorway', 'motorway_link', 'trunk', 'trunk_link',
                  'primary', 'primary_link', 'secondary', 'secondary_link',
                  'tertiary', 'tertiary_link'
              ]))
              OR (z BETWEEN 10 AND 11 AND roads.class = ANY (ARRAY[
                  'motorway', 'motorway_link', 'trunk', 'trunk_link',
                  'primary', 'primary_link', 'secondary', 'secondary_link'
              ]))
              OR (z <= 9 AND roads.class = ANY (ARRAY[
                  'motorway', 'motorway_link', 'trunk', 'trunk_link',
                  'primary', 'primary_link'
              ]))
          )
    )
    SELECT ST_AsMVT(features, 'transportation', 4096, 'geom')
    INTO mvt
    FROM features
    WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom);

    RETURN mvt;
END
$function$;

COMMENT ON FUNCTION osm.transportation_tiles(integer, integer, integer) IS
'Zoom-aware Vilnius road tiles: major roads at low zoom, progressively restoring street detail through z14.';
