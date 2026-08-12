[CmdletBinding()]
param(
    [string]$InputPbf = 'data\lithuania-latest.osm.pbf',
    [switch]$Download
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot
$InputPbf = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $InputPbf))

if ($Download -and -not (Test-Path $InputPbf)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $InputPbf) | Out-Null
    Invoke-WebRequest 'https://download.geofabrik.de/europe/lithuania-latest.osm.pbf' -OutFile $InputPbf
}
if (-not (Test-Path $InputPbf)) { throw "Missing $InputPbf. Pass -Download or provide a Lithuania PBF." }

$Output = Join-Path $RepositoryRoot 'data\generated\vilnius.osm.pbf'
New-Item -ItemType Directory -Force -Path (Split-Path $Output) | Out-Null

docker run --rm -v "${RepositoryRoot}:/work" ghcr.io/osmcode/osmium-tool:v1.16.0 `
    extract -b 25.10,54.55,25.50,54.85 -s complete_ways `
    "/work/$($InputPbf.Substring($RepositoryRoot.Length + 1).Replace('\','/'))" `
    -o /work/data/generated/vilnius.osm.pbf --overwrite
if ($LASTEXITCODE -ne 0) { throw 'Vilnius extraction failed.' }
Write-Host "Created $Output. It is intentionally ignored by Git." -ForegroundColor Green
