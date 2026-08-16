\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE place_candidates AS
SELECT
    'n' || node_id::text AS external_id,
    name,
    category,
    subcategory,
    raw_key,
    raw_value,
    description,
    address_line,
    postal_code,
    city,
    country_code,
    phone,
    website,
    email,
    opening_hours_raw,
    geom
FROM app_import.place_nodes
UNION ALL
SELECT
    CASE WHEN area_id < 0 THEN 'r' || abs(area_id)::text ELSE 'w' || area_id::text END,
    name,
    category,
    subcategory,
    raw_key,
    raw_value,
    description,
    address_line,
    postal_code,
    city,
    country_code,
    phone,
    website,
    email,
    opening_hours_raw,
    ST_PointOnSurface(geom)::geometry(Point, 4326)
FROM app_import.place_areas;

CREATE TEMP TABLE valid_places AS
SELECT DISTINCT ON (external_id)
    external_id,
    btrim(name) AS name,
    app.normalize_search_text(name) AS normalized_name,
    category,
    subcategory,
    jsonb_build_object('key', raw_key, 'value', raw_value) AS raw_classification,
    nullif(btrim(description), '') AS description,
    nullif(btrim(address_line), '') AS address_line,
    nullif(btrim(postal_code), '') AS postal_code,
    coalesce(nullif(btrim(city), ''), 'Vilnius') AS city,
    'LT'::text AS country_code,
    nullif(btrim(phone), '') AS phone,
    nullif(btrim(website), '') AS website,
    nullif(btrim(email), '') AS email,
    nullif(btrim(opening_hours_raw), '') AS opening_hours_raw,
    geom
FROM place_candidates
WHERE nullif(btrim(name), '') IS NOT NULL
  AND geom IS NOT NULL
  AND ST_IsValid(geom)
  AND ST_Covers(ST_MakeEnvelope(25.10, 54.55, 25.50, 54.85, 4326), geom)
  AND coalesce(nullif(upper(btrim(country_code)), ''), 'LT') = 'LT'
ORDER BY external_id;

WITH source AS (
    SELECT id FROM app.place_sources WHERE code = 'openstreetmap'
)
INSERT INTO app.places (
    source_id, external_id, source_updated_at, name, normalized_name,
    category, subcategory, raw_classification, description, address_line,
    postal_code, city, country_code, phone, website, email, opening_hours_raw,
    status, geom
)
SELECT
    source.id,
    candidate.external_id,
    now(),
    candidate.name,
    candidate.normalized_name,
    candidate.category,
    candidate.subcategory,
    candidate.raw_classification,
    candidate.description,
    candidate.address_line,
    candidate.postal_code,
    candidate.city,
    candidate.country_code,
    candidate.phone,
    candidate.website,
    candidate.email,
    candidate.opening_hours_raw,
    'active',
    candidate.geom
FROM valid_places AS candidate
CROSS JOIN source
ON CONFLICT (source_id, external_id) DO UPDATE SET
    source_updated_at = EXCLUDED.source_updated_at,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    raw_classification = EXCLUDED.raw_classification,
    description = EXCLUDED.description,
    address_line = EXCLUDED.address_line,
    postal_code = EXCLUDED.postal_code,
    city = EXCLUDED.city,
    country_code = EXCLUDED.country_code,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website,
    email = EXCLUDED.email,
    opening_hours_raw = EXCLUDED.opening_hours_raw,
    status = 'active',
    geom = EXCLUDED.geom,
    updated_at = now();

WITH source AS (
    SELECT id FROM app.place_sources WHERE code = 'openstreetmap'
)
UPDATE app.places AS place
SET status = 'inactive', updated_at = now()
FROM source
WHERE place.source_id = source.id
  AND place.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM valid_places AS candidate
      WHERE candidate.external_id = place.external_id
  );

UPDATE app.place_sources SET last_imported_at = now() WHERE code = 'openstreetmap';

INSERT INTO app.place_import_runs (
    source_id,
    source_records,
    active_places,
    skipped_missing_name,
    skipped_invalid_geometry,
    skipped_country,
    duplicate_source_ids
)
SELECT
    source.id,
    (SELECT count(*) FROM place_candidates),
    (SELECT count(*) FROM valid_places),
    (SELECT count(*) FROM place_candidates WHERE nullif(btrim(name), '') IS NULL),
    (SELECT count(*) FROM place_candidates WHERE geom IS NULL OR NOT ST_IsValid(geom)
        OR NOT ST_Covers(ST_MakeEnvelope(25.10, 54.55, 25.50, 54.85, 4326), geom)),
    (SELECT count(*) FROM place_candidates
        WHERE coalesce(nullif(upper(btrim(country_code)), ''), 'LT') <> 'LT'),
    (SELECT count(*) - count(DISTINCT external_id) FROM place_candidates)
FROM app.place_sources AS source
WHERE source.code = 'openstreetmap';

COMMIT;
