[CmdletBinding()]
param([string]$HostName = 'localhost')

$ErrorActionPreference = 'Stop'
$Health = Invoke-RestMethod -Uri "http://${HostName}:8000/health" -TimeoutSec 10
$Config = Invoke-RestMethod -Uri "http://${HostName}:8000/api/v1/config" -TimeoutSec 10
if ($Health.status -ne 'ok' -or $Config.region -ne 'vilnius') { throw 'Map services returned unexpected data.' }
$Health | ConvertTo-Json
$Config | ConvertTo-Json -Depth 4
Write-Host 'API health and Vilnius configuration checks passed.' -ForegroundColor Green
