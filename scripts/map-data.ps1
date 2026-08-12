[CmdletBinding()]
param(
    [string]$InputPbf = 'data\lithuania-latest.osm.pbf',
    [switch]$Download,
    [switch]$Update
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required.' }
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running.' }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }

$SourceUrl = 'https://download.geofabrik.de/europe/lithuania-latest.osm.pbf'
$InputPbf = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $InputPbf))
$OutputPbf = Join-Path $RepositoryRoot 'data\generated\vilnius.osm.pbf'
$SourceDirectory = Split-Path $InputPbf
$OutputDirectory = Split-Path $OutputPbf
New-Item -ItemType Directory -Force -Path $SourceDirectory, $OutputDirectory | Out-Null

if ($Update -or $Download -or -not (Test-Path $InputPbf)) {
    Write-Host "Downloading current Lithuania extract from $SourceUrl" -ForegroundColor Cyan
    $DownloadPath = "$InputPbf.download"
    Invoke-WebRequest $SourceUrl -OutFile $DownloadPath
    docker run --rm -v "${SourceDirectory}:/data" iboates/osmium:1.16.0 `
        fileinfo --extended --input-format=pbf /data/$(Split-Path -Leaf $DownloadPath) | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Downloaded Lithuania PBF failed Osmium validation.' }
    Move-Item -Force -LiteralPath $DownloadPath -Destination $InputPbf
}
if (-not (Test-Path $InputPbf)) { throw "Missing $InputPbf." }

docker run --rm -v "${SourceDirectory}:/data" iboates/osmium:1.16.0 `
    fileinfo --extended /data/$(Split-Path -Leaf $InputPbf) | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Existing $InputPbf is incomplete. Run .\scripts\map-data.ps1 -Update to replace it."
}

$RelativeInput = $InputPbf.Substring($RepositoryRoot.Length + 1).Replace('\', '/')
$NeedsExtract = $Update -or -not (Test-Path $OutputPbf) -or
    ((Get-Item $InputPbf).LastWriteTimeUtc -gt (Get-Item $OutputPbf).LastWriteTimeUtc)
if ($NeedsExtract) {
    Write-Host 'Extracting buffered Vilnius bounding box (25.10,54.55,25.50,54.85).' -ForegroundColor Cyan
    docker run --rm -v "${RepositoryRoot}:/work" iboates/osmium:1.16.0 `
        extract -b 25.10,54.55,25.50,54.85 -s complete_ways `
        "/work/$RelativeInput" -o /work/data/generated/vilnius.osm.pbf --overwrite
    if ($LASTEXITCODE -ne 0) { throw 'Vilnius extraction failed.' }
} else {
    Write-Host 'Existing Vilnius extract is current; skipping extraction.' -ForegroundColor DarkGray
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
    -c 'CREATE SCHEMA IF NOT EXISTS osm;'
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the OSM schema.' }

$Timer = [Diagnostics.Stopwatch]::StartNew()
Write-Host 'Importing curated OSM features into the osm schema.' -ForegroundColor Cyan
docker compose run --rm osm-import `
    --create --output=flex --style=/config/vilnius.lua `
    --database=$DbName --username=$DbUser --host=db --port=5432 `
    --number-processes=4 /data/generated/vilnius.osm.pbf
if ($LASTEXITCODE -ne 0) { throw 'osm2pgsql import failed.' }
$Timer.Stop()

$ValidationSql = @'
SELECT table_name || '=' || row_count
FROM (
  SELECT 'boundaries' table_name, count(*) row_count FROM osm.boundaries UNION ALL
  SELECT 'buildings', count(*) FROM osm.buildings UNION ALL
  SELECT 'landuse', count(*) FROM osm.landuse UNION ALL
  SELECT 'places', count(*) FROM osm.places UNION ALL
  SELECT 'railways', count(*) FROM osm.railways UNION ALL
  SELECT 'transportation', count(*) FROM osm.transportation UNION ALL
  SELECT 'water', count(*) FROM osm.water UNION ALL
  SELECT 'waterways', count(*) FROM osm.waterways
) counts ORDER BY table_name;
'@
$Counts = docker compose exec -T db psql -At -v ON_ERROR_STOP=1 -U $DbUser -d $DbName -c $ValidationSql
if ($LASTEXITCODE -ne 0) { throw 'PostGIS import validation failed.' }
foreach ($Count in $Counts) {
    $Parts = $Count -split '='
    if ([int64]$Parts[1] -le 0) { throw "Imported table $($Parts[0]) is empty." }
}

docker compose up -d tiles
if ($LASTEXITCODE -ne 0) { throw 'Martin failed to start after import.' }
docker compose restart tiles | Out-Null
$TileReady = $false
for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
    try {
        $TileResponse = Invoke-WebRequest `
            'http://localhost:3000/transportation/12/2335/1301' -UseBasicParsing -TimeoutSec 5
        if ($TileResponse.StatusCode -eq 200 -and $TileResponse.RawContentLength -gt 0) {
            $TileReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $TileReady) { throw 'Martin did not serve a non-empty Vilnius transportation tile.' }

$InputSize = (Get-Item $InputPbf).Length
$ExtractSize = (Get-Item $OutputPbf).Length
$DatabaseSize = docker compose exec -T db psql -At -U $DbUser -d $DbName -c `
    "SELECT COALESCE(sum(pg_total_relation_size(c.oid)), 0) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='osm' AND c.relkind IN ('r','m');"

Write-Host ''
Write-Host 'Vilnius map-data import passed.' -ForegroundColor Green
Write-Host "Lithuania PBF: $([math]::Round($InputSize / 1MB, 1)) MiB"
Write-Host "Vilnius PBF:   $([math]::Round($ExtractSize / 1MB, 1)) MiB"
Write-Host "OSM tables:    $([math]::Round([double]$DatabaseSize / 1MB, 1)) MiB"
Write-Host "Import time:   $([math]::Round($Timer.Elapsed.TotalSeconds, 1)) seconds"
$Counts | ForEach-Object { Write-Host "  $_" }
Write-Host 'Run .\scripts\start.ps1, then open the printed Map URL.' -ForegroundColor Green
