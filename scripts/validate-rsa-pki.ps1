[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepositoryRoot

docker compose run --rm --no-deps rsa-pki-validator validate
if ($LASTEXITCODE -ne 0) {
    throw 'Live RSA PKI validation failed. The active leaf must be RSA-2048 and chain to the Map RSA CA.'
}
