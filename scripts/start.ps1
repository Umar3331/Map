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
        if ($Health.status -eq 'ok') { break }
    } catch { Start-Sleep -Seconds 2 }
} while ((Get-Date) -lt $Deadline)

if ($Health.status -ne 'ok') {
    docker compose ps
    throw "API did not become healthy within $TimeoutSeconds seconds. Run 'docker compose logs api db'."
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
    Write-Host "PWA HTTPS (after trusting the local CA): https://${LanAddress}:8443"
    Write-Host "CA certificate: http://${LanAddress}:5173/local-ca.crt"
}
