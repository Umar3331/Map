[CmdletBinding()]
param([switch]$Update)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required.' }
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running.' }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }

$VilniusPbf = Join-Path $RepositoryRoot 'data\generated\vilnius.osm.pbf'
if ($Update) {
    & (Join-Path $PSScriptRoot 'map-data.ps1') -Update
} elseif (-not (Test-Path -LiteralPath $VilniusPbf)) {
    & (Join-Path $PSScriptRoot 'map-data.ps1')
}
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $VilniusPbf)) {
    throw 'The buffered Vilnius PBF is unavailable.'
}

docker compose up -d db
if ($LASTEXITCODE -ne 0) { throw 'PostGIS failed to start.' }
$Compose = docker compose config --format json | ConvertFrom-Json
$DbName = $Compose.services.db.environment.POSTGRES_DB
$DbUser = $Compose.services.db.environment.POSTGRES_USER

$Ready = $false
for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
    docker compose exec -T db pg_isready -U $DbUser -d $DbName | Out-Null
    if ($LASTEXITCODE -eq 0) { $Ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $Ready) { throw 'PostGIS did not become ready.' }

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName `
    -f /docker-entrypoint-initdb.d/003_places.sql
if ($LASTEXITCODE -ne 0) { throw 'Could not install the application places schema.' }
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName `
    -c 'CREATE SCHEMA IF NOT EXISTS app_import;'
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare place import staging.' }

$BeforeCount = docker compose exec -T db psql -At -U $DbUser -d $DbName -c `
    "SELECT count(*) FROM app.places WHERE status='active';"

$Timer = [Diagnostics.Stopwatch]::StartNew()
Write-Host 'Importing curated OSM places into disposable staging tables.' -ForegroundColor Cyan
docker compose run --rm osm-import `
    --create --output=flex --style=/config/places.lua `
    --database=$DbName --username=$DbUser --host=db --port=5432 `
    --number-processes=4 /data/generated/vilnius.osm.pbf
if ($LASTEXITCODE -ne 0) { throw 'OSM place staging import failed.' }

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -f /places/upsert.sql
if ($LASTEXITCODE -ne 0) { throw 'Application place upsert failed.' }
$Timer.Stop()

$ValidationSql = @'
SELECT 'active=' || count(*) FROM app.places WHERE status='active';
SELECT 'unique=' || count(DISTINCT source_id::text || ':' || external_id) FROM app.places WHERE status='active';
SELECT 'invalid=' || count(*) FROM app.places WHERE status='active' AND (
  btrim(name)='' OR country_code<>'LT' OR NOT ST_Covers(ST_MakeEnvelope(25.10,54.55,25.50,54.85,4326),geom)
);
'@
$Validation = docker compose exec -T db psql -At -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c $ValidationSql
if ($LASTEXITCODE -ne 0) { throw 'Place validation query failed.' }
$Values = @{}
foreach ($Line in $Validation) {
    $Parts = $Line -split '='
    $Values[$Parts[0]] = [int64]$Parts[1]
}
if ($Values.active -le 0) { throw 'No active places were imported.' }
if ($Values.active -ne $Values.unique) { throw 'Duplicate source identifiers exist.' }
if ($Values.invalid -ne 0) { throw 'Invalid place records exist.' }

$Metrics = docker compose exec -T db psql -At -F '|' -U $DbUser -d $DbName -c `
    'SELECT source_records,active_places,skipped_missing_name,skipped_invalid_geometry,skipped_country,duplicate_source_ids FROM app.place_import_runs ORDER BY id DESC LIMIT 1;'
$Categories = docker compose exec -T db psql -At -F '|' -U $DbUser -d $DbName -c `
    "SELECT category,count(*) FROM app.places WHERE status='active' GROUP BY category ORDER BY category;"

Write-Host ''
Write-Host 'Vilnius place-data import passed.' -ForegroundColor Green
Write-Host "Active places before: $BeforeCount"
Write-Host "Active places after:  $($Values.active)"
Write-Host "Import/upsert time:    $([math]::Round($Timer.Elapsed.TotalSeconds, 1)) seconds"
$MetricParts = $Metrics -split '\|'
Write-Host "Source records:        $($MetricParts[0])"
Write-Host "Skipped missing name:  $($MetricParts[2])"
Write-Host "Skipped geometry:      $($MetricParts[3])"
Write-Host "Skipped country:       $($MetricParts[4])"
Write-Host "Duplicate source IDs:  $($MetricParts[5])"
Write-Host 'Category counts:'
$Categories | ForEach-Object { Write-Host "  $($_ -replace '\|','=')" }
