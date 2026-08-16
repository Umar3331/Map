[CmdletBinding()]
param([switch]$AllowSingleRun)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

$Compose = docker compose config --format json | ConvertFrom-Json
$DbName = $Compose.services.db.environment.POSTGRES_DB
$DbUser = $Compose.services.db.environment.POSTGRES_USER

$Sql = @'
SELECT 'providers_table=' || (to_regclass('app.providers') IS NOT NULL)::int;
SELECT 'locations_table=' || (to_regclass('app.provider_locations') IS NOT NULL)::int;
SELECT 'service_types_table=' || (to_regclass('app.service_types') IS NOT NULL)::int;
SELECT 'services_table=' || (to_regclass('app.provider_services') IS NOT NULL)::int;
SELECT 'sources_table=' || (to_regclass('app.provider_sources') IS NOT NULL)::int;
SELECT 'runs_table=' || (to_regclass('app.provider_import_runs') IS NOT NULL)::int;
SELECT 'place_index=' || (to_regclass('app.provider_locations_place_idx') IS NOT NULL)::int;
SELECT 'provider_service_index=' || (to_regclass('app.provider_services_provider_idx') IS NOT NULL)::int;
SELECT 'primary_location_index=' || (to_regclass('app.provider_locations_one_primary_idx') IS NOT NULL)::int;
SELECT 'foreign_keys=' || (count(*) >= 8)::int FROM pg_constraint
WHERE contype='f' AND conrelid IN (
  'app.provider_locations'::regclass,
  'app.provider_services'::regclass,
  'app.provider_sources'::regclass,
  'app.provider_import_runs'::regclass
);
SELECT 'uniqueness_constraints=' || (count(*) >= 4)::int FROM pg_constraint
WHERE contype='u' AND conrelid IN (
  'app.provider_locations'::regclass,
  'app.provider_services'::regclass,
  'app.provider_sources'::regclass
);
SELECT 'providers=' || count(*) FROM app.providers WHERE status='active';
SELECT 'locations=' || count(*) FROM app.provider_locations WHERE status='active';
SELECT 'service_types=' || count(*) FROM app.service_types WHERE status='active';
SELECT 'services=' || count(*) FROM app.provider_services WHERE status='active';
SELECT 'invalid_names=' || count(*) FROM app.providers WHERE status='active' AND btrim(display_name)='';
SELECT 'duplicate_locations=' || count(*) FROM (
  SELECT provider_id,place_id FROM app.provider_locations WHERE status='active'
  GROUP BY provider_id,place_id HAVING count(*)>1
) duplicates;
SELECT 'duplicate_services=' || count(*) FROM (
  SELECT provider_id,service_type_id FROM app.provider_services WHERE status='active'
  GROUP BY provider_id,service_type_id HAVING count(*)>1
) duplicates;
SELECT 'duplicate_sources=' || count(*) FROM (
  SELECT source_id,external_id FROM app.provider_sources
  GROUP BY source_id,external_id HAVING count(*)>1
) duplicates;
SELECT 'orphan_locations=' || count(*) FROM app.provider_locations location
LEFT JOIN app.providers provider ON provider.id=location.provider_id
LEFT JOIN app.places place ON place.id=location.place_id
WHERE provider.id IS NULL OR place.id IS NULL;
SELECT 'orphan_services=' || count(*) FROM app.provider_services offering
LEFT JOIN app.providers provider ON provider.id=offering.provider_id
LEFT JOIN app.service_types service_type ON service_type.id=offering.service_type_id
WHERE provider.id IS NULL OR service_type.id IS NULL;
SELECT 'missing_provenance=' || count(*) FROM app.providers provider
WHERE provider.status='active' AND NOT EXISTS (
  SELECT 1 FROM app.provider_sources source
  JOIN app.place_sources place_source ON place_source.id=source.source_id
  WHERE source.provider_id=provider.id AND btrim(source.external_id)<>''
    AND btrim(place_source.attribution)<>'' AND btrim(place_source.license_name)<>''
);
SELECT 'inactive_links=' || count(*) FROM app.provider_locations location
JOIN app.places place ON place.id=location.place_id
JOIN app.providers provider ON provider.id=location.provider_id
WHERE location.status='active' AND (place.status<>'active' OR provider.status<>'active');
SELECT 'inactive_services=' || count(*) FROM app.provider_services offering
JOIN app.providers provider ON provider.id=offering.provider_id
JOIN app.service_types service_type ON service_type.id=offering.service_type_id
WHERE offering.status='active' AND (provider.status<>'active' OR service_type.status<>'active');
SELECT 'invalid_service_types=' || count(*) FROM app.service_types WHERE status='active' AND (
  btrim(code)='' OR btrim(name)='' OR category NOT IN (
    'beauty','automotive','fitness','health','professional','local_services'
  )
);
SELECT 'fabricated_commercial_data=' || count(*) FROM app.provider_services
WHERE price_amount IS NOT NULL OR price_currency IS NOT NULL OR duration_minutes IS NOT NULL;
SELECT 'run_count=' || count(*) FROM app.provider_import_runs;
SELECT 'stable_runs=' || CASE WHEN count(*) < 2 THEN 0
  WHEN min(active_providers)=max(active_providers)
   AND min(active_locations)=max(active_locations)
   AND min(active_services)=max(active_services) THEN 1 ELSE 0 END
FROM (SELECT active_providers,active_locations,active_services
      FROM app.provider_import_runs ORDER BY id DESC LIMIT 2) recent;
'@
$Output = docker compose exec -T db psql -At -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c $Sql
if ($LASTEXITCODE -ne 0) { throw 'Provider database validation query failed.' }
$Values = @{}
foreach ($Line in $Output) {
    $Parts = $Line -split '='
    $Values[$Parts[0]] = [int64]$Parts[1]
}
foreach ($Required in @(
    'providers_table', 'locations_table', 'service_types_table', 'services_table',
    'sources_table', 'runs_table', 'place_index', 'provider_service_index', 'primary_location_index',
    'foreign_keys', 'uniqueness_constraints'
)) {
    if ($Values[$Required] -ne 1) { throw "Provider validation failed: $Required" }
}
foreach ($Count in @('providers', 'locations', 'service_types', 'services')) {
    if ($Values[$Count] -le 0) { throw "Provider validation failed: no $Count." }
}
foreach ($Invalid in @(
    'invalid_names', 'duplicate_locations', 'duplicate_services', 'duplicate_sources',
    'orphan_locations', 'orphan_services', 'missing_provenance', 'inactive_links',
    'inactive_services', 'invalid_service_types', 'fabricated_commercial_data'
)) {
    if ($Values[$Invalid] -ne 0) { throw "Provider validation failed: $Invalid=$($Values[$Invalid])" }
}
if (-not $AllowSingleRun -and $Values.stable_runs -ne 1) {
    throw 'Provider validation failed: latest two imports are not idempotent.'
}

Write-Host "Provider validation passed ($($Values.providers) providers, $($Values.locations) locations, $($Values.services) services, $($Values.service_types) service types)." -ForegroundColor Green
