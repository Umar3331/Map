[CmdletBinding()]
param([string]$HostName = 'localhost', [int]$Port = 5173)

$ErrorActionPreference = 'Stop'
$Health = Invoke-RestMethod -Uri "http://${HostName}:${Port}/health" -TimeoutSec 10
$Config = Invoke-RestMethod -Uri "http://${HostName}:${Port}/api/v1/config" -TimeoutSec 10
if ($Health.status -ne 'ok' -or $Config.region -ne 'vilnius') { throw 'Map services returned unexpected data.' }
$Health | ConvertTo-Json
$Config | ConvertTo-Json -Depth 4
Write-Host 'PWA gateway, API health, and Vilnius configuration checks passed.' -ForegroundColor Green
