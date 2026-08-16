CREATE SCHEMA IF NOT EXISTS app;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION app.normalize_search_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT lower(
        btrim(
            regexp_replace(
                regexp_replace(coalesce(input, ''), '[[:punct:]„“”’]+', ' ', 'g'),
                '\s+', ' ', 'g'
            )
        )
    );
$$;

CREATE TABLE IF NOT EXISTS app.place_sources (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    display_name text NOT NULL,
    attribution text NOT NULL,
    license_name text NOT NULL,
    license_url text NOT NULL,
    source_url text NOT NULL,
    last_imported_at timestamptz
);

INSERT INTO app.place_sources (
    code, display_name, attribution, license_name, license_url, source_url
)
VALUES (
    'openstreetmap',
    'OpenStreetMap',
    '© OpenStreetMap contributors',
    'Open Database License 1.0',
    'https://opendatacommons.org/licenses/odbl/1-0/',
    'https://www.openstreetmap.org/'
)
ON CONFLICT (code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    attribution = EXCLUDED.attribution,
    license_name = EXCLUDED.license_name,
    license_url = EXCLUDED.license_url,
    source_url = EXCLUDED.source_url;

CREATE TABLE IF NOT EXISTS app.places (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id smallint NOT NULL REFERENCES app.place_sources(id),
    external_id text NOT NULL,
    source_updated_at timestamptz NOT NULL,
    name text NOT NULL CHECK (btrim(name) <> ''),
    normalized_name text NOT NULL CHECK (btrim(normalized_name) <> ''),
    category text NOT NULL CHECK (category IN (
        'food_drink', 'shopping', 'health', 'automotive', 'beauty',
        'fitness', 'finance', 'accommodation', 'services', 'other'
    )),
    subcategory text NOT NULL,
    raw_classification jsonb NOT NULL,
    description text,
    address_line text,
    postal_code text,
    city text NOT NULL DEFAULT 'Vilnius',
    country_code text NOT NULL DEFAULT 'LT' CHECK (country_code = 'LT'),
    phone text,
    website text,
    email text,
    opening_hours_raw text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    geom geometry(Point, 4326) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_id, external_id)
);

CREATE INDEX IF NOT EXISTS places_geom_idx ON app.places USING GIST (geom);
CREATE INDEX IF NOT EXISTS places_category_idx ON app.places (category) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS places_normalized_name_idx ON app.places (normalized_name);
CREATE INDEX IF NOT EXISTS places_normalized_name_prefix_idx
    ON app.places (normalized_name text_pattern_ops) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS places_normalized_name_trgm_idx
    ON app.places USING GIN (normalized_name gin_trgm_ops) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS places_subcategory_idx
    ON app.places (subcategory) WHERE status = 'active';

UPDATE app.places
SET normalized_name = app.normalize_search_text(name)
WHERE normalized_name IS DISTINCT FROM app.normalize_search_text(name);

CREATE TABLE IF NOT EXISTS app.place_import_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id smallint NOT NULL REFERENCES app.place_sources(id),
    completed_at timestamptz NOT NULL DEFAULT now(),
    source_records integer NOT NULL,
    active_places integer NOT NULL,
    skipped_missing_name integer NOT NULL,
    skipped_invalid_geometry integer NOT NULL,
    skipped_country integer NOT NULL,
    duplicate_source_ids integer NOT NULL
);
