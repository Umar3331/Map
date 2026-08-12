[CmdletBinding()]
param([switch]$RemoveVolumes)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

if ($RemoveVolumes) {
    Write-Warning 'Removing containers and the persistent local PostGIS volume.'
    docker compose down --volumes
} else {
    docker compose down
}
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose failed to stop cleanly.' }
