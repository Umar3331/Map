\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE demo_offering_candidates AS
WITH ranked AS (
    SELECT
        provider.id AS provider_id,
        location.id AS provider_location_id,
        provider_service.id AS provider_service_id,
        service_type.code,
        row_number() OVER (
            PARTITION BY service_type.code
            ORDER BY provider.normalized_name, provider.id, location.id
        ) AS candidate_rank
    FROM app.providers AS provider
    JOIN app.provider_locations AS location
      ON location.provider_id = provider.id AND location.status = 'active'
    JOIN app.places AS place ON place.id = location.place_id AND place.status = 'active'
    JOIN app.provider_services AS provider_service
      ON provider_service.provider_id = provider.id AND provider_service.status = 'active'
    JOIN app.service_types AS service_type
      ON service_type.id = provider_service.service_type_id AND service_type.status = 'active'
    WHERE provider.status = 'active'
      AND service_type.code IN (
          'vehicle_repair', 'haircut', 'dental_checkup', 'massage', 'group_fitness'
      )
)
SELECT
    provider_id,
    provider_location_id,
    provider_service_id,
    code,
    CASE code
        WHEN 'vehicle_repair' THEN 60
        WHEN 'haircut' THEN 45
        WHEN 'dental_checkup' THEN 30
        WHEN 'massage' THEN 60
        WHEN 'group_fitness' THEN 60
    END AS duration_minutes,
    CASE code
        WHEN 'haircut' THEN 15
        WHEN 'group_fitness' THEN 60
        ELSE 30
    END AS slot_interval_minutes,
    CASE code WHEN 'group_fitness' THEN 12 ELSE 1 END AS capacity
FROM ranked
WHERE candidate_rank = 1;

DO $$
BEGIN
    IF (SELECT count(*) FROM demo_offering_candidates) <> 5 THEN
        RAISE EXCEPTION 'Expected five deterministic demo offering candidates';
    END IF;
END $$;

INSERT INTO app.bookable_offerings (
    provider_id,
    provider_location_id,
    provider_service_id,
    duration_minutes,
    slot_interval_minutes,
    capacity,
    timezone,
    status,
    is_demo,
    data_source
)
SELECT
    provider_id,
    provider_location_id,
    provider_service_id,
    duration_minutes,
    slot_interval_minutes,
    capacity,
    'Europe/Vilnius',
    'active',
    true,
    'development_fixture'
FROM demo_offering_candidates
ON CONFLICT (provider_location_id, provider_service_id) DO UPDATE SET
    duration_minutes = EXCLUDED.duration_minutes,
    slot_interval_minutes = EXCLUDED.slot_interval_minutes,
    capacity = EXCLUDED.capacity,
    timezone = EXCLUDED.timezone,
    status = 'active',
    is_demo = true,
    data_source = 'development_fixture',
    updated_at = now();

UPDATE app.bookable_offerings AS offering
SET status = 'inactive', updated_at = now()
WHERE offering.data_source = 'development_fixture'
  AND NOT EXISTS (
      SELECT 1
      FROM demo_offering_candidates AS candidate
      WHERE candidate.provider_location_id = offering.provider_location_id
        AND candidate.provider_service_id = offering.provider_service_id
  );

CREATE TEMP TABLE demo_rules (
    service_code text,
    day_of_week smallint,
    start_local_time time,
    end_local_time time
);

INSERT INTO demo_rules VALUES
    ('vehicle_repair', 1, '09:00', '12:00'), ('vehicle_repair', 1, '13:00', '17:00'),
    ('vehicle_repair', 2, '09:00', '12:00'), ('vehicle_repair', 2, '13:00', '17:00'),
    ('vehicle_repair', 3, '09:00', '12:00'), ('vehicle_repair', 3, '13:00', '17:00'),
    ('vehicle_repair', 4, '09:00', '12:00'), ('vehicle_repair', 4, '13:00', '17:00'),
    ('vehicle_repair', 5, '09:00', '12:00'), ('vehicle_repair', 5, '13:00', '17:00'),
    ('vehicle_repair', 6, '10:00', '14:00'),
    ('haircut', 2, '10:00', '18:00'), ('haircut', 3, '10:00', '18:00'),
    ('haircut', 4, '10:00', '18:00'), ('haircut', 5, '10:00', '18:00'),
    ('haircut', 6, '10:00', '15:00'),
    ('dental_checkup', 1, '08:00', '16:00'), ('dental_checkup', 2, '08:00', '16:00'),
    ('dental_checkup', 3, '08:00', '16:00'), ('dental_checkup', 4, '08:00', '16:00'),
    ('dental_checkup', 5, '08:00', '14:00'),
    ('massage', 3, '11:00', '19:00'), ('massage', 4, '11:00', '19:00'),
    ('massage', 5, '11:00', '19:00'), ('massage', 6, '10:00', '16:00'),
    ('massage', 7, '10:00', '16:00'),
    ('group_fitness', 1, '07:00', '10:00'), ('group_fitness', 1, '17:00', '20:00'),
    ('group_fitness', 3, '07:00', '10:00'), ('group_fitness', 3, '17:00', '20:00'),
    ('group_fitness', 5, '07:00', '10:00'), ('group_fitness', 5, '17:00', '20:00'),
    ('group_fitness', 6, '09:00', '12:00');

INSERT INTO app.availability_rules (
    bookable_offering_id, day_of_week, start_local_time, end_local_time, status
)
SELECT offering.id, rule.day_of_week, rule.start_local_time, rule.end_local_time, 'active'
FROM demo_rules AS rule
JOIN demo_offering_candidates AS candidate ON candidate.code = rule.service_code
JOIN app.bookable_offerings AS offering
  ON offering.provider_location_id = candidate.provider_location_id
 AND offering.provider_service_id = candidate.provider_service_id
ON CONFLICT (bookable_offering_id, day_of_week, start_local_time, end_local_time)
DO UPDATE SET status = 'active', updated_at = now();

UPDATE app.availability_rules AS rule
SET status = 'inactive', updated_at = now()
WHERE EXISTS (
    SELECT 1 FROM app.bookable_offerings AS offering
    WHERE offering.id = rule.bookable_offering_id
      AND offering.data_source = 'development_fixture'
)
AND NOT EXISTS (
    SELECT 1
    FROM demo_rules AS expected
    JOIN demo_offering_candidates AS candidate ON candidate.code = expected.service_code
    JOIN app.bookable_offerings AS offering
      ON offering.provider_location_id = candidate.provider_location_id
     AND offering.provider_service_id = candidate.provider_service_id
    WHERE offering.id = rule.bookable_offering_id
      AND expected.day_of_week = rule.day_of_week
      AND expected.start_local_time = rule.start_local_time
      AND expected.end_local_time = rule.end_local_time
);

CREATE TEMP TABLE demo_exceptions (
    service_code text,
    local_date date,
    kind text,
    note text
);

INSERT INTO demo_exceptions VALUES
    ('vehicle_repair', '2026-08-24', 'closed', 'Development fixture: full-day closure'),
    ('vehicle_repair', '2026-08-25', 'override', 'Development fixture: shortened day'),
    ('haircut', '2026-08-22', 'closed', 'Development fixture: full-day closure'),
    ('dental_checkup', '2026-08-21', 'override', 'Development fixture: shortened day');

INSERT INTO app.availability_exceptions (
    bookable_offering_id, local_date, kind, note, status
)
SELECT offering.id, exception.local_date, exception.kind, exception.note, 'active'
FROM demo_exceptions AS exception
JOIN demo_offering_candidates AS candidate ON candidate.code = exception.service_code
JOIN app.bookable_offerings AS offering
  ON offering.provider_location_id = candidate.provider_location_id
 AND offering.provider_service_id = candidate.provider_service_id
ON CONFLICT (bookable_offering_id, local_date) DO UPDATE SET
    kind = EXCLUDED.kind,
    note = EXCLUDED.note,
    status = 'active',
    updated_at = now();

UPDATE app.availability_exceptions AS exception
SET status = 'inactive', updated_at = now()
WHERE EXISTS (
    SELECT 1 FROM app.bookable_offerings AS offering
    WHERE offering.id = exception.bookable_offering_id
      AND offering.data_source = 'development_fixture'
)
AND NOT EXISTS (
    SELECT 1
    FROM demo_exceptions AS expected
    JOIN demo_offering_candidates AS candidate ON candidate.code = expected.service_code
    JOIN app.bookable_offerings AS offering
      ON offering.provider_location_id = candidate.provider_location_id
     AND offering.provider_service_id = candidate.provider_service_id
    WHERE offering.id = exception.bookable_offering_id
      AND expected.local_date = exception.local_date
);

CREATE TEMP TABLE demo_exception_windows (
    service_code text,
    local_date date,
    start_local_time time,
    end_local_time time
);

INSERT INTO demo_exception_windows VALUES
    ('vehicle_repair', '2026-08-25', '10:00', '14:00'),
    ('dental_checkup', '2026-08-21', '09:00', '12:00');

DELETE FROM app.availability_exception_windows AS override_window
USING app.availability_exceptions AS exception, app.bookable_offerings AS offering
WHERE override_window.availability_exception_id = exception.id
  AND exception.bookable_offering_id = offering.id
  AND offering.data_source = 'development_fixture';

INSERT INTO app.availability_exception_windows (
    availability_exception_id, start_local_time, end_local_time
)
SELECT exception.id, expected.start_local_time, expected.end_local_time
FROM demo_exception_windows AS expected
JOIN demo_offering_candidates AS candidate ON candidate.code = expected.service_code
JOIN app.bookable_offerings AS offering
  ON offering.provider_location_id = candidate.provider_location_id
 AND offering.provider_service_id = candidate.provider_service_id
JOIN app.availability_exceptions AS exception
  ON exception.bookable_offering_id = offering.id
 AND exception.local_date = expected.local_date;

COMMIT;
