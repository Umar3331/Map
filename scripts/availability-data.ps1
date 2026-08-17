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

& (Join-Path $PSScriptRoot 'provider-data.ps1')

$Compose = docker compose config --format json | ConvertFrom-Json
$DbName = $Compose.services.db.environment.POSTGRES_DB
$DbUser = $Compose.services.db.environment.POSTGRES_USER

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName `
    -f /docker-entrypoint-initdb.d/005_availability.sql
if ($LASTEXITCODE -ne 0) { throw 'Could not install the availability schema.' }

$Timer = [Diagnostics.Stopwatch]::StartNew()
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U $DbUser -d $DbName `
    -f /availability/upsert.sql
if ($LASTEXITCODE -ne 0) { throw 'Availability fixture upsert failed.' }
$Timer.Stop()

& (Join-Path $PSScriptRoot 'validate-availability.ps1')

$Metrics = docker compose exec -T db psql -At -F '|' -U $DbUser -d $DbName -c `
    "SELECT (SELECT count(*) FROM app.bookable_offerings WHERE status='active'),(SELECT count(*) FROM app.availability_rules WHERE status='active'),(SELECT count(*) FROM app.availability_exceptions WHERE status='active'),(SELECT count(*) FROM app.availability_exception_windows);"
$Parts = $Metrics -split '\|'

Write-Host ''
Write-Host 'Development availability fixture passed.' -ForegroundColor Green
Write-Host "Bookable offerings: $($Parts[0])"
Write-Host "Weekly rules:      $($Parts[1])"
Write-Host "Exceptions:        $($Parts[2])"
Write-Host "Override windows:  $($Parts[3])"
Write-Host "Fixture time:      $([math]::Round($Timer.Elapsed.TotalSeconds, 2)) seconds"
Write-Host 'These schedules are DEMO/DEVELOPMENT data, not provider-supplied availability.' -ForegroundColor Yellow
