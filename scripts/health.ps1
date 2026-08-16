[CmdletBinding()]
param([string]$HostName = 'localhost', [int]$Port = 5173)

$ErrorActionPreference = 'Stop'
$Health = Invoke-RestMethod -Uri "http://${HostName}:${Port}/health" -TimeoutSec 10
$Config = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/config" -TimeoutSec 10
if ($Health.status -ne 'ok' -or $Config.region -ne 'vilnius') { throw 'Map services returned unexpected data.' }
$Places = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/places?west=25.20&south=54.66&east=25.34&north=54.73&limit=5" -TimeoutSec 10
if ($Places.type -ne 'FeatureCollection' -or $Places.features.Count -lt 1 -or $Places.features.Count -gt 5 `
    -or $Places.meta.returned -ne $Places.features.Count -or $Places.meta.total -lt $Places.meta.returned `
    -or $Places.meta.truncated -ne ($Places.meta.total -gt $Places.meta.returned)) {
    throw 'Map place endpoint returned unexpected data. Run .\scripts\places-data.ps1 first.'
}
$Health | ConvertTo-Json
$Config | ConvertTo-Json -Depth 4
Write-Host "PWA gateway, API health, Vilnius configuration, and bounded places checks passed ($($Places.features.Count) places)." -ForegroundColor Green
