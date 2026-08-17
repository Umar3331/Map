\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE provider_candidates AS
SELECT
    place.id AS place_id,
    place.source_id,
    place.external_id,
    place.name AS display_name,
    place.normalized_name,
    place.description,
    place.phone,
    place.email,
    place.website,
    CASE
        WHEN place.subcategory = 'hairdresser' THEN ARRAY['haircut', 'hair_styling']
        WHEN place.subcategory = 'beauty' THEN ARRAY['beauty_treatment']
        WHEN place.subcategory = 'massage' THEN ARRAY['massage']
        WHEN place.subcategory IN ('car_repair', 'motorcycle_repair', 'truck_repair')
            THEN ARRAY['vehicle_repair']
        WHEN place.subcategory = 'tyres' THEN ARRAY['tyre_service']
        WHEN place.subcategory = 'car_wash' THEN ARRAY['car_wash']
        WHEN place.subcategory = 'fitness_centre' THEN ARRAY['gym_membership', 'group_fitness']
        WHEN place.subcategory = 'sports_centre' THEN ARRAY['sports_facility_access']
        WHEN place.subcategory = 'dentist' THEN ARRAY['dental_checkup', 'teeth_cleaning']
        WHEN place.subcategory IN ('clinic', 'doctors') THEN ARRAY['medical_consultation']
        WHEN place.subcategory = 'psychotherapist' THEN ARRAY['psychotherapy']
        WHEN place.subcategory = 'rehabilitation' THEN ARRAY['rehabilitation']
        WHEN place.subcategory = 'optometrist' THEN ARRAY['eye_exam']
        WHEN place.subcategory = 'veterinary' THEN ARRAY['veterinary_consultation']
        WHEN place.subcategory = 'accountant' THEN ARRAY['accounting']
        WHEN place.subcategory = 'lawyer' THEN ARRAY['legal_consultation']
        WHEN place.subcategory = 'insurance' THEN ARRAY['insurance_consultation']
        WHEN place.subcategory = 'estate_agent' THEN ARRAY['property_services']
        WHEN place.subcategory = 'photographer' THEN ARRAY['photography']
        WHEN place.subcategory = 'plumber' THEN ARRAY['plumbing']
        WHEN place.subcategory = 'tailor' THEN ARRAY['alterations']
        WHEN place.subcategory IN ('shoemaker', 'shoe_repair') THEN ARRAY['shoe_repair']
        WHEN place.subcategory IN ('laundry', 'dry_cleaning') THEN ARRAY['laundry_service']
        WHEN place.subcategory = 'pet_grooming' THEN ARRAY['pet_grooming']
    END::text[] AS service_codes
FROM app.places AS place
WHERE place.status = 'active'
  AND place.subcategory IN (
      'hairdresser', 'beauty', 'massage',
      'car_repair', 'motorcycle_repair', 'truck_repair', 'tyres', 'car_wash',
      'fitness_centre', 'sports_centre',
      'dentist', 'clinic', 'doctors', 'psychotherapist', 'rehabilitation', 'optometrist',
      'veterinary', 'accountant', 'lawyer', 'insurance', 'estate_agent', 'photographer',
      'plumber', 'tailor', 'shoemaker', 'shoe_repair', 'laundry', 'dry_cleaning', 'pet_grooming'
  );

CREATE TEMP TABLE provider_import_metrics AS
SELECT count(*)::integer AS existing_source_identities
FROM provider_candidates AS candidate
JOIN app.provider_sources AS source
  ON source.source_id = candidate.source_id AND source.external_id = candidate.external_id;

DO $$
DECLARE
    candidate record;
    new_provider_id bigint;
BEGIN
    FOR candidate IN
        SELECT item.*
        FROM provider_candidates AS item
        LEFT JOIN app.provider_sources AS source
          ON source.source_id = item.source_id AND source.external_id = item.external_id
        WHERE source.id IS NULL
        ORDER BY item.source_id, item.external_id
    LOOP
        INSERT INTO app.providers (
            display_name, normalized_name, description, phone, email, website, status
        ) VALUES (
            candidate.display_name,
            candidate.normalized_name,
            candidate.description,
            candidate.phone,
            candidate.email,
            candidate.website,
            'active'
        ) RETURNING id INTO new_provider_id;

        INSERT INTO app.provider_sources (
            provider_id, source_id, external_id, source_place_id, imported_at
        ) VALUES (
            new_provider_id,
            candidate.source_id,
            candidate.external_id,
            candidate.place_id,
            now()
        );
    END LOOP;
END $$;

UPDATE app.providers AS provider
SET
    display_name = candidate.display_name,
    normalized_name = candidate.normalized_name,
    description = candidate.description,
    phone = candidate.phone,
    email = candidate.email,
    website = candidate.website,
    status = 'active',
    updated_at = now()
FROM provider_candidates AS candidate
JOIN app.provider_sources AS source
  ON source.source_id = candidate.source_id AND source.external_id = candidate.external_id
WHERE provider.id = source.provider_id;

UPDATE app.provider_sources AS source
SET source_place_id = candidate.place_id, imported_at = now()
FROM provider_candidates AS candidate
WHERE source.source_id = candidate.source_id
  AND source.external_id = candidate.external_id;

INSERT INTO app.provider_locations (provider_id, place_id, is_primary, status)
SELECT source.provider_id, candidate.place_id, true, 'active'
FROM provider_candidates AS candidate
JOIN app.provider_sources AS source
  ON source.source_id = candidate.source_id AND source.external_id = candidate.external_id
ON CONFLICT (provider_id, place_id) DO UPDATE SET
    is_primary = true,
    status = 'active',
    updated_at = now();

UPDATE app.provider_locations AS location
SET status = 'inactive', updated_at = now()
WHERE location.status = 'active'
  AND EXISTS (
      SELECT 1 FROM app.provider_sources AS source
      WHERE source.provider_id = location.provider_id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM provider_candidates AS candidate
      JOIN app.provider_sources AS source
        ON source.source_id = candidate.source_id AND source.external_id = candidate.external_id
      WHERE source.provider_id = location.provider_id AND candidate.place_id = location.place_id
  );

INSERT INTO app.provider_services (provider_id, service_type_id, status)
SELECT source.provider_id, service_type.id, 'active'
FROM provider_candidates AS candidate
JOIN app.provider_sources AS source
  ON source.source_id = candidate.source_id AND source.external_id = candidate.external_id
CROSS JOIN LATERAL unnest(candidate.service_codes) AS mapped(code)
JOIN app.service_types AS service_type ON service_type.code = mapped.code
ON CONFLICT (provider_id, service_type_id) DO UPDATE SET
    status = 'active',
    updated_at = now();

UPDATE app.provider_services AS offering
SET status = 'inactive', updated_at = now()
WHERE offering.status = 'active'
  AND EXISTS (
      SELECT 1 FROM app.provider_sources AS source
      WHERE source.provider_id = offering.provider_id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM provider_candidates AS candidate
      JOIN app.provider_sources AS source
        ON source.source_id = candidate.source_id AND source.external_id = candidate.external_id
      CROSS JOIN LATERAL unnest(candidate.service_codes) AS mapped(code)
      JOIN app.service_types AS service_type ON service_type.code = mapped.code
      WHERE source.provider_id = offering.provider_id
        AND service_type.id = offering.service_type_id
  );

UPDATE app.providers AS provider
SET status = CASE WHEN EXISTS (
    SELECT 1 FROM app.provider_locations AS location
    WHERE location.provider_id = provider.id AND location.status = 'active'
) THEN 'active' ELSE 'inactive' END,
updated_at = now()
WHERE EXISTS (
    SELECT 1 FROM app.provider_sources AS source WHERE source.provider_id = provider.id
);

INSERT INTO app.provider_import_runs (
    source_id,
    candidate_places,
    active_providers,
    active_locations,
    active_services,
    skipped_places,
    duplicates_prevented
)
SELECT
    source.id,
    (SELECT count(*) FROM provider_candidates),
    (SELECT count(*) FROM app.providers WHERE status = 'active'),
    (SELECT count(*) FROM app.provider_locations WHERE status = 'active'),
    (SELECT count(*) FROM app.provider_services WHERE status = 'active'),
    (SELECT count(*) FROM app.places WHERE status = 'active')
      - (SELECT count(*) FROM provider_candidates),
    (SELECT existing_source_identities FROM provider_import_metrics)
FROM app.place_sources AS source
WHERE source.code = 'openstreetmap';

COMMIT;
