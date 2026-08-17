[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

$Compose = docker compose config --format json | ConvertFrom-Json
$DbName = $Compose.services.db.environment.POSTGRES_DB
$DbUser = $Compose.services.db.environment.POSTGRES_USER

$Sql = @'
DO $$
BEGIN
    IF (SELECT count(*) FROM app.bookable_offerings WHERE status='active') <> 5 THEN
        RAISE EXCEPTION 'Expected five active demo offerings';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.bookable_offerings
        WHERE status='active' AND (
            timezone <> 'Europe/Vilnius' OR NOT is_demo OR data_source <> 'development_fixture'
            OR duration_minutes <= 0 OR slot_interval_minutes <= 0 OR capacity <= 0
        )
    ) THEN RAISE EXCEPTION 'Invalid demo offering metadata'; END IF;
    IF EXISTS (
        SELECT 1
        FROM app.bookable_offerings AS offering
        JOIN app.provider_locations AS location ON location.id=offering.provider_location_id
        JOIN app.provider_services AS service ON service.id=offering.provider_service_id
        JOIN app.providers AS provider ON provider.id=offering.provider_id
        WHERE offering.status='active' AND (
            location.provider_id <> offering.provider_id
            OR service.provider_id <> offering.provider_id
            OR location.status <> 'active' OR service.status <> 'active' OR provider.status <> 'active'
        )
    ) THEN RAISE EXCEPTION 'Offering domain references are invalid'; END IF;
    IF (SELECT count(*) FROM app.availability_rules WHERE status='active') <> 33 THEN
        RAISE EXCEPTION 'Expected 33 active weekly rules';
    END IF;
    IF (SELECT count(*) FROM app.availability_exceptions WHERE status='active') <> 4 THEN
        RAISE EXCEPTION 'Expected four active exceptions';
    END IF;
    IF (SELECT count(*) FROM app.availability_exception_windows) <> 2 THEN
        RAISE EXCEPTION 'Expected two override windows';
    END IF;
    IF EXISTS (
        SELECT 1 FROM app.availability_exceptions AS exception
        LEFT JOIN app.availability_exception_windows AS override_window
          ON override_window.availability_exception_id=exception.id
        WHERE exception.status='active'
        GROUP BY exception.id, exception.kind
        HAVING (exception.kind='closed' AND count(override_window.id) <> 0)
            OR (exception.kind='override' AND count(override_window.id) = 0)
    ) THEN RAISE EXCEPTION 'Exception windows do not match exception kinds'; END IF;
END $$;
'@

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c $Sql
if ($LASTEXITCODE -ne 0) { throw 'Availability validation failed.' }

Write-Host 'Availability database validation passed (5 demo offerings, 33 rules, 4 exceptions).' -ForegroundColor Green
