[CmdletBinding()]
param([int]$TimeoutSeconds = 120)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

if (-not (Test-Path '.env')) { throw 'Missing .env. Run .\scripts\setup.ps1 first.' }
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose failed to start.' }

$Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
    try {
        $Health = Invoke-RestMethod -Uri 'http://localhost:5173/health' -TimeoutSec 3
        $Profile = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173/local-ca.mobileconfig' -TimeoutSec 3
        if ($Health.status -eq 'ok' -and $Profile.StatusCode -eq 200) { break }
    } catch { Start-Sleep -Seconds 2 }
} while ((Get-Date) -lt $Deadline)

if ($Health.status -ne 'ok' -or $Profile.StatusCode -ne 200) {
    docker compose ps
    throw "Map or its iPhone CA profile did not become ready within $TimeoutSeconds seconds. Run 'docker compose logs web api'."
}

Write-Host 'Map services are ready.' -ForegroundColor Green
Write-Host 'Map:      http://localhost:5173'
Write-Host 'API docs: http://localhost:8000/docs'
$LanAddress = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway -and $_.IPv4Address } |
    Select-Object -First 1 -ExpandProperty IPv4Address |
    Select-Object -ExpandProperty IPAddress
if ($LanAddress) {
    Write-Host "LAN:      http://${LanAddress}:5173"
    Write-Host "iPhone CA profile: http://${LanAddress}:5173/local-ca.mobileconfig"
    Write-Host "CA certificate: http://${LanAddress}:5173/local-ca.crt"
}
$ConfiguredMapHost = Get-Content '.env' |
    Where-Object { $_ -match '^MAP_HOST=(.+)$' } |
    ForEach-Object { $Matches[1] } |
    Select-Object -First 1
if ($ConfiguredMapHost) {
    Write-Host "PWA HTTPS (after trusting the local CA): https://${ConfiguredMapHost}:8443"
    if ($LanAddress -and $ConfiguredMapHost -ne $LanAddress) {
        Write-Warning "MAP_HOST ($ConfiguredMapHost) differs from the detected LAN IP ($LanAddress). Run .\scripts\setup.ps1 or set MAP_HOST explicitly before iPhone testing."
    }
}
