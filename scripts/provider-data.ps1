[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required.' }
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running.' }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }

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

$PlaceCount = docker compose exec -T db psql -At -U $DbUser -d $DbName `
    -c "SELECT count(*) FROM app.places WHERE status='active';"
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect application places.' }
if ([int64]$PlaceCount -le 0) {
    Write-Host 'No active places exist; running the place import first.' -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot 'places-data.ps1')
}

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName `
    -f /docker-entrypoint-initdb.d/004_providers.sql
if ($LASTEXITCODE -ne 0) { throw 'Could not install the provider/service schema.' }

$Timer = [Diagnostics.Stopwatch]::StartNew()
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName `
    -f /providers/upsert.sql
if ($LASTEXITCODE -ne 0) { throw 'Provider/service upsert failed.' }
$Timer.Stop()

& (Join-Path $PSScriptRoot 'validate-providers.ps1') -AllowSingleRun

$Metrics = docker compose exec -T db psql -At -F '|' -U $DbUser -d $DbName -c `
    'SELECT candidate_places,active_providers,active_locations,active_services,skipped_places,duplicates_prevented FROM app.provider_import_runs ORDER BY id DESC LIMIT 1;'
if ($LASTEXITCODE -ne 0) { throw 'Could not read provider import metrics.' }
$Parts = $Metrics -split '\|'

Write-Host ''
Write-Host 'Provider/service import passed.' -ForegroundColor Green
Write-Host "Providers:             $($Parts[1])"
Write-Host "Provider locations:    $($Parts[2])"
Write-Host "Provider services:     $($Parts[3])"
Write-Host "Candidate places:      $($Parts[0])"
Write-Host "Skipped places:        $($Parts[4])"
Write-Host "Duplicates prevented:  $($Parts[5])"
Write-Host "Import/upsert time:    $([math]::Round($Timer.Elapsed.TotalSeconds, 2)) seconds"
