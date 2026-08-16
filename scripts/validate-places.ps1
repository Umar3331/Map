[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

$Compose = docker compose config --format json | ConvertFrom-Json
$DbName = $Compose.services.db.environment.POSTGRES_DB
$DbUser = $Compose.services.db.environment.POSTGRES_USER

$Sql = @'
SELECT 'schema=' || (to_regnamespace('app') IS NOT NULL)::int;
SELECT 'places=' || (to_regclass('app.places') IS NOT NULL)::int;
SELECT 'sources=' || (to_regclass('app.place_sources') IS NOT NULL)::int;
SELECT 'geom_index=' || (to_regclass('app.places_geom_idx') IS NOT NULL)::int;
SELECT 'category_index=' || (to_regclass('app.places_category_idx') IS NOT NULL)::int;
SELECT 'active=' || count(*) FROM app.places WHERE status='active';
SELECT 'duplicates=' || count(*) FROM (
  SELECT source_id,external_id FROM app.places GROUP BY source_id,external_id HAVING count(*)>1
) duplicates;
SELECT 'invalid=' || count(*) FROM app.places WHERE status='active' AND (
  btrim(name)='' OR country_code<>'LT' OR geom IS NULL OR
  NOT ST_Covers(ST_MakeEnvelope(25.10,54.55,25.50,54.85,4326),geom)
);
SELECT 'stable_runs=' || CASE WHEN count(*) < 2 THEN 0
  WHEN min(active_places)=max(active_places) THEN 1 ELSE 0 END
FROM (SELECT active_places FROM app.place_import_runs ORDER BY id DESC LIMIT 2) recent;
'@
$Output = docker compose exec -T db psql -At -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c $Sql
if ($LASTEXITCODE -ne 0) { throw 'Place database validation query failed.' }
$Values = @{}
foreach ($Line in $Output) {
    $Parts = $Line -split '='
    $Values[$Parts[0]] = [int64]$Parts[1]
}
foreach ($Required in @('schema', 'places', 'sources', 'geom_index', 'category_index', 'stable_runs')) {
    if ($Values[$Required] -ne 1) { throw "Place validation failed: $Required" }
}
if ($Values.active -le 0) { throw 'Place validation failed: no active places.' }
if ($Values.duplicates -ne 0) { throw 'Place validation failed: duplicate source IDs.' }
if ($Values.invalid -ne 0) { throw 'Place validation failed: invalid records.' }

Write-Host "Place database validation passed ($($Values.active) active, idempotent latest imports)." -ForegroundColor Green
