[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

function Require-Command([string]$Name, [string]$Help) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing prerequisite '$Name'. $Help"
    }
}

Require-Command 'git' 'Install Git for Windows: https://git-scm.com/download/win'
Require-Command 'docker' 'Install and start Docker Desktop: https://www.docker.com/products/docker-desktop/'

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is installed but its engine is not available. Start Docker Desktop and retry.' }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required.' }

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example. Review the local password before sharing the stack.'
}

New-Item -ItemType Directory -Force -Path 'data\generated', 'data\cache' | Out-Null
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }

Write-Host 'Map local prerequisites and Compose configuration are ready.' -ForegroundColor Green
Write-Host 'Next: .\scripts\start.ps1'
