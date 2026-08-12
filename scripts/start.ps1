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
        $Health = Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 3
        if ($Health.status -eq 'ok') { break }
    } catch { Start-Sleep -Seconds 2 }
} while ((Get-Date) -lt $Deadline)

if ($Health.status -ne 'ok') {
    docker compose ps
    throw "API did not become healthy within $TimeoutSeconds seconds. Run 'docker compose logs api db'."
}

Write-Host 'Map services are ready.' -ForegroundColor Green
Write-Host 'API:        http://localhost:8000'
Write-Host 'API docs:   http://localhost:8000/docs'
Write-Host 'Map style:  http://localhost:8000/api/v1/map/style.json'
Write-Host 'Tile server: http://localhost:3000'
