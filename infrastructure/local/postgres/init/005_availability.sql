CREATE UNIQUE INDEX IF NOT EXISTS provider_locations_provider_id_id_uq
    ON app.provider_locations (provider_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS provider_services_provider_id_id_uq
    ON app.provider_services (provider_id, id);

CREATE TABLE IF NOT EXISTS app.bookable_offerings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider_id bigint NOT NULL REFERENCES app.providers(id),
    provider_location_id bigint NOT NULL,
    provider_service_id bigint NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
    slot_interval_minutes integer NOT NULL CHECK (slot_interval_minutes BETWEEN 5 AND 1440),
    capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
    timezone text NOT NULL DEFAULT 'Europe/Vilnius' CHECK (btrim(timezone) <> ''),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_demo boolean NOT NULL DEFAULT true,
    data_source text NOT NULL DEFAULT 'development_fixture' CHECK (btrim(data_source) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (provider_id, provider_location_id)
        REFERENCES app.provider_locations(provider_id, id),
    FOREIGN KEY (provider_id, provider_service_id)
        REFERENCES app.provider_services(provider_id, id),
    UNIQUE (provider_location_id, provider_service_id)
);

CREATE TABLE IF NOT EXISTS app.availability_rules (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bookable_offering_id bigint NOT NULL REFERENCES app.bookable_offerings(id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_local_time time NOT NULL,
    end_local_time time NOT NULL,
    valid_from date,
    valid_until date,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (start_local_time < end_local_time),
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until),
    UNIQUE (bookable_offering_id, day_of_week, start_local_time, end_local_time)
);

CREATE TABLE IF NOT EXISTS app.availability_exceptions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bookable_offering_id bigint NOT NULL REFERENCES app.bookable_offerings(id) ON DELETE CASCADE,
    local_date date NOT NULL,
    kind text NOT NULL CHECK (kind IN ('closed', 'override')),
    note text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (bookable_offering_id, local_date)
);

CREATE TABLE IF NOT EXISTS app.availability_exception_windows (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    availability_exception_id bigint NOT NULL
        REFERENCES app.availability_exceptions(id) ON DELETE CASCADE,
    start_local_time time NOT NULL,
    end_local_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (start_local_time < end_local_time),
    UNIQUE (availability_exception_id, start_local_time, end_local_time)
);

CREATE INDEX IF NOT EXISTS bookable_offerings_provider_idx
    ON app.bookable_offerings (provider_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS bookable_offerings_location_idx
    ON app.bookable_offerings (provider_location_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS bookable_offerings_service_idx
    ON app.bookable_offerings (provider_service_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS availability_rules_offering_day_idx
    ON app.availability_rules (bookable_offering_id, day_of_week) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS availability_exceptions_offering_date_idx
    ON app.availability_exceptions (bookable_offering_id, local_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS availability_exception_windows_exception_idx
    ON app.availability_exception_windows (availability_exception_id);
